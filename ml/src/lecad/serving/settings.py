"""Service configuration, from the environment (.env locally).

Fails at startup, not at the first request, when something is missing.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

_PLACEHOLDER_SECRETS = ("change-me", "changeme", "secret")


@dataclass(frozen=True)
class Settings:
    database_url: str
    jwt_secret: str
    # Exactly one of these: a trained checkpoint, or the fake model for
    # development before training has produced one.
    model_path: Path | None = None
    fake_model: bool = False
    session_minutes: int = 30
    # True whenever the site is served over HTTPS. Only plain-http local
    # development may turn it off.
    cookie_secure: bool = True

    def __post_init__(self) -> None:
        if not self.database_url:
            raise ValueError("DATABASE_URL is not set.")
        secret = self.jwt_secret
        if len(secret) < 32 or any(p in secret.lower() for p in _PLACEHOLDER_SECRETS):
            raise ValueError(
                "JWT_SECRET must be a random value of at least 32 characters. Generate one:\n"
                '  python -c "import secrets; print(secrets.token_urlsafe(48))"'
            )
        if self.fake_model == (self.model_path is not None):
            raise ValueError(
                "Set exactly one of LECAD_MODEL_PATH (a trained best.pt) "
                "or LECAD_FAKE_MODEL=1 (development only)."
            )
        if self.model_path is not None and not self.model_path.is_file():
            raise ValueError(f"LECAD_MODEL_PATH does not exist: {self.model_path}")

    @classmethod
    def from_env(cls) -> Settings:
        model_path = os.getenv("LECAD_MODEL_PATH")
        return cls(
            database_url=os.environ.get("DATABASE_URL", ""),
            jwt_secret=os.environ.get("JWT_SECRET", ""),
            model_path=Path(model_path) if model_path else None,
            fake_model=os.getenv("LECAD_FAKE_MODEL") == "1",
            session_minutes=int(os.getenv("LECAD_SESSION_MINUTES", "30")),
            cookie_secure=os.getenv("LECAD_COOKIE_SECURE", "1") != "0",
        )
