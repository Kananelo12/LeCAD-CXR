import hashlib

from conftest import PASSWORD, add_user, png_bytes, upload

from lecad.labels import LABELS, SPARSE_LABELS
from lecad.serving.app import FAKE_MODEL_WARNING
from lecad.serving.inference import MAX_UPLOAD_BYTES


def test_prediction_follows_the_contract(signed_in):
    data = png_bytes()
    r = upload(signed_in, data)
    assert r.status_code == 200
    body = r.json()
    assert body["image_sha256"] == hashlib.sha256(data).hexdigest()
    assert [f["label"] for f in body["findings"]] == list(LABELS)
    for f in body["findings"]:
        assert f["sparse"] == (f["label"] in SPARSE_LABELS)
        expected = ("above" if f["probability"] >= f["threshold"]
                    else "near" if f["probability"] >= f["threshold"] / 2 else "below")
        assert f["band"] == expected
    flagged = {f["label"] for f in body["findings"] if f["band"] == "above"}
    assert set(body["heatmaps"]) <= flagged
    assert len(body["heatmaps"]) <= 5
    assert body["created_at"].endswith("Z")


def test_fake_model_is_announced(signed_in):
    body = upload(signed_in, png_bytes()).json()
    assert body["disclaimer"].startswith(FAKE_MODEL_WARNING)
    assert "FAKE" in body["model"]["version"]


def test_requires_scope_confirmation(signed_in):
    r = upload(signed_in, png_bytes(), scope="false")
    assert r.status_code == 422
    assert "frontal adult chest X-ray" in r.json()["detail"]


def test_rejects_non_images_by_content(signed_in):
    # Claims to be a PNG; is not.
    assert upload(signed_in, b"%PDF-1.7 not an image").status_code == 415
    # A real image, but not an accepted format.
    r = upload(signed_in, png_bytes(fmt="GIF"), name="x.gif", ctype="image/gif")
    assert r.status_code == 415
    assert r.json()["detail"] == "Only PNG and JPEG images are accepted."


def test_accepts_jpeg_and_colour(signed_in):
    data = png_bytes(fmt="JPEG", mode="RGB", colour=(90, 90, 90))
    assert upload(signed_in, data, ctype="image/jpeg").status_code == 200


def test_rejects_oversized_upload(signed_in):
    assert upload(signed_in, b"\0" * (MAX_UPLOAD_BYTES + 1)).status_code == 413


def test_validation_errors_are_plain_strings(signed_in):
    r = signed_in.post("/predict", data={"scope_confirmed": "true"})  # no file
    assert r.status_code == 422
    assert isinstance(r.json()["detail"], str)


def test_history_is_own_rows_newest_first_and_paged(app, signed_in):
    shas = [upload(signed_in, png_bytes(colour=c)).json()["image_sha256"] for c in range(25)]

    page1 = signed_in.get("/history").json()
    assert [i["image_sha256"] for i in page1["items"]] == shas[::-1][:20]
    page2 = signed_in.get(f"/history?cursor={page1['next_cursor']}").json()
    assert [i["image_sha256"] for i in page2["items"]] == shas[::-1][20:]
    assert page2["next_cursor"] is None

    # Another clinician sees none of them.
    add_user(app, username="other")
    signed_in.post("/auth/logout")
    signed_in.post("/auth/login", json={"username": "other", "password": PASSWORD})
    assert signed_in.get("/history").json() == {"items": [], "next_cursor": None}


def test_history_flagged_matches_prediction(signed_in):
    body = upload(signed_in, png_bytes(colour=7)).json()
    flagged = sorted((f for f in body["findings"] if f["band"] == "above"),
                     key=lambda f: f["probability"], reverse=True)
    item = signed_in.get("/history").json()["items"][0]
    assert item["flagged"] == [f["label"] for f in flagged]


def test_model_info(signed_in):
    body = signed_in.get("/model").json()
    assert set(body["validation"]["per_class"]) == set(LABELS)
    assert body["validation"]["per_class"]["Hernia"]["sparse"] is True
