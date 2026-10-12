"""Figures for the results chapter (docs/results-and-findings.md).

    python ml/scripts/make_results_figures.py

Reads the three runs' history.jsonl, the chosen run's test predictions and
operating point, and writes PNGs to docs/figures/results/. Uses files that
already exist; no model is run.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import matplotlib as mpl
import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import roc_auc_score, roc_curve

from lecad.config import PATHS
from lecad.labels import LABELS

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "figures" / "results"
RUNS = PATHS.artifacts / "runs"
CHOSEN = "baseline-densenet121-20261010-201111"
MODELS = {  # name -> (run folder, colour)
    "DenseNet-121": (CHOSEN, "#2a78d6"),
    "ResNet-50": ("resnet50-20261011-030417", "#eb6834"),
    "EfficientNet-B0": ("efficientnet-b0-20261011-041329", "#1baf7a"),
}

# Published results on the same official NIH test split, as tabulated by
# Taslimi et al. (2022, SwinCheX, Table 1). Cite the original papers.
PUBLISHED = {
    "Wang et al. 2017": [0.700, 0.810, 0.759, 0.661, 0.693, 0.669, 0.658, 0.799,
                         0.703, 0.805, 0.833, 0.786, 0.684, 0.872],
    "Guendel et al. 2018 (DNet)": [0.767, 0.883, 0.828, 0.709, 0.821, 0.758, 0.731,
                                   0.846, 0.745, 0.835, 0.895, 0.818, 0.761, 0.896],
    "Taslimi et al. 2022 (SwinCheX)": [0.781, 0.875, 0.824, 0.701, 0.822, 0.780, 0.713,
                                       0.871, 0.748, 0.848, 0.914, 0.826, 0.778, 0.855],
}  # order: lecad.labels.LABELS

INK, INK2, MUTED, GRID, AXIS = "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#c3c2b7"
mpl.rcParams.update({
    "font.family": ["Segoe UI", "DejaVu Sans", "sans-serif"], "font.size": 10,
    "axes.titlesize": 11, "axes.titleweight": "bold", "axes.titlelocation": "left",
    "axes.labelcolor": INK2, "text.color": INK, "axes.edgecolor": AXIS,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
    "grid.color": GRID, "grid.linewidth": 0.6, "axes.axisbelow": True,
    "xtick.color": MUTED, "ytick.color": MUTED, "xtick.labelcolor": INK2,
    "ytick.labelcolor": INK2, "legend.frameon": False, "figure.dpi": 110,
    "savefig.dpi": 200, "savefig.bbox": "tight", "figure.facecolor": "white",
})


def learning_curves() -> None:
    fig, ax = plt.subplots(figsize=(7.5, 3.8))
    for name, (run, colour) in MODELS.items():
        h = [json.loads(line) for line in (RUNS / run / "history.jsonl").open()]
        ep = [r["epoch"] for r in h]
        auc = [r["val_macro_auc"] for r in h]
        best = int(np.argmax(auc))
        ax.plot(ep, auc, color=colour, linewidth=2, marker="o", markersize=4, label=name)
        ax.plot(ep[best], auc[best], marker="o", markersize=9, markerfacecolor="white",
                markeredgecolor=colour, markeredgewidth=2)
        below = name == "EfficientNet-B0"  # its best sits under DenseNet-121's
        ax.annotate(f"{auc[best]:.4f}", (ep[best], auc[best]), textcoords="offset points",
                    xytext=(0, -16 if below else 9), ha="center", fontsize=8, color=INK2)
    ax.set_xlabel("Epoch")
    ax.set_ylabel("Validation macro AUC")
    ax.set_xticks(range(1, 16))
    ax.legend(loc="lower left")
    ax.set_title("Validation macro AUC per epoch (ring = best epoch, kept as best.pt)")
    fig.savefig(OUT / "01_learning_curves.png")
    plt.close(fig)


def test_roc() -> None:
    d = np.load(RUNS / CHOSEN / "preds_test.npz")
    op = json.loads((RUNS / CHOSEN / "operating_point_sens90.json").read_text())
    y, p = d["y"], d["p"]
    fig, axes = plt.subplots(3, 5, figsize=(13, 8))
    for k, (ax, lab) in enumerate(zip(axes.flat, LABELS, strict=False)):
        fpr, tpr, _ = roc_curve(y[:, k], p[:, k])
        ax.plot(fpr, tpr, color="#2a78d6", linewidth=1.8)
        ax.plot([0, 1], [0, 1], color=AXIS, linewidth=0.8, linestyle="--")
        t = op[lab]["threshold"]
        pos, neg = p[y[:, k] == 1, k], p[y[:, k] == 0, k]
        sens, fp = float(np.mean(pos >= t)), float(np.mean(neg >= t))
        ax.plot(fp, sens, marker="o", markersize=7, color="#eb6834")
        ax.set_title(f"{lab.replace('_', ' ')}  AUC {roc_auc_score(y[:, k], p[:, k]):.3f}",
                     fontsize=9, loc="left")
        ax.text(0.97, 0.05, f"sens {sens:.2f}\nspec {1 - fp:.2f}", ha="right", va="bottom",
                fontsize=8, color=INK2, transform=ax.transAxes)
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.set_aspect("equal")
        ax.tick_params(labelsize=7)
    last = axes.flat[-1]
    last.axis("off")
    last.text(0.0, 0.6, "Blue: ROC curve on the test set\n"
                        "Orange: deployed operating point\n"
                        "(thresholds chosen on validation\nfor >= 90% sensitivity)\n"
                        "x: 1 - specificity   y: sensitivity",
              fontsize=9, color=INK2, va="center")
    fig.suptitle("DenseNet-121 on the NIH test set (25,596 images)", x=0.01, ha="left",
                 fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "02_test_roc_per_finding.png")
    plt.close(fig)


def published_comparison() -> None:
    ev = json.loads((RUNS / CHOSEN / "eval_test.json").read_text())
    ours = [ev["per_class"][lab]["auc"] for lab in LABELS]
    order = np.argsort(ours)
    y = np.arange(len(LABELS))
    fig, ax = plt.subplots(figsize=(7.5, 6))
    styles = {"Wang et al. 2017": ("#c3c2b7", "s"),
              "Guendel et al. 2018 (DNet)": ("#898781", "D"),
              "Taslimi et al. 2022 (SwinCheX)": ("#eb6834", "^")}
    for name, vals in PUBLISHED.items():
        colour, marker = styles[name]
        ax.scatter(np.array(vals)[order], y, color=colour, marker=marker, s=34,
                   label=f"{name} (mean {np.mean(vals):.3f})", zorder=2)
    ax.scatter(np.array(ours)[order], y, color="#2a78d6", s=60, zorder=3,
               label=f"This study, DenseNet-121 (mean {np.mean(ours):.3f})")
    ax.set_yticks(y, [LABELS[i].replace("_", " ") for i in order])
    ax.set_xlabel("Test AUC (official NIH test split)")
    ax.grid(axis="y", visible=False)
    ax.legend(loc="lower right", fontsize=8)
    ax.set_title("Per-finding test AUC against published results on the same split")
    fig.savefig(OUT / "03_published_comparison.png")
    plt.close(fig)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    learning_curves()
    test_roc()
    published_comparison()
    print(f"Wrote figures to {OUT}")


if __name__ == "__main__":
    main()
