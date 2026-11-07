"""The database can be asleep or briefly unreachable (Neon suspends when
idle, ADR 0004). The API must say so with a 503 the frontend can wait on,
never a 500, and must not reuse connections the server has closed."""
from __future__ import annotations

import pytest
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from lecad.serving.app import DATABASE_UNAVAILABLE
from lecad.serving.db import make_engine


def test_health_is_public_and_touches_the_database(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.fixture
def database_down(monkeypatch):
    def fail(*args, **kwargs):
        raise OperationalError("SELECT 1", {}, Exception(
            "server closed the connection unexpectedly"))
    monkeypatch.setattr(Session, "execute", fail)
    monkeypatch.setattr(Session, "scalars", fail)


@pytest.mark.parametrize("method,path,body", [
    ("get", "/health", None),
    ("post", "/auth/login", {"username": "mokoena", "password": "whatever-it-is"}),
])
def test_unreachable_database_is_a_503_with_retry_after(client, database_down,
                                                        method, path, body):
    r = getattr(client, method)(path, **({"json": body} if body else {}))
    assert r.status_code == 503
    assert r.json() == {"detail": DATABASE_UNAVAILABLE}
    assert r.headers["retry-after"] == "2"


def test_unreachable_database_does_not_count_as_a_failed_sign_in(app, client, database_down):
    for _ in range(6):
        client.post("/auth/login", json={"username": "mokoena", "password": "x" * 12})
    assert not app.state.throttle.blocked("mokoena")


def test_postgres_pool_checks_connections_before_use():
    engine = make_engine("postgresql+psycopg://u:p@localhost:1/db")  # never connects
    assert engine.pool._pre_ping is True
    assert engine.pool._recycle == 240


def test_sqlite_pool_is_left_alone(tmp_path):
    engine = make_engine(f"sqlite:///{tmp_path / 'x.db'}")
    assert engine.pool._pre_ping is False
