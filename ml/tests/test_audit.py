import pytest
from conftest import png_bytes, upload
from sqlalchemy import delete, select, update

from lecad.serving import audit
from lecad.serving.db import AuditLog


def test_every_prediction_is_chained(app, signed_in):
    for c in range(3):
        upload(signed_in, png_bytes(colour=c))
    with app.state.sessions() as s:
        report = audit.verify_chain(s)
        rows = s.scalars(select(AuditLog).order_by(AuditLog.id)).all()
    assert report.ok and report.rows == 3
    assert rows[0].prev_hash == audit.GENESIS
    assert [r.prev_hash for r in rows[1:]] == [r.row_hash for r in rows[:-1]]
    assert report.head_hash == rows[-1].row_hash
    assert all(r.scope_confirmed for r in rows)


@pytest.mark.parametrize("change", [
    {"image_sha256": "f" * 64},
    {"model_version": "something-else"},
])
def test_detects_edited_row(app, signed_in, change):
    for c in range(3):
        upload(signed_in, png_bytes(colour=c))
    with app.state.sessions() as s:
        s.execute(update(AuditLog).where(AuditLog.id == 2).values(**change))
        s.commit()
        report = audit.verify_chain(s)
    assert report.first_bad_id == 2
    assert "edited" in report.reason


def test_detects_edited_findings(app, signed_in):
    upload(signed_in, png_bytes())
    with app.state.sessions() as s:
        findings = [dict(f) for f in s.get(AuditLog, 1).findings]
        findings[0]["band"] = "below" if findings[0]["band"] != "below" else "above"
        s.execute(update(AuditLog).where(AuditLog.id == 1).values(findings=findings))
        s.commit()
        assert audit.verify_chain(s).first_bad_id == 1


def test_detects_deleted_row(app, signed_in):
    for c in range(3):
        upload(signed_in, png_bytes(colour=c))
    with app.state.sessions() as s:
        s.execute(delete(AuditLog).where(AuditLog.id == 2))
        s.commit()
        report = audit.verify_chain(s)
    assert report.first_bad_id == 3
    assert "deleted" in report.reason
