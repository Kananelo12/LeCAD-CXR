"""Store the dataset already passed through prepare_image(), for fast training.

    python ml/scripts/make_resized_cache.py --out ~/data/nih-256

Reads the dataset at LECAD_DATA_ROOT (the original 1024px images) and writes
a new dataset root:

    <out>/images/<name>.png       prepare_image(original): greyscale, 256x256
    <out>/Data_Entry_2017.csv     copied byte for byte (the split manifest's
    <out>/train_val_list.txt      metadata hash stays valid)
    <out>/test_list.txt
    <out>/CACHE_INFO.json         what was built, from where, at what size

Then point LECAD_DATA_ROOT at <out>; every script runs unchanged.

The images are produced by lecad.transforms.prepare_image itself, the function
training and the API both call, so the cache cannot drift from the pipeline.
PNG is lossless: nothing is lost beyond the resize. Test images are converted
too (they are needed for the final evaluation) but never looked at.

Safe to stop and rerun: images already written are skipped.

--limit N converts only the first N images of each split and writes matching
metadata, for a quick check on the laptop. Never use a limited cache for
real training.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from PIL import Image

import lecad
from lecad.config import CACHE_SIZE, PATHS
from lecad.image_index import get_index, resolve
from lecad.splits import load_split_frame
from lecad.transforms import prepare_image


def convert(task: tuple[str, str]) -> bool:
    """Write one cached image; False if it already existed."""
    name, out_dir = task
    target = Path(out_dir) / name
    if target.exists():
        return False
    with Image.open(resolve(name)) as img:
        small = prepare_image(img)
    tmp = target.with_name(target.name + ".tmp")
    small.save(tmp, format="PNG")
    tmp.replace(target)  # a stopped run never leaves a half-written image
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 1)
    ap.add_argument("--limit", type=int, help="images per split, for a laptop check only")
    args = ap.parse_args()

    out = args.out.expanduser().resolve()
    if out == PATHS.data_root.resolve():
        raise SystemExit("--out must differ from LECAD_DATA_ROOT (the originals).")
    (out / "images").mkdir(parents=True, exist_ok=True)

    PATHS.check()
    get_index()  # build the filename index once, before the workers start
    frame = load_split_frame()

    if args.limit:
        frame = frame.groupby("split", group_keys=False).head(args.limit)
        cols = [c for c in frame.columns if c in _original_columns()]
        frame[cols].to_csv(out / "Data_Entry_2017.csv", index=False)
        for name, splits in (("train_val_list.txt", ("train", "val")),
                             ("test_list.txt", ("test",))):
            names = frame.loc[frame["split"].isin(splits), "Image Index"]
            (out / name).write_text("\n".join(names) + "\n")
    else:
        for name in ("Data_Entry_2017.csv", "train_val_list.txt", "test_list.txt",
                     "BBox_List_2017.csv"):
            if (PATHS.data_root / name).exists():
                shutil.copyfile(PATHS.data_root / name, out / name)

    names = frame["Image Index"].tolist()
    print(f"source : {PATHS.data_root}\ntarget : {out}\nimages : {len(names):,} "
          f"at {CACHE_SIZE}x{CACHE_SIZE}, {args.workers} workers")

    t0, written, done = time.time(), 0, 0
    tasks = [(n, str(out / "images")) for n in names]
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        for created in pool.map(convert, tasks, chunksize=64):
            written += created
            done += 1
            if done % 5000 == 0 or done == len(tasks):
                rate = done / max(time.time() - t0, 1e-9)
                eta = (len(tasks) - done) / rate / 60
                print(f"  {done:>7,}/{len(tasks):,}  ({rate:.0f}/s, ~{eta:.0f} min left)",
                      flush=True)

    on_disk = len(list((out / "images").glob("*.png")))
    if on_disk < len(names):
        raise SystemExit(f"Only {on_disk:,} of {len(names):,} images present; rerun.")

    info = {
        "cache_size": CACHE_SIZE,
        "images": len(names),
        "limited": bool(args.limit),
        "source": str(PATHS.data_root),
        "lecad_version": lecad.__version__,
        "built": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    (out / "CACHE_INFO.json").write_text(json.dumps(info, indent=2))
    size_gb = sum(p.stat().st_size for p in (out / "images").glob("*.png")) / 1e9
    print(f"\nDone: {written:,} written, {len(names) - written:,} already present, "
          f"{size_gb:.2f} GB.\nNow set LECAD_DATA_ROOT={out}")


def _original_columns() -> set[str]:
    import pandas as pd

    return {c.strip() for c in pd.read_csv(PATHS.metadata_csv, nrows=0).columns}


if __name__ == "__main__":
    main()
