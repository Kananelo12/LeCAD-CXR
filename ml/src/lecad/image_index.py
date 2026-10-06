"""Resolve an image filename to its path on disk.

ChestX-ray14 does not ship as one flat folder. It unpacks into twelve
shards, each with its own `images/` subfolder:

    <data_root>/images_001/images/00000001_000.png
    <data_root>/images_002/images/...

The metadata CSV and the split lists only give bare filenames, so something
has to map name -> full path. That is this module. It scans once, caches the
result, and is the single place that knows about the shard layout — if the
Kaggle copy or a future download is arranged differently, only this file
changes.
"""
from __future__ import annotations

import hashlib
import json
import os
from functools import lru_cache
from pathlib import Path

from .config import PATHS


def _cache_name() -> str:
    """One cache per data root, so switching between the full archive and
    the dev subset can never serve a stale index."""
    key = hashlib.sha1(str(PATHS.data_root.resolve()).encode()).hexdigest()[:10]
    return f"image_index_{key}.json"


def _scan(data_root: Path) -> dict[str, str]:
    """Walk the shards and build {filename: path-relative-to-data_root}."""
    index: dict[str, str] = {}

    shard_dirs = sorted(data_root.glob("images_*"))
    if not shard_dirs:
        # Some copies are already flat: <data_root>/images/*.png
        flat = data_root / "images"
        if flat.is_dir():
            shard_dirs = [data_root]
        else:
            raise FileNotFoundError(
                f"No image folders found under {data_root}. Expected either "
                "images_001/images/... or images/..."
            )

    for shard in shard_dirs:
        images_dir = shard / "images"
        if not images_dir.is_dir():
            continue
        with os.scandir(images_dir) as it:
            for entry in it:
                if entry.name.endswith(".png"):
                    index[entry.name] = str(
                        Path(entry.path).relative_to(data_root).as_posix()
                    )

    if not index:
        raise FileNotFoundError(f"Found shard folders under {data_root} but no PNGs.")
    return index


@lru_cache(maxsize=1)
def get_index(refresh: bool = False) -> dict[str, str]:
    """Filename -> relative path. Cached on disk; scanning is the slow part."""
    cache_file = PATHS.cache / _cache_name()

    if cache_file.exists() and not refresh:
        with cache_file.open(encoding="utf-8") as fh:
            return json.load(fh)

    index = _scan(PATHS.data_root)
    PATHS.cache.mkdir(parents=True, exist_ok=True)
    tmp = cache_file.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(index, fh)
    tmp.replace(cache_file)  # atomic: a reader never sees a half-written file
    return index


def resolve(filename: str) -> Path:
    """Absolute path for one image filename."""
    index = get_index()
    try:
        return PATHS.data_root / index[filename]
    except KeyError as exc:
        raise KeyError(
            f"{filename} is not in the dataset at {PATHS.data_root}. "
            "If images were added under this root, delete ml/.cache/ and retry."
        ) from exc
