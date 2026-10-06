"""Evaluation metrics, reported per class.

AUC-ROC is primary because it does not depend on prevalence, and prevalence
differs between validation and test (see splits.py). Threshold-dependent
metrics (sensitivity, specificity, precision, F1) need a threshold. It is
CHOSEN ON VALIDATION (Youden's J per class), saved with the checkpoint, and
then APPLIED UNCHANGED to test. Choosing thresholds on test is tuning on
test.
"""
from __future__ import annotations

import math

import numpy as np
from sklearn.metrics import average_precision_score, roc_auc_score, roc_curve

from .labels import LABELS


def _has_both_classes(y: np.ndarray) -> bool:
    return 0 < y.sum() < len(y)


def youden_thresholds(targets: np.ndarray, probs: np.ndarray) -> list[float]:
    """Per-class threshold maximising sensitivity + specificity - 1."""
    out = []
    for i in range(targets.shape[1]):
        y, p = targets[:, i], probs[:, i]
        if not _has_both_classes(y):
            out.append(0.5)
            continue
        fpr, tpr, thr = roc_curve(y, p)
        best = int(np.argmax(tpr - fpr))
        out.append(float(min(thr[best], 1.0)))  # sklearn's first thr is inf
    return out


def evaluate(
    targets: np.ndarray, probs: np.ndarray, thresholds: list[float] | None = None
) -> dict:
    """Per-class and macro metrics. A class with only one outcome present
    gets NaN, and the macro averages skip it. Say so when reporting."""
    if thresholds is None:
        thresholds = youden_thresholds(targets, probs)

    per_class = {}
    for i, name in enumerate(LABELS):
        y, p = targets[:, i], probs[:, i]
        t = thresholds[i]
        pred = p >= t
        tp = int((pred & (y == 1)).sum())
        fp = int((pred & (y == 0)).sum())
        fn = int((~pred & (y == 1)).sum())
        tn = int((~pred & (y == 0)).sum())

        def ratio(a: int, b: int) -> float:
            return a / b if b else math.nan

        sens, prec = ratio(tp, tp + fn), ratio(tp, tp + fp)
        per_class[name] = {
            "n_pos": int(y.sum()),
            "auc": float(roc_auc_score(y, p)) if _has_both_classes(y) else math.nan,
            "pr_auc": float(average_precision_score(y, p)) if y.sum() else math.nan,
            "threshold": t,
            "sensitivity": sens,
            "specificity": ratio(tn, tn + fp),
            "precision": prec,
            "f1": ratio(2 * tp, 2 * tp + fp + fn),
        }

    def macro(key: str) -> float:
        vals = [m[key] for m in per_class.values() if not math.isnan(m[key])]
        return float(np.mean(vals)) if vals else math.nan

    return {
        "macro_auc": macro("auc"),
        "macro_pr_auc": macro("pr_auc"),
        "macro_f1": macro("f1"),
        "n_classes_scored": sum(not math.isnan(m["auc"]) for m in per_class.values()),
        "per_class": per_class,
    }
