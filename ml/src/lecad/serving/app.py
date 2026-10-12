"""The HTTP API (docs/api-contract.md).

    uvicorn lecad.serving.app:app --port 8000

Routes have no /api prefix: Next.js rewrites /api/* to this service.

No `from __future__ import annotations` here: FastAPI resolves the
dependency aliases defined inside create_app from real annotations.
"""

import hashlib
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from lecad.labels import LABELS, SPARSE_LABELS

from . import audit
from .db import AuditLog, User, init_db, make_engine, make_sessionmaker
from .inference import (
    MAX_UPLOAD_BYTES,
    CheckpointPredictor,
    FakePredictor,
    Predictor,
    UnsupportedImage,
    band_for,
    decode_image,
)
from .security import (
    COOKIE_NAME,
    LoginThrottle,
    create_token,
    decode_token,
    hash_password,
    needs_rehash,
    verify_password,
)
from .settings import Settings

DISCLAIMER = (
    "Decision support only, not a diagnosis. LeCAD-CXR is a research prototype, "
    "not a registered medical device. It has not been validated on patients in "
    "Lesotho. The clinical decision remains with the treating clinician."
)
FAKE_MODEL_WARNING = (
    "DEVELOPMENT BUILD WITH A FAKE MODEL: these results are random and mean nothing. "
)
BAD_CREDENTIALS = "Incorrect username or password."

Band = Literal["above", "near", "below"]


# ── Response models: the contract, checked on the way out ───────────────

class UserOut(BaseModel):
    id: str
    username: str
    display_name: str
    role: Literal["clinician", "admin"]


class UserResponse(BaseModel):
    user: UserOut


class LoginIn(BaseModel):
    username: str
    password: str


class FindingOut(BaseModel):
    label: str
    probability: float
    threshold: float
    band: Band
    sparse: bool


class ModelRef(BaseModel):
    version: str
    architecture: str


class PredictionOut(BaseModel):
    request_id: str
    created_at: datetime
    image_sha256: str
    model: ModelRef
    disclaimer: str
    findings: list[FindingOut]
    heatmaps: dict[str, list[list[float]]]


class HistoryItem(BaseModel):
    request_id: str
    created_at: datetime
    image_sha256: str
    model_version: str
    flagged: list[str]


class HistoryPage(BaseModel):
    items: list[HistoryItem]
    next_cursor: str | None


class ClassMetrics(BaseModel):
    n_pos: int
    auc: float | None
    pr_auc: float | None
    threshold: float
    sensitivity: float | None
    specificity: float | None
    sparse: bool


class Validation(BaseModel):
    n_images: int | None
    macro_auc: float | None
    per_class: dict[str, ClassMetrics]


class ModelInfo(BaseModel):
    version: str
    architecture: str
    image_size: int
    validation: Validation


def _user_out(user: User) -> UserOut:
    return UserOut(id=user.id, username=user.username,
                   display_name=user.display_name, role=user.role)  # type: ignore[arg-type]


def create_app(settings: Settings, predictor: Predictor | None = None) -> FastAPI:
    engine = make_engine(settings.database_url)
    init_db(engine)
    sessions: sessionmaker = make_sessionmaker(engine)
    if predictor is None:
        predictor = (FakePredictor() if settings.fake_model
                     else CheckpointPredictor(settings.model_path))  # type: ignore[arg-type]
    disclaimer = (FAKE_MODEL_WARNING + DISCLAIMER
                  if isinstance(predictor, FakePredictor) else DISCLAIMER)
    throttle = LoginThrottle()

    app = FastAPI(title="LeCAD-CXR API", docs_url="/docs", redoc_url=None)
    app.state.sessions = sessions
    app.state.throttle = throttle

    # Every error is {"detail": "<message>"}, the shape the contract promises
    # and the frontend shows to the user.
    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
        message = first.get("msg", "invalid value")
        return JSONResponse({"detail": f"Invalid request: {where} {message}".strip()},
                            status_code=422)

    def db() -> Iterator[Session]:
        with sessions() as session:
            yield session

    DB = Annotated[Session, Depends(db)]

    def set_session_cookie(response: Response, user_id: str) -> None:
        response.set_cookie(
            COOKIE_NAME,
            create_token(user_id, settings.jwt_secret, settings.session_minutes),
            max_age=settings.session_minutes * 60,
            httponly=True,
            secure=settings.cookie_secure,
            samesite="lax",
            path="/",
        )

    def current_user(
        response: Response,
        session: DB,
        token: Annotated[str | None, Cookie(alias=COOKIE_NAME)] = None,
    ) -> User:
        claims = decode_token(token, settings.jwt_secret) if token else None
        user = session.get(User, claims["sub"]) if claims else None
        if user is None or not user.is_active:
            raise HTTPException(401, "Not signed in.")
        # Sliding session: renewed once half its lifetime has passed, so an
        # active user is not signed out mid-task but an idle one is.
        age = datetime.now(UTC).timestamp() - claims["iat"]
        if age > settings.session_minutes * 30:
            set_session_cookie(response, user.id)
        return user

    CurrentUser = Annotated[User, Depends(current_user)]

    # ── Auth ─────────────────────────────────────────────────────────────

    @app.post("/auth/login", response_model=UserResponse)
    def login(body: LoginIn, response: Response, session: DB):
        if throttle.blocked(body.username):
            raise HTTPException(
                429, "Too many failed sign-in attempts. Try again in 15 minutes.")
        user = session.scalars(select(User).where(User.username == body.username)).first()
        ok = verify_password(user.password_hash if user else None, body.password)
        if not ok or user is None or not user.is_active:
            throttle.record_failure(body.username)
            raise HTTPException(401, BAD_CREDENTIALS)
        throttle.reset(body.username)
        if needs_rehash(user.password_hash):
            user.password_hash = hash_password(body.password)
            session.commit()
        set_session_cookie(response, user.id)
        return UserResponse(user=_user_out(user))

    @app.post("/auth/logout", status_code=204)
    def logout(response: Response):
        response.delete_cookie(COOKIE_NAME, path="/", httponly=True,
                               secure=settings.cookie_secure, samesite="lax")

    @app.get("/auth/me", response_model=UserResponse)
    def me(user: CurrentUser):
        return UserResponse(user=_user_out(user))

    # ── Prediction ───────────────────────────────────────────────────────

    @app.post("/predict", response_model=PredictionOut)
    def predict(
        user: CurrentUser,
        session: DB,
        image: Annotated[UploadFile, File()],
        scope_confirmed: Annotated[str, Form()] = "",
    ):
        if scope_confirmed != "true":
            raise HTTPException(422, "Confirm the image is a frontal adult chest X-ray.")
        data = image.file.read(MAX_UPLOAD_BYTES + 1)
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Image is larger than 10 MB.")
        try:
            img = decode_image(data)
        except UnsupportedImage as e:
            raise HTTPException(415, str(e)) from e

        # The hash of the file exactly as uploaded: what anyone can recompute
        # later from the same file to find this row.
        sha = hashlib.sha256(data).hexdigest()
        out = predictor.predict(img)
        del img, data  # never stored; only the hash outlives the request

        findings = [
            {"label": label, "probability": p, "threshold": t,
             "band": band_for(p, t), "sparse": label in SPARSE_LABELS}
            for label, p, t in zip(LABELS, out.probabilities, predictor.thresholds,
                                   strict=True)
        ]
        row = audit.append(
            session,
            request_id=str(uuid.uuid4()),
            user_id=user.id,
            created_at=datetime.now(UTC),
            image_sha256=sha,
            model_version=predictor.version,
            scope_confirmed=True,
            findings=findings,
        )
        return PredictionOut(
            request_id=row.request_id,
            created_at=row.created_at,
            image_sha256=row.image_sha256,
            model=ModelRef(version=predictor.version, architecture=predictor.architecture),
            disclaimer=disclaimer,
            findings=[FindingOut(**f) for f in findings],
            heatmaps=out.heatmaps,
        )

    # ── History ──────────────────────────────────────────────────────────

    @app.get("/history", response_model=HistoryPage)
    def history(
        user: CurrentUser,
        session: DB,
        limit: Annotated[int, Query(ge=1, le=100)] = 20,
        cursor: Annotated[str | None, Query()] = None,
    ):
        query = select(AuditLog).where(AuditLog.user_id == user.id)
        if cursor is not None:
            if not cursor.isdigit():
                raise HTTPException(422, "Invalid request: cursor")
            query = query.where(AuditLog.id < int(cursor))
        rows = session.scalars(query.order_by(AuditLog.id.desc()).limit(limit + 1)).all()
        page = rows[:limit]
        return HistoryPage(
            items=[
                HistoryItem(
                    request_id=r.request_id,
                    created_at=r.created_at,
                    image_sha256=r.image_sha256,
                    model_version=r.model_version,
                    flagged=[f["label"] for f in sorted(
                        (f for f in r.findings if f["band"] == "above"),
                        key=lambda f: f["probability"], reverse=True)],
                )
                for r in page
            ],
            next_cursor=str(page[-1].id) if len(rows) > limit else None,
        )

    # ── Model ────────────────────────────────────────────────────────────

    @app.get("/model", response_model=ModelInfo)
    def model_info(user: CurrentUser):
        return ModelInfo(
            version=predictor.version,
            architecture=predictor.architecture,
            image_size=predictor.image_size,
            validation=Validation(**predictor.validation()),
        )

    return app


def _app_from_env() -> FastAPI:
    return create_app(Settings.from_env())


def __getattr__(name: str):
    # `uvicorn lecad.serving.app:app` builds the app from the environment on
    # first access; importing this module (tests, the admin CLI) does not.
    if name == "app":
        globals()["app"] = application = _app_from_env()
        return application
    raise AttributeError(name)
