"""Confidence intervals for each model's AUC, and for the differences between
models, by a paired bootstrap over PATIENTS.

    python ml/scripts/bootstrap_compare.py --name val-gpu
    python ml/scripts/bootstrap_compare.py --name val-gpu --view AP   # bedside films only

Reads preds_<name>.npz from every run under <artifacts>/runs that has one
(written by evaluate.py --name <name>), or only the runs given with --runs.

Why patients, not images: a patient's several radiographs are not
independent, so resampling images would understate the uncertainty. Each
bootstrap round draws 4,201 validation patients with replacement and takes
all of their images.

Why paired: every model is scored on the SAME resampled patients in each
round, so the interval for a difference reflects how consistently one
model beats the other, not just how wide each model's own interval is.

Reported: point estimate (all validation images), 95% percentile interval,
and for each difference the share of rounds in which it was above zero.
Validation only; the test set plays no part in choosing a model.
"""
from __future__ import annotations

import argparse
import itertools
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import numpy as np
from scipy.stats import rankdata

from lecad.config import PATHS


def auc(y: np.ndarray, s: np.ndarray) -> float:
    """ROC AUC via the rank-sum identity (ties get average ranks, matching
    sklearn). NaN when only one class is present."""
    n1 = int(y.sum())
    n0 = len(y) - n1
    if n1 == 0 or n0 == 0:
        return float("nan")
    r = rankdata(s)
    return float((r[y == 1].sum() - n1 * (n1 + 1) / 2) / (n1 * n0))


def per_class_auc(y: np.ndarray, p: np.ndarray) -> np.ndarray:
    return np.array([auc(y[:, k], p[:, k]) for k in range(y.shape[1])])


def ci(samples: np.ndarray) -> tuple[float, float]:
    lo, hi = np.nanpercentile(samples, [2.5, 97.5])
    return float(lo), float(hi)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="val", help="which preds_<name>.npz to read")
    ap.add_argument("--runs", nargs="*", help="run folder names (default: all with preds)")
    ap.add_argument("--n", type=int, default=2000, help="bootstrap rounds")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--view", choices=("PA", "AP"), help="restrict to one view position")
    args = ap.parse_args()

    root = PATHS.artifacts / "runs"
    names = args.runs or sorted(
        d.name for d in root.iterdir() if (d / f"preds_{args.name}.npz").exists()
    )
    if len(names) < 1:
        raise SystemExit(f"No preds_{args.name}.npz found under {root}. Run evaluate.py first.")
    data = {n: np.load(root / n / f"preds_{args.name}.npz") for n in names}

    first = data[names[0]]
    labels = [str(x) for x in first["labels"]]
    y = first["y"].astype(np.int8)
    for n in names[1:]:
        if not np.array_equal(data[n]["image"], first["image"]):
            raise SystemExit(f"{n} was evaluated on different images; cannot pair.")
    keep = np.ones(len(y), dtype=bool)
    if args.view:
        keep = first["view"] == args.view
        y = y[keep]
    probs = {n: data[n]["p"][keep] for n in names}

    patients = first["patient"][keep]
    _, inverse = np.unique(patients, return_inverse=True)
    groups = [np.flatnonzero(inverse == g) for g in range(inverse.max() + 1)]
    print(f"runs     : {len(names)}\nview     : {args.view or 'all'}\n"
          f"images   : {len(y):,}\npatients : {len(groups):,}\n"
          f"rounds   : {args.n:,} (seed {args.seed})")

    point = {n: per_class_auc(y, probs[n]) for n in names}
    rng = np.random.default_rng(args.seed)
    boot = {n: np.empty((args.n, len(labels))) for n in names}
    t0 = time.time()
    for b in range(args.n):
        idx = np.concatenate([groups[g] for g in rng.integers(0, len(groups), len(groups))])
        yb = y[idx]
        for n in names:
            boot[n][b] = per_class_auc(yb, probs[n][idx])
        if (b + 1) % 250 == 0:
            print(f"  {b + 1:>5}/{args.n}  ({time.time() - t0:.0f}s)", flush=True)

    macro_point = {n: float(np.nanmean(point[n])) for n in names}
    macro_boot = {n: np.nanmean(boot[n], axis=1) for n in names}

    report = {"name": args.name, "view": args.view or "all", "rounds": args.n,
              "seed": args.seed,
              "images": len(y), "patients": len(groups), "models": {}, "differences": {}}
    width = max(len(n) for n in names) + 2

    print(f"\nMacro AUC, 95% CI\n{'run':<{width}}{'AUC':>8}   95% CI")
    for n in sorted(names, key=lambda n: -macro_point[n]):
        lo, hi = ci(macro_boot[n])
        print(f"{n:<{width}}{macro_point[n]:>8.4f}   [{lo:.4f}, {hi:.4f}]")
        report["models"][n] = {
            "macro_auc": macro_point[n], "macro_ci": [lo, hi],
            "per_class": {lab: {"auc": float(point[n][k]), "ci": list(ci(boot[n][:, k]))}
                          for k, lab in enumerate(labels)},
        }

    if len(names) > 1:
        print(f"\nDifferences in macro AUC (A - B)\n"
              f"{'A':<{width}}{'B':<{width}}{'diff':>8}   95% CI              A > B in")
        for a, b in itertools.combinations(sorted(names, key=lambda n: -macro_point[n]), 2):
            d = macro_boot[a] - macro_boot[b]
            lo, hi = ci(d)
            share = float(np.mean(d > 0))
            print(f"{a:<{width}}{b:<{width}}{macro_point[a] - macro_point[b]:>+8.4f}   "
                  f"[{lo:+.4f}, {hi:+.4f}]   {share:>6.1%} of rounds")
            report["differences"][f"{a} - {b}"] = {
                "diff": macro_point[a] - macro_point[b],
                "ci": [lo, hi],
                "share_above_zero": share,
            }

    print(f"\nPer-class AUC, 95% CI\n{'label':<20}" + "".join(f"{n[:22]:>24}" for n in names))
    for k, lab in enumerate(labels):
        cells = "".join(
            f"{point[n][k]:>8.3f} [{ci(boot[n][:, k])[0]:.2f},{ci(boot[n][:, k])[1]:.2f}]"
            for n in names
        )
        print(f"{lab:<20}{cells}")

    out = PATHS.artifacts / "comparisons"
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"bootstrap_{args.name}{'_' + args.view if args.view else ''}.json"
    path.write_text(json.dumps(report, indent=2))
    print(f"\nWrote {path}")


if __name__ == "__main__":
    main()
