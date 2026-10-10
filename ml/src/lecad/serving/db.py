"""Database tables: user accounts and the audit log.

PostgreSQL in deployment (ADR 0001). SQLite works for tests and quick local
runs; the PostgreSQL-only safeguards are noted where they apply.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    DDL,
    JSON,
    Boolean,
    DateTime,
    Engine,
    ForeignKey,
    Integer,
    String,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    """Always timezone-aware UTC in Python. SQLite drops the timezone on
    storage; this puts it back, so timestamps serialise with an offset."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is not None and value.tzinfo is None:
            raise ValueError("naive datetime; use datetime.now(UTC)")
        return value

    def process_result_value(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


def utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True,
                                    default=lambda: uuid.uuid4().hex)
    username: Mapped[str] = mapped_column(String(64), unique=True)
    display_name: Mapped[str] = mapped_column(String(128))
    role: Mapped[str] = mapped_column(String(16))  # "clinician" | "admin"
    password_hash: Mapped[str] = mapped_column(String(256))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class AuditLog(Base):
    """One row per prediction. Append-only and hash-chained (ADR 0001):
    each row's hash covers its content and the previous row's hash, so any
    later edit or deletion breaks the chain from that row onwards.

    Stores the image's SHA-256, never the image.
    """

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    request_id: Mapped[str] = mapped_column(String(36), unique=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    image_sha256: Mapped[str] = mapped_column(String(64))
    model_version: Mapped[str] = mapped_column(String(128))
    scope_confirmed: Mapped[bool] = mapped_column(Boolean)
    # The findings as returned to the user: label, probability, threshold, band.
    findings: Mapped[list] = mapped_column(JSON)
    prev_hash: Mapped[str] = mapped_column(String(64))
    row_hash: Mapped[str] = mapped_column(String(64), unique=True)


# PostgreSQL enforces append-only itself, so not even a bug or a stray SQL
# session can rewrite history. (SQLite has no equivalent; the hash chain
# still detects tampering there.)
_APPEND_ONLY = DDL("""
CREATE OR REPLACE FUNCTION audit_log_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_append_only();

CREATE TRIGGER audit_log_no_truncate
    BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION audit_log_append_only();
""")
event.listen(AuditLog.__table__, "after_create",
             _APPEND_ONLY.execute_if(dialect="postgresql"))


def make_engine(database_url: str) -> Engine:
    kwargs = {}
    if database_url.startswith("sqlite"):
        # FastAPI runs sync endpoints on a thread pool.
        kwargs["connect_args"] = {"check_same_thread": False}
    return create_engine(database_url, **kwargs)


def make_sessionmaker(engine: Engine) -> sessionmaker:
    return sessionmaker(engine, expire_on_commit=False)


def init_db(engine: Engine) -> None:
    """Create missing tables. A prototype convenience: a deployment that
    must evolve its schema should move to migrations (Alembic)."""
    Base.metadata.create_all(engine)
