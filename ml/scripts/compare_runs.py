"""Side-by-side validation results for every run in the artifacts folder.

    python ml/scripts/compare_runs.py

Reads <artifacts>/runs/*/best_val_metrics.json. Validation only; the test
set plays no part in choosing between architectures.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from lecad.config import PATHS
from lecad.labels import LABELS


def main() -> None:
    runs = sorted((PATHS.artifacts / "runs").glob("*/best_val_metrics.json"))
    if not runs:
        print(f"No finished runs under {PATHS.artifacts / 'runs'}.")
        return

    results = {p.parent.name: json.loads(p.read_text()) for p in runs}
    width = max(len(name) for name in results) + 2

    print(f"{'run':<{width}}{'macro AUC':>10}{'macro PR-AUC':>14}")
    for name, m in sorted(results.items(), key=lambda kv: -kv[1]["macro_auc"]):
        print(f"{name:<{width}}{m['macro_auc']:>10.4f}{m['macro_pr_auc']:>14.4f}")

    print(f"\nPer-class AUC\n{'label':<20}" + "".join(f"{n[:14]:>16}" for n in results))
    for label in LABELS:
        row = "".join(f"{m['per_class'][label]['auc']:>16.3f}" for m in results.values())
        print(f"{label:<20}{row}")


if __name__ == "__main__":
    main()
