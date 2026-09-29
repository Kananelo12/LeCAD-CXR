"""Dataset splits.

Two rules that are not negotiable:

1. The TEST set is the NIH's own `test_list.txt`. It is quarantined. You do
   not look at it, tune against it, or compute anything on it until the
   study's final evaluation. Verified properties of the official split:
   86,524 train_val / 25,596 test images, zero image overlap, zero PATIENT
   overlap (28,008 vs 2,797 patients).

2. The NIH gives no validation set, so we carve one out of train_val
   OURSELVES, BY PATIENT. An image-level split leaks: patients contribute
   ~3 images each, so the same person would land on both sides and the
   validation score would be optimistic and meaningless.

Note the test set is systematically enriched for disease relative to
train_val (Pneumothorax 3.0% vs 10.4%, Cardiomegaly 2.0% vs 4.2%, and so on
for every label). AUC-ROC is largely prevalence-insensitive, which is why
it is the primary metric; precision, F1 and PR-AUC will shift noticeably
between validation and test. That is the dataset, not a bug in your code.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

from .config import PATHS, SEED, VAL_PATIENT_FRACTION
from .labels import LABELS, NO_FINDING


def load_metadata() -> pd.DataFrame:
    """Data_Entry_2017.csv, cleaned, with one binary column per label."""
    PATHS.check()
    df = pd.read_csv(PATHS.metadata_csv)
    df.columns = [c.strip() for c in df.columns]

    # Known data-quality bug: ages run up to 414. 16 records exceed 100.
    df["Patient Age"] = pd.to_numeric(df["Patient Age"], errors="coerce")
    df.loc[df["Patient Age"] > 100, "Patient Age"] = np.nan

    findings = df["Finding Labels"].fillna("")
    for label in LABELS:
        df[label] = findings.str.contains(label, regex=False).astype("int8")
    df["no_finding"] = findings.eq(NO_FINDING).astype("int8")

    return df


def official_split(df: pd.DataFrame) -> pd.DataFrame:
    """Tag each row train_val / test using the NIH's own lists."""
    train_val = set(PATHS.official_train_val_list.read_text().split())
    test = set(PATHS.official_test_list.read_text().split())

    overlap = train_val & test
    if overlap:
        raise AssertionError(
            f"Official lists overlap on {len(overlap)} images — bad download."
        )

    df = df.copy()
    df["official_split"] = np.where(
        df["Image Index"].isin(train_val),
        "train_val",
        np.where(df["Image Index"].isin(test), "test", "UNASSIGNED"),
    )
    stray = int((df["official_split"] == "UNASSIGNED").sum())
    if stray:
        raise AssertionError(f"{stray} images are in neither official list.")
    return df


def make_patient_split(df: pd.DataFrame, seed: int = SEED) -> tuple[set[int], set[int]]:
    """Split train_val PATIENTS into train and validation. Deterministic."""
    patients = np.sort(df.loc[df["official_split"] == "train_val", "Patient ID"].unique())

    rng = np.random.default_rng(seed)
    shuffled = patients.copy()
    rng.shuffle(shuffled)

    n_val = int(round(len(shuffled) * VAL_PATIENT_FRACTION))
    val_patients = set(int(p) for p in shuffled[:n_val])
    train_patients = set(int(p) for p in shuffled[n_val:])

    assert not (train_patients & val_patients), "patient leaked across train/val"
    return train_patients, val_patients


def write_splits(seed: int = SEED, out_dir: Path | None = None) -> dict:
    """Generate and persist the split. Commit the output — it is part of
    the experimental record, and a rerun must reproduce it exactly."""
    out_dir = out_dir or PATHS.splits
    out_dir.mkdir(parents=True, exist_ok=True)

    df = official_split(load_metadata())
    train_patients, val_patients = make_patient_split(df, seed=seed)

    (out_dir / "train_patients.txt").write_text(
        "\n".join(str(p) for p in sorted(train_patients)) + "\n"
    )
    (out_dir / "val_patients.txt").write_text(
        "\n".join(str(p) for p in sorted(val_patients)) + "\n"
    )

    split_of = df["Patient ID"].map(
        lambda p: "train" if p in train_patients else "val"
    )
    df["split"] = np.where(df["official_split"] == "test", "test", split_of)

    counts = df["split"].value_counts().to_dict()
    manifest = {
        "seed": seed,
        "val_patient_fraction": VAL_PATIENT_FRACTION,
        "patients": {
            "train": len(train_patients),
            "val": len(val_patients),
            "test": int(df.loc[df.split == "test", "Patient ID"].nunique()),
        },
        "images": {k: int(v) for k, v in counts.items()},
        "metadata_sha256": hashlib.sha256(
            PATHS.metadata_csv.read_bytes()
        ).hexdigest(),
        "label_prevalence_train": {
            L: round(float(df.loc[df.split == "train", L].mean()), 5) for L in LABELS
        },
        "label_prevalence_val": {
            L: round(float(df.loc[df.split == "val", L].mean()), 5) for L in LABELS
        },
    }
    (out_dir / "split_manifest.json").write_text(json.dumps(manifest, indent=2))
    return manifest


def load_split_frame() -> pd.DataFrame:
    """Metadata with a `split` column of train / val / test."""
    train_patients = {
        int(x) for x in (PATHS.splits / "train_patients.txt").read_text().split()
    }
    df = official_split(load_metadata())
    df["split"] = np.where(
        df["official_split"] == "test",
        "test",
        np.where(df["Patient ID"].isin(train_patients), "train", "val"),
    )
    return df
