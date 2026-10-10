"""PostgreSQL-only safeguards. Skipped unless a throwaway database is given:

    docker run -d --rm --name lecad-pg-test -e POSTGRES_USER=lecad \\
        -e POSTGRES_PASSWORD=lecad -e POSTGRES_DB=lecad -p 55432:5432 postgres:16-alpine
    LECAD_TEST_POSTGRES_URL=postgresql+psycopg://lecad:lecad@localhost:55432/lecad pytest

The tests drop and recreate every table in that database.
"""
import contextlib
import os
import threading
import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import delete, text, update
from sqlalchemy.exc import DBAPIError

from lecad.serving import audit
from lecad.serving.db import AuditLog, Base, User, init_db, make_engine, make_sessionmaker

URL = os.getenv("LECAD_TEST_POSTGRES_URL")
pytestmark = pytest.mark.skipif(not URL, reason="LECAD_TEST_POSTGRES_URL not set")


@pytest.fixture
def sessions():
    engine = make_engine(URL)
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS audit_log, users CASCADE"))
    init_db(engine)
    factory = make_sessionmaker(engine)
    with factory() as s:
        s.add(User(id="u1", username="u1", display_name="U1", role="clinician",
                   password_hash="x"))
        s.commit()
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


def _append(sessions, i: int = 0):
    with sessions() as s:
        return audit.append(
            s, request_id=str(uuid.uuid4()), user_id="u1", created_at=datetime.now(UTC),
            image_sha256=f"{i:064x}", model_version="m", scope_confirmed=True,
            findings=[{"label": "Mass", "probability": 0.1234567891, "threshold": 0.05,
                       "band": "above", "sparse": False}],
        )


def test_database_refuses_update_and_delete(sessions):
    _append(sessions)
    for stmt in (update(AuditLog).values(model_version="edited"),
                 delete(AuditLog),
                 text("TRUNCATE audit_log")):
        with sessions() as s, pytest.raises(DBAPIError, match="append-only"):
            s.execute(stmt)
            s.commit()


def test_chain_survives_round_trip_in_another_timezone(sessions):
    _append(sessions)
    with sessions() as s:
        s.execute(text("SET TIME ZONE 'Africa/Maseru'"))  # UTC+2
        assert audit.verify_chain(s).ok


def test_concurrent_appends_keep_one_chain(sessions, monkeypatch):
    # Without the in-process lock, as with several API worker processes:
    # only PostgreSQL's advisory lock keeps the chain single.
    monkeypatch.setattr(audit, "_process_lock", contextlib.nullcontext())
    errors = []

    def worker(start):
        try:
            for i in range(start, start + 10):
                _append(sessions, i)
        except Exception as e:  # pragma: no cover - reported below
            errors.append(e)

    threads = [threading.Thread(target=worker, args=(n * 100,)) for n in range(6)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert not errors
    with sessions() as s:
        report = audit.verify_chain(s)
    assert report.ok and report.rows == 60
