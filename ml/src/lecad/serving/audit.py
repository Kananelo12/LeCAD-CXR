"""Append-only, hash-chained audit log (ADR 0001).

Each row's hash is SHA-256 over a canonical encoding of its content plus the
previous row's hash. Changing or deleting any row changes every hash after
it, which `verify_chain` detects. If an image is produced later, hashing it
and finding its row proves what the system said about it, without the
system ever having kept the image.

Limit: deleting the newest rows leaves a shorter chain that still verifies.
`verify_chain` reports the head hash; recording it somewhere outside the
database from time to time (a dated note, an email) closes that gap.
"""
from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .db import AuditLog

GENESIS = "0" * 64
_ADVISORY_LOCK_KEY = 0x1EC4D  # any constant shared by all API processes
_process_lock = threading.Lock()


def _canonical(row: AuditLog) -> bytes:
    content = {
        "request_id": row.request_id,
        "user_id": row.user_id,
        # UTC, whatever timezone the database session hands back.
        "created_at": row.created_at.astimezone(UTC).isoformat(),
        "image_sha256": row.image_sha256,
        "model_version": row.model_version,
        "scope_confirmed": row.scope_confirmed,
        "findings": row.findings,
        "prev_hash": row.prev_hash,
    }
    return json.dumps(content, sort_keys=True, separators=(",", ":")).encode()


def row_hash(row: AuditLog) -> str:
    return hashlib.sha256(_canonical(row)).hexdigest()


def append(
    session: Session,
    *,
    request_id: str,
    user_id: str,
    created_at: datetime,
    image_sha256: str,
    model_version: str,
    scope_confirmed: bool,
    findings: list[dict],
) -> AuditLog:
    """Write one row and commit. Serialised, so two concurrent requests can
    never both chain onto the same previous row."""
    with _process_lock:
        if session.get_bind().dialect.name == "postgresql":
            # Covers several API worker processes; released at commit.
            session.execute(text("SELECT pg_advisory_xact_lock(:k)"),
                            {"k": _ADVISORY_LOCK_KEY})
        last = session.scalars(select(AuditLog.row_hash)
                               .order_by(AuditLog.id.desc()).limit(1)).first()
        row = AuditLog(
            request_id=request_id,
            user_id=user_id,
            created_at=created_at,
            image_sha256=image_sha256,
            model_version=model_version,
            scope_confirmed=scope_confirmed,
            findings=findings,
            prev_hash=last or GENESIS,
        )
        row.row_hash = row_hash(row)
        session.add(row)
        session.commit()
        return row


@dataclass(frozen=True)
class ChainReport:
    rows: int
    first_bad_id: int | None  # None when the whole chain verifies
    reason: str = ""
    head_hash: str = GENESIS

    @property
    def ok(self) -> bool:
        return self.first_bad_id is None


def verify_chain(session: Session) -> ChainReport:
    expected_prev = GENESIS
    n = 0
    for row in session.scalars(select(AuditLog).order_by(AuditLog.id)).yield_per(500):
        n += 1
        if row.prev_hash != expected_prev:
            return ChainReport(n, row.id, "prev_hash does not match the previous row "
                                          "(a row was deleted or inserted)")
        if row_hash(row) != row.row_hash:
            return ChainReport(n, row.id, "content does not match its hash (row was edited)")
        expected_prev = row.row_hash
    return ChainReport(n, None, head_hash=expected_prev)
