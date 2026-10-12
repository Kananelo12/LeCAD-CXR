import io
import math
import os
import subprocess
import sys

import numpy as np
import pytest
import torch
from conftest import png_bytes
from PIL import Image

from lecad.labels import LABELS
from lecad.metrics import evaluate
from lecad.models import build_model
from lecad.serving.inference import (
    CheckpointPredictor,
    UnsupportedImage,
    band_for,
    decode_image,
    heatmap_labels,
)


@pytest.fixture(scope="module")
def checkpoint(tmp_path_factory):
    """A random-weight DenseNet saved exactly as ml/scripts/train.py saves it."""
    rng = np.random.default_rng(0)
    y = rng.integers(0, 2, size=(200, len(LABELS)))
    y[:, -1] = 0  # a class with no positives gives NaN metrics, as can happen
    metrics = evaluate(y, rng.random((200, len(LABELS))))
    metrics["n_images"] = 200
    path = tmp_path_factory.mktemp("run") / "best.pt"
    torch.save({
        "model": build_model("densenet121", pretrained=False).state_dict(),
        "architecture": "densenet121",
        "labels": list(LABELS),
        "image_size": 224,
        "thresholds": [0.0] * (len(LABELS) - 1) + [1.0],  # flag all but the last
        "val_metrics": metrics,
        "epoch": 1,
        "config": {"name": "test"},
    }, path)
    return path


def test_checkpoint_predictor(checkpoint):
    p = CheckpointPredictor(checkpoint)
    assert p.version.startswith("densenet121-")
    assert len(p.version) == len("densenet121-") + 12
    out = p.predict(decode_image(png_bytes(size=(300, 260), colour=100)))
    assert len(out.probabilities) == len(LABELS)
    assert all(0 <= v <= 1 for v in out.probabilities)
    assert len(out.heatmaps) == 5  # capped
    for grid in out.heatmaps.values():
        assert len(grid) == len(grid[0]) == 7  # DenseNet-121 at 224 px
        assert all(0 <= v <= 1 for row in grid for v in row)


def test_checkpoint_validation_turns_nan_into_none(checkpoint):
    v = CheckpointPredictor(checkpoint).validation()
    assert v["n_images"] == 200
    assert v["per_class"]["Hernia"]["auc"] is None
    assert v["per_class"]["Hernia"]["sparse"] is True
    assert not math.isnan(v["per_class"]["Atelectasis"]["auc"])


def test_checkpoint_with_wrong_label_order_is_refused(checkpoint, tmp_path):
    ckpt = torch.load(checkpoint, weights_only=True)
    ckpt["labels"] = list(reversed(ckpt["labels"]))
    bad = tmp_path / "bad.pt"
    torch.save(ckpt, bad)
    with pytest.raises(ValueError, match="label order"):
        CheckpointPredictor(bad)


def test_band_rule():
    assert band_for(0.2, 0.2) == "above"
    assert band_for(0.1, 0.2) == "near"
    assert band_for(0.0999, 0.2) == "below"


def test_heatmap_labels_strongest_first_and_capped():
    probs = [0.9, 0.1, 0.5, 0.8, 0.7, 0.6, 0.95] + [0.0] * 7
    assert heatmap_labels(probs, [0.2] * 14) == [6, 0, 3, 4, 5]


def test_heatmap_labels_rank_relative_to_each_threshold():
    probs = [0.0] * 14
    thresholds = [0.5] * 14
    probs[0], thresholds[0] = 0.60, 0.40  # 1.5 x its level
    probs[1], thresholds[1] = 0.30, 0.10  # 3.0 x its level: ranked first despite a lower score
    assert heatmap_labels(probs, thresholds) == [1, 0]


def test_decode_rejects_decompression_bomb():
    buf = io.BytesIO()
    Image.new("1", (8000, 8000)).save(buf, "PNG")  # tiny file, 64M pixels
    assert len(buf.getvalue()) < 100_000
    with pytest.raises(UnsupportedImage, match="too many pixels"):
        decode_image(buf.getvalue())


def test_api_imports_without_dataset(tmp_path):
    """Serving machines have no dataset; importing the API must not look for one."""
    code = "import lecad.serving.app, lecad.config as c; assert 'PATHS' not in vars(c)"
    env = {**os.environ, "LECAD_DATA_ROOT": str(tmp_path / "nowhere")}
    subprocess.run([sys.executable, "-c", code], check=True, cwd=tmp_path, env=env)
