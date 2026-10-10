from dataclasses import replace
from datetime import UTC, datetime, timedelta

from conftest import PASSWORD, add_user
from fastapi.testclient import TestClient

from lecad.serving.app import create_app
from lecad.serving.db import User
from lecad.serving.security import COOKIE_NAME, create_token, decode_token


def login(client, username="mokoena", password=PASSWORD):
    return client.post("/auth/login", json={"username": username, "password": password})


def test_login_sets_httponly_cookie_and_me_works(app, client):
    add_user(app)
    r = login(client)
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "mokoena"
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/auth/me").json()["user"]["display_name"] == "Dr mokoena"


def test_secure_cookie_when_enabled(settings):
    app = create_app(replace(settings, cookie_secure=True))
    add_user(app)
    r = TestClient(app).post("/auth/login", json={"username": "mokoena", "password": PASSWORD})
    assert "secure" in r.headers["set-cookie"].lower()


def test_wrong_password_and_unknown_user_look_the_same(app, client):
    add_user(app)
    a = login(client, password="wrong")
    b = login(client, username="nobody")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json() == {"detail": "Incorrect username or password."}


def test_deactivated_user_cannot_sign_in_or_keep_session(app, client):
    user = add_user(app)
    assert login(client).status_code == 200
    with app.state.sessions() as s:
        s.get(User, user.id).is_active = False
        s.commit()
    assert client.get("/auth/me").status_code == 401
    assert login(client).status_code == 401


def test_throttles_repeated_failures(app, client):
    add_user(app)
    for _ in range(5):
        assert login(client, password="wrong").status_code == 401
    r = login(client)  # even the right password, while blocked
    assert r.status_code == 429
    assert "Too many" in r.json()["detail"]


def test_logout_clears_session(signed_in):
    assert signed_in.post("/auth/logout").status_code == 204
    assert signed_in.get("/auth/me").status_code == 401


def test_rejects_forged_and_expired_tokens(app, client, settings):
    user = add_user(app)
    client.cookies.set(COOKIE_NAME, create_token(user.id, "x" * 48, 30))
    assert client.get("/auth/me").status_code == 401
    old = datetime.now(UTC) - timedelta(hours=2)
    client.cookies.set(COOKIE_NAME, create_token(user.id, settings.jwt_secret, 30, now=old))
    assert client.get("/auth/me").status_code == 401


def test_session_renewed_after_half_its_life(app, client, settings):
    user = add_user(app)
    issued = datetime.now(UTC) - timedelta(minutes=20)  # of 30
    client.cookies.set(COOKIE_NAME, create_token(user.id, settings.jwt_secret, 30, now=issued))
    r = client.get("/auth/me")
    assert r.status_code == 200
    fresh = decode_token(r.cookies[COOKIE_NAME], settings.jwt_secret)
    assert fresh["iat"] > issued.timestamp() + 60


def test_endpoints_require_sign_in(client):
    for method, path in (("get", "/auth/me"), ("get", "/history"), ("get", "/model"),
                         ("post", "/predict")):
        assert getattr(client, method)(path).status_code == 401, path


def test_settings_refuse_placeholder_secret(settings):
    import pytest

    with pytest.raises(ValueError, match="JWT_SECRET"):
        replace(settings, jwt_secret="change-me-and-never-commit-the-real-one")
