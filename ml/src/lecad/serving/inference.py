"""Image decoding, the model, Grad-CAM, and the fake model used before
training has produced a checkpoint.

Preprocessing is imported from lecad.transforms, never reimplemented here.
"""
from __future__ import annotations

import hashlib
import io
import math
import random
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar, Protocol

import torch
from PIL import Image, UnidentifiedImageError

from lecad.labels import LABELS, SPARSE_LABELS
from lecad.models import build_model, gradcam_target_layer
from lecad.transforms import build_transform, prepare_image

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
# Far beyond any radiograph (ChestX-ray14 is 1024 x 1024); stops a small
# compressed file from expanding into gigabytes of pixels.
MAX_PIXELS = 50_000_000
ACCEPTED_FORMATS = ("PNG", "JPEG")
HEATMAP_LIMIT = 5  # Grad-CAM for at most this many flagged findings


class UnsupportedImage(ValueError):
    """The upload is not a PNG or JPEG this service can read."""


def decode_image(data: bytes) -> Image.Image:
    """Decide what the file is from its content, not its name or the
    Content-Type the browser claimed."""
    try:
        img = Image.open(io.BytesIO(data))
    except (UnidentifiedImageError, OSError) as e:
        raise UnsupportedImage("The file is not a readable image.") from e
    if img.format not in ACCEPTED_FORMATS:
        raise UnsupportedImage("Only PNG and JPEG images are accepted.")
    if img.width * img.height > MAX_PIXELS:
        raise UnsupportedImage("The image has too many pixels.")
    try:
        img.load()
    except (OSError, Image.DecompressionBombError) as e:
        raise UnsupportedImage("The image file is damaged or incomplete.") from e
    return img


def band_for(probability: float, threshold: float) -> str:
    """docs/api-contract.md. The 'near' margin (half the threshold) is
    provisional, to be reviewed with the supervisor."""
    if probability >= threshold:
        return "above"
    if probability >= 0.5 * threshold:
        return "near"
    return "below"


@dataclass(frozen=True)
class Output:
    probabilities: list[float]  # in LABELS order
    heatmaps: dict[str, list[list[float]]]  # label -> grid, flagged findings only


class Predictor(Protocol):
    version: str
    architecture: str
    image_size: int
    thresholds: list[float]

    def predict(self, img: Image.Image) -> Output: ...
    def validation(self) -> dict: ...


def heatmap_labels(probabilities: list[float], thresholds: list[float]) -> list[int]:
    """Indices that get a heatmap: flagged findings, strongest first.

    "Strongest" is relative to each finding's own review level (score /
    threshold), not the raw score: raw scores are not comparable across
    findings, whose thresholds differ (0.10 to 0.39 for the deployed model).
    The interface orders and labels findings by the same measure.
    """
    flagged = [i for i, (p, t) in enumerate(zip(probabilities, thresholds, strict=True))
               if p >= t]
    flagged.sort(key=lambda i: probabilities[i] / max(thresholds[i], 1e-9), reverse=True)
    return flagged[:HEATMAP_LIMIT]


def _round_grid(cam: torch.Tensor) -> list[list[float]]:
    return [[round(float(v), 3) for v in row] for row in cam]


class CheckpointPredictor:
    """A trained best.pt from ml/scripts/train.py."""

    def __init__(self, path: Path) -> None:
        # weights_only: the file can hold tensors and plain values only, so
        # loading it cannot run code hidden in a pickle.
        ckpt = torch.load(path, map_location="cpu", weights_only=True)
        if tuple(ckpt["labels"]) != LABELS:
            raise ValueError("Checkpoint label order differs from lecad.labels.LABELS.")

        self.architecture: str = ckpt["architecture"]
        self.image_size: int = ckpt["image_size"]
        self.thresholds: list[float] = [float(t) for t in ckpt["thresholds"]]
        self._val_metrics: dict = ckpt["val_metrics"]
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        # Names the exact weights, so every audit row is traceable to them.
        self.version = f"{self.architecture}-{digest[:12]}"

        self._model = build_model(self.architecture, pretrained=False)
        self._model.load_state_dict(ckpt["model"])
        self._model.eval()
        self._target = gradcam_target_layer(self._model, self.architecture)
        self._transform = build_transform("eval", self.image_size)
        self._lock = threading.Lock()

    def predict(self, img: Image.Image) -> Output:
        x = self._transform(prepare_image(img)).unsqueeze(0)
        with self._lock:
            captured: list[torch.Tensor] = []
            handle = self._target.register_forward_hook(lambda m, i, out: captured.append(out))
            try:
                with torch.enable_grad():
                    logits = self._model(x)[0]
                    probs = torch.sigmoid(logits).tolist()
                    heatmaps = {
                        LABELS[i]: self._gradcam(logits[i], captured[0])
                        for i in heatmap_labels(probs, self.thresholds)
                    }
            finally:
                handle.remove()
        return Output(probabilities=probs, heatmaps=heatmaps)

    @staticmethod
    def _gradcam(score: torch.Tensor, activations: torch.Tensor) -> list[list[float]]:
        """Grad-CAM (Selvaraju et al., 2017): channel weights are the mean
        gradient of the finding's logit; the map is the ReLU of the weighted
        sum of activations, scaled to 0-1."""
        (grads,) = torch.autograd.grad(score, activations, retain_graph=True)
        weights = grads.mean(dim=(2, 3), keepdim=True)
        cam = torch.relu((weights * activations).sum(dim=1))[0].detach()
        peak = cam.max()
        return _round_grid(cam / peak if peak > 0 else cam)

    def validation(self) -> dict:
        m = self._val_metrics
        return {
            "n_images": m.get("n_images"),
            "macro_auc": _finite(m.get("macro_auc")),
            "per_class": {
                label: {
                    "n_pos": int(c["n_pos"]),
                    "auc": _finite(c["auc"]),
                    "pr_auc": _finite(c["pr_auc"]),
                    "threshold": float(c["threshold"]),
                    "sensitivity": _finite(c["sensitivity"]),
                    "specificity": _finite(c["specificity"]),
                    "sparse": label in SPARSE_LABELS,
                }
                for label, c in m["per_class"].items()
            },
        }


def _finite(v: float | None) -> float | None:
    """NaN (a metric that could not be computed) becomes null in JSON."""
    return None if v is None or math.isnan(v) else float(v)


class FakePredictor:
    """Random but repeatable output, for running the system before a model
    is trained. Its version string and the disclaimer say so on every
    response; it must never be confused with a model."""

    version = "FAKE-not-a-trained-model"
    architecture = "none"
    image_size = 224
    # Plausible Youden-like thresholds: low, because most findings are rare.
    thresholds: ClassVar[list[float]] = [0.11, 0.06, 0.13, 0.18, 0.05, 0.06, 0.015,
                                         0.05, 0.04, 0.025, 0.03, 0.02, 0.035, 0.004]

    def predict(self, img: Image.Image) -> Output:
        rng = random.Random(hashlib.sha256(img.tobytes()).digest())
        flagged = set(rng.sample(range(len(LABELS)), rng.randint(0, 3)))
        probs = [
            t + rng.random() * (1 - t) * 0.6 if i in flagged else t * rng.random() ** 2 * 0.95
            for i, t in enumerate(self.thresholds)
        ]
        flagged = heatmap_labels(probs, self.thresholds)
        return Output(probabilities=probs,
                      heatmaps={LABELS[i]: self._blob(rng) for i in flagged})

    @staticmethod
    def _blob(rng: random.Random, size: int = 7) -> list[list[float]]:
        cy, cx, s = 1.5 + rng.random() * 4, 1 + rng.random() * 5, 0.9 + rng.random() * 0.8
        grid = torch.tensor([[math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s))
                              for x in range(size)] for y in range(size)])
        return _round_grid(grid / grid.max())

    def validation(self) -> dict:
        return {
            "n_images": None,
            "macro_auc": None,
            "per_class": {
                label: {"n_pos": 0, "auc": None, "pr_auc": None, "threshold": t,
                        "sensitivity": None, "specificity": None,
                        "sparse": label in SPARSE_LABELS}
                for label, t in zip(LABELS, self.thresholds, strict=True)
            },
        }
