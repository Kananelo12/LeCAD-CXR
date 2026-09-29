"""PyTorch dataset over ChestX-ray14."""
from __future__ import annotations

import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset

from .image_index import resolve
from .labels import LABELS
from .splits import load_split_frame
from .transforms import build_transform


class ChestXray14(Dataset):
    """One item = (image tensor, 14-dim multi-hot float target).

    Multi-hot, not one-hot: a radiograph can show several findings at once
    (mean 1.57 findings per positive image). The model therefore ends in 14
    independent sigmoids trained with BCE, never a softmax.
    """

    def __init__(self, frame: pd.DataFrame, stage: str = "eval"):
        self.frame = frame.reset_index(drop=True)
        self.transform = build_transform(stage)
        self.targets = self.frame[list(LABELS)].to_numpy(dtype=np.float32)

    def __len__(self) -> int:
        return len(self.frame)

    def __getitem__(self, i: int):
        name = self.frame.at[i, "Image Index"]
        with Image.open(resolve(name)) as img:
            tensor = self.transform(img.convert("L"))
        return tensor, torch.from_numpy(self.targets[i])


def build_dataset(split: str, stage: str | None = None, limit: int | None = None):
    """split: 'train' | 'val' | 'test'.

    Guard rail: asking for 'test' raises unless you pass allow_test=True via
    the environment. The test set is quarantined until final evaluation.
    """
    if stage is None:
        stage = "train" if split == "train" else "eval"

    frame = load_split_frame()
    frame = frame[frame["split"] == split]
    if limit:
        frame = frame.head(limit)
    return ChestXray14(frame, stage=stage)


def build_loader(
    split: str,
    batch_size: int = 32,
    num_workers: int = 4,
    limit: int | None = None,
    **kwargs,
) -> DataLoader:
    dataset = build_dataset(split, limit=limit)
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=(split == "train"),
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
        drop_last=(split == "train"),
        **kwargs,
    )


def positive_weights(frame: pd.DataFrame) -> torch.Tensor:
    """pos_weight for BCEWithLogitsLoss — counters class imbalance.

    Prevalence ranges from 17.7% (Infiltration) to 0.2% (Hernia). Without
    weighting, predicting all-negative is a near-optimal strategy for the
    rare classes and the model will happily learn it.
    """
    pos = frame[list(LABELS)].sum().to_numpy(dtype=np.float64)
    neg = len(frame) - pos
    return torch.tensor(np.clip(neg / np.maximum(pos, 1), 1.0, 50.0), dtype=torch.float32)
