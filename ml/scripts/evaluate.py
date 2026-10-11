"""Evaluate a trained checkpoint and write a metrics report.

    python ml/scripts/evaluate.py --run <run_dir>                # validation
    LECAD_ALLOW_TEST=1 python ml/scripts/evaluate.py --run <run_dir> --split test

Thresholds come from the checkpoint (chosen on validation during training)
and are applied unchanged. The test split is refused unless LECAD_ALLOW_TEST=1
is set, and that should happen ONCE, for the final model, after every
decision about architecture and hyperparameters has been made.

Besides the overall result, the report breaks results down by subgroup (see
docs/eda-summary.md):
    PA / AP view   Edema is 11x more prevalent on AP films; a large PA/AP gap
                   suggests the model is partly reading the view, not the lung
    adults (18+)   the intended-use population; under-18 images are kept in
                   training for comparability with published results

Writes eval_<name>.json (metrics) and preds_<name>.npz (every image's
probabilities, labels, patient, view and age, for bootstrap_compare.py).
<name> defaults to the split; pass --name to keep a second evaluation (e.g.
a CPU re-run) from overwriting the first.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import numpy as np
import torch

from lecad.data import build_loader
from lecad.labels import LABELS
from lecad.metrics import evaluate
from lecad.models import build_model

from train import predict


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", required=True, type=Path, help="run directory with best.pt")
    ap.add_argument("--split", default="val", choices=("val", "test"))
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--num-workers", type=int, default=4)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--name", help="output name (default: the split)")
    args = ap.parse_args()

    ckpt = torch.load(args.run / "best.pt", map_location="cpu", weights_only=False)
    if tuple(ckpt["labels"]) != LABELS:
        raise ValueError("Checkpoint label order differs from lecad.labels.LABELS.")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = build_model(ckpt["architecture"], pretrained=False)
    model.load_state_dict(ckpt["model"])
    model.to(device)

    loader = build_loader(args.split, args.batch_size, args.num_workers, limit=args.limit)
    y, p = predict(model, loader, device, amp=device.type == "cuda")
    metrics = evaluate(y, p, thresholds=ckpt["thresholds"])
    metrics.update(split=args.split, n_images=len(y), epoch=ckpt["epoch"])

    # The loader does not shuffle eval splits, so row i of the frame is row i of y/p.
    frame = loader.dataset.frame
    groups = {
        "view_PA": (frame["View Position"] == "PA").to_numpy(),
        "view_AP": (frame["View Position"] == "AP").to_numpy(),
        "adults_18_plus": (frame["Patient Age"] >= 18).to_numpy(),
    }
    metrics["subgroups"] = {
        name: {"n_images": int(mask.sum()),
               **evaluate(y[mask], p[mask], thresholds=ckpt["thresholds"])}
        for name, mask in groups.items()
        if mask.any()
    }

    name = args.name or args.split
    out = args.run / f"eval_{name}.json"
    out.write_text(json.dumps(metrics, indent=2))
    np.savez_compressed(
        args.run / f"preds_{name}.npz",
        y=y.astype(np.uint8),
        p=p.astype(np.float32),
        image=frame["Image Index"].to_numpy().astype(str),
        patient=frame["Patient ID"].to_numpy().astype(np.int64),
        view=frame["View Position"].to_numpy().astype(str),
        age=frame["Patient Age"].to_numpy().astype(np.float32),
        labels=np.array(LABELS),
    )

    print(f"{args.split}: {len(y)} images, macro AUC {metrics['macro_auc']:.4f}\n")
    print(f"{'label':<20}{'n_pos':>7}{'AUC':>8}{'sens':>8}{'spec':>8}")
    for name, m in metrics["per_class"].items():
        print(
            f"{name:<20}{m['n_pos']:>7}{m['auc']:>8.3f}"
            f"{m['sensitivity']:>8.3f}{m['specificity']:>8.3f}"
        )
    print(f"\n{'subgroup':<20}{'images':>8}{'macro AUC':>11}")
    for name, g in metrics["subgroups"].items():
        print(f"{name:<20}{g['n_images']:>8}{g['macro_auc']:>11.4f}")
    print(f"\nWrote {out} and preds_{name}.npz")


if __name__ == "__main__":
    main()
