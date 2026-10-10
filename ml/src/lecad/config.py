"""Configuration resolved from the environment, so the same code runs
unchanged on the laptop, on Kaggle and in the API container.

Set LECAD_DATA_ROOT in .env (local) or as an env var (Kaggle).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

try:  # optional: load .env when present
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # dotenv not installed (e.g. slim serving image)
    pass


def _detect_data_root() -> Path:
    """Environment variable wins; otherwise guess the common locations."""
    env = os.getenv("LECAD_DATA_ROOT")
    if env:
        return Path(env).expanduser()

    for candidate in (
        Path("/kaggle/input/data"),           # Kaggle: NIH Chest X-rays
        Path("/kaggle/input/nih-chest-xrays/data"),  # Kaggle, newer mount path
        Path("D:/Work/archive"),              # this laptop
        Path.home() / "data" / "chestxray14",
    ):
        if candidate.exists():
            return candidate

    raise RuntimeError(
        "Could not find the dataset. Set LECAD_DATA_ROOT in your .env file, "
        "e.g. LECAD_DATA_ROOT=D:/Work/archive"
    )


@dataclass(frozen=True)
class Paths:
    data_root: Path
    artifacts: Path
    splits: Path
    cache: Path

    @property
    def metadata_csv(self) -> Path:
        return self.data_root / "Data_Entry_2017.csv"

    @property
    def official_train_val_list(self) -> Path:
        return self.data_root / "train_val_list.txt"

    @property
    def official_test_list(self) -> Path:
        return self.data_root / "test_list.txt"

    @property
    def bbox_csv(self) -> Path:
        return self.data_root / "BBox_List_2017.csv"

    def check(self) -> None:
        """Fail early and loudly with a useful message."""
        missing = [
            p
            for p in (
                self.metadata_csv,
                self.official_train_val_list,
                self.official_test_list,
            )
            if not p.exists()
        ]
        if missing:
            raise FileNotFoundError(
                f"Dataset root {self.data_root} is missing: "
                + ", ".join(p.name for p in missing)
            )


_REPO_ROOT = Path(__file__).resolve().parents[3]  # .../LeCAD-CXR


def __getattr__(name: str):
    """Build PATHS on first use, not at import.

    The API imports this module (through lecad.transforms) on machines that
    have no dataset; finding the dataset eagerly would crash it on startup.
    `from lecad.config import PATHS` still works: it calls this.
    """
    if name == "PATHS":
        paths = Paths(
            data_root=_detect_data_root(),
            artifacts=Path(os.getenv("LECAD_ARTIFACTS", _REPO_ROOT / "ml" / "artifacts")),
            splits=_REPO_ROOT / "ml" / "splits",
            cache=_REPO_ROOT / "ml" / ".cache",
        )
        globals()["PATHS"] = paths
        return paths
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

SEED = int(os.getenv("LECAD_SEED", "42"))

# Fraction of train_val PATIENTS held out for validation.
VAL_PATIENT_FRACTION = 0.15

IMAGE_SIZE = 224  # DenseNet-121 / ResNet-50 / EfficientNet-B0 native input

# Every image is first reduced to this size, in training AND in the API
# (transforms.prepare_image). The training data is stored already reduced
# (make_resized_cache.py), which makes training several times faster. Larger
# than IMAGE_SIZE, so nothing the model sees is lost; measured effect on the
# 224px model input: 0.2% mean pixel difference (2026-10-10, 100 images).
# Changing it means rebuilding the cache and retraining.
CACHE_SIZE = 256

# ImageNet statistics — the pretrained weights expect these. Changing them
# without retraining is the classic train/serve skew bug.
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
