"""Build a small stratified subset for laptop development.

The full dataset is ~40GB and lives on Kaggle for real training. For writing
and debugging code you want something that fits in a couple of gigabytes and
loads in seconds.

    python ml/scripts/make_dev_subset.py --n 2000 --out D:/Work/cxr-dev

Copies images AND writes a matching Data_Entry/list files, so you can point
LECAD_DATA_ROOT at the subset and every script runs unchanged.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from lecad.image_index import resolve
from lecad.labels import LABELS
from lecad.splits import load_split_frame


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=2000, help="images per split")
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()

    df = load_split_frame()
    out = args.out
    (out / "images").mkdir(parents=True, exist_ok=True)

    keep = []
    for split in ("train", "val", "test"):
        part = df[df["split"] == split]
        # Take every positive for the rarest labels first, then fill randomly,
        # so the subset is not 54% "No Finding" like the full dataset.
        rare = part[part[list(LABELS)].sum(axis=1) > 0].sample(
            min(args.n // 2, len(part)), random_state=42
        )
        rest = part.drop(rare.index).sample(
            min(args.n - len(rare), len(part) - len(rare)), random_state=42
        )
        keep.append(rare)
        keep.append(rest)

    import pandas as pd

    subset = pd.concat(keep)
    for i, name in enumerate(subset["Image Index"], 1):
        shutil.copy2(resolve(name), out / "images" / name)
        if i % 250 == 0:
            print(f"  copied {i}/{len(subset)}")

    subset.drop(columns=["split", "official_split"]).to_csv(
        out / "Data_Entry_2017.csv", index=False
    )
    (out / "train_val_list.txt").write_text(
        "\n".join(subset.loc[subset.split != "test", "Image Index"]) + "\n"
    )
    (out / "test_list.txt").write_text(
        "\n".join(subset.loc[subset.split == "test", "Image Index"]) + "\n"
    )
    print(f"\nDev subset at {out} ({len(subset)} images). Point LECAD_DATA_ROOT here.")


if __name__ == "__main__":
    main()
