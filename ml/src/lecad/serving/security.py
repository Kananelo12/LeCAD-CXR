"""Passwords (argon2id), session tokens (short-lived JWT in an httpOnly
cookie), and a brake on password guessing."""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

COOKIE_NAME = "lecad_session"
_ALGORITHM = "HS256"

_hasher = PasswordHasher()  # argon2id with the library's current defaults
# Verified against when the username does not exist, so a wrong username
# takes as long as a wrong password and response time does not reveal
# which accounts exist.
_DUMMY_HASH = _hasher.hash("not-a-real-password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and bool(password_hash)
    except (VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def create_token(user_id: str, secret: str, minutes: int, now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    claims = {"sub": user_id, "iat": now, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(claims, secret, algorithm=_ALGORITHM)


def decode_token(token: str, secret: str) -> dict | None:
    """The claims, or None if the token is invalid or expired."""
    try:
        return jwt.decode(token, secret, algorithms=[_ALGORITHM],
                          options={"require": ["sub", "iat", "exp"]})
    except jwt.PyJWTError:
        return None


class LoginThrottle:
    """At most `limit` failed sign-ins per username within `window` seconds.

    In memory, so per process and reset on restart: enough to stop casual
    guessing against a single-process prototype, not a distributed attack.
    """

    def __init__(self, limit: int = 5, window: float = 15 * 60) -> None:
        self.limit = limit
        self.window = window
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _recent(self, username: str, now: float) -> deque[float]:
        q = self._failures[username]
        while q and q[0] <= now - self.window:
            q.popleft()
        return q

    def blocked(self, username: str) -> bool:
        with self._lock:
            return len(self._recent(username.lower(), time.monotonic())) >= self.limit

    def record_failure(self, username: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._recent(username.lower(), now).append(now)

    def reset(self, username: str) -> None:
        with self._lock:
            self._failures.pop(username.lower(), None)
