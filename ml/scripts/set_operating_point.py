"""Write a deployment checkpoint whose per-finding thresholds catch a chosen
share of true cases (sensitivity) on validation.

    python ml/scripts/set_operating_point.py --run ml/artifacts/runs/<run> \\
        --preds val-gpu --sensitivity 0.90

Reads <run>/best.pt and <run>/preds_<preds>.npz (evaluate.py output for
that same checkpoint) and writes <run>/model_sens90.pt:

    same weights; thresholds = for each finding, the highest threshold that
    still flags >= 90% of validation positives, or the original (Youden)
    threshold if that is lower, so no finding becomes LESS sensitive than
    before; val_metrics recomputed at those thresholds; operating_point
    recorded.

Why: the thresholds train.py saves (Youden's J) weigh a miss and a false
alarm equally, which leaves some findings missed 40% of the time. For
decision support, a missed case is the costly error (docs/model-card.md,
"Operating point"), so the deployed model is set to miss at most 1 in 10.
The clinician reviews every flag; the false alarms that brings are the
accepted cost.

Thresholds are chosen on VALIDATION only. The test set then measures, once,
how well this pre-chosen operating point holds. Point the API at the file
with LECAD_MODEL_PATH, and evaluate it with evaluate.py --checkpoint.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import numpy as np
import torch

from lecad.labels import LABELS
from lecad.metrics import evaluate


def threshold_for_sensitivity(y: np.ndarray, s: np.ndarray, target: float) -> float:
    """The highest threshold t with mean(s[y == 1] >= t) >= target."""
    pos = np.sort(s[y == 1])[::-1]
    if len(pos) == 0:
        return 0.5
    return float(pos[int(np.ceil(target * len(pos))) - 1])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True, type=Path)
    ap.add_argument("--preds", default="val", help="which preds_<name>.npz to use")
    ap.add_argument("--sensitivity", type=float, default=0.90)
    args = ap.parse_args()

    ckpt_path = args.run / "best.pt"
    ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    data = np.load(args.run / f"preds_{args.preds}.npz")
    if [str(x) for x in data["labels"]] != list(LABELS):
        raise SystemExit("Prediction file label order differs from lecad.labels.LABELS.")
    y, p = data["y"].astype(np.int8), data["p"]

    # The predictions must come from this checkpoint: the original
    # validation AUCs and the ones recomputed from the file must agree.
    from_preds = evaluate(y, p)
    for name, m in ckpt["val_metrics"]["per_class"].items():
        a, b = m["auc"], from_preds["per_class"][name]["auc"]
        if not (np.isnan(a) and np.isnan(b)) and abs(a - b) > 1e-3:
            raise SystemExit(f"{name}: preds AUC {b:.4f} != checkpoint {a:.4f}. "
                             "Were these predictions made with this run's best.pt?")

    # At least the target sensitivity, and never less sensitive than the
    # Youden threshold where that one already exceeds the target.
    thresholds = [min(threshold_for_sensitivity(y[:, k], p[:, k], args.sensitivity),
                      float(ckpt["thresholds"][k]))
                  for k in range(len(LABELS))]
    metrics = evaluate(y, p, thresholds=thresholds)
    metrics["n_images"] = len(y)

    tag = f"sens{round(args.sensitivity * 100)}"
    out = args.run / f"model_{tag}.pt"
    torch.save(
        {
            **ckpt,
            "thresholds": thresholds,
            "val_metrics": metrics,
            "operating_point": {
                "kind": "sensitivity",
                "target": float(args.sensitivity),
                "chosen_on": f"validation ({len(y)} images, preds_{args.preds}.npz)",
                "youden_thresholds": [float(t) for t in ckpt["thresholds"]],
                "source_checkpoint_sha256": hashlib.sha256(ckpt_path.read_bytes()).hexdigest(),
            },
        },
        out,
    )

    summary = {
        name: {"threshold": thresholds[k], "youden_threshold": float(ckpt["thresholds"][k]),
               "sensitivity": m["sensitivity"], "specificity": m["specificity"],
               "youden_sensitivity": ckpt["val_metrics"]["per_class"][name]["sensitivity"],
               "youden_specificity": ckpt["val_metrics"]["per_class"][name]["specificity"],
               "n_pos": m["n_pos"]}
        for k, (name, m) in enumerate(metrics["per_class"].items())
    }
    (args.run / f"operating_point_{tag}.json").write_text(json.dumps(summary, indent=2))

    print(f"operating point: {args.sensitivity:.0%} sensitivity on validation "
          f"({len(y):,} images)")
    print(f"\n{'finding':<20}{'n_pos':>6}  {'Youden: sens / spec':>20}  "
          f"{'new: sens / spec':>18}  {'threshold':>9}")
    for name, r in summary.items():
        print(f"{name:<20}{r['n_pos']:>6}  {r['youden_sensitivity']:>10.3f} / "
              f"{r['youden_specificity']:.3f}  {r['sensitivity']:>8.3f} / "
              f"{r['specificity']:.3f}  {r['threshold']:>9.4f}")
    print(f"\nWrote {out}\n  and {args.run / f'operating_point_{tag}.json'}")


if __name__ == "__main__":
    main()
