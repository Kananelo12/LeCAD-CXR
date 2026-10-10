from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from lecad.serving.app import create_app
from lecad.serving.db import User
from lecad.serving.inference import FakePredictor
from lecad.serving.security import hash_password
from lecad.serving.settings import Settings

PASSWORD = "correct horse battery staple"


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        database_url=f"sqlite:///{tmp_path / 'test.db'}",
        jwt_secret="t" * 48,
        fake_model=True,
        cookie_secure=False,  # TestClient talks plain http
    )


@pytest.fixture
def app(settings):
    return create_app(settings, predictor=FakePredictor())


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


def add_user(app, username="mokoena", role="clinician", active=True) -> User:
    with app.state.sessions() as s:
        user = User(username=username, display_name=f"Dr {username}", role=role,
                    password_hash=hash_password(PASSWORD), is_active=active)
        s.add(user)
        s.commit()
        return user


@pytest.fixture
def signed_in(app, client) -> TestClient:
    add_user(app)
    r = client.post("/auth/login", json={"username": "mokoena", "password": PASSWORD})
    assert r.status_code == 200
    return client


def png_bytes(size=(64, 64), colour=128, fmt="PNG", mode="L") -> bytes:
    buf = io.BytesIO()
    Image.new(mode, size, colour).save(buf, fmt)
    return buf.getvalue()


def upload(client, data: bytes, scope="true", name="cxr.png", ctype="image/png"):
    return client.post("/predict", files={"image": (name, data, ctype)},
                       data={"scope_confirmed": scope})
