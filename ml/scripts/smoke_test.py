"""The thin end-to-end slice. Run this BEFORE any real training.

    python ml/scripts/smoke_test.py

Loads a handful of images, runs one forward and one backward pass, computes
one AUC, and exits. It proves the whole path works: data root -> image index
-> transform -> dataset -> model -> loss -> metric. When this passes, the
only thing left is scale.

If it fails, fix that before touching anything else.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import torch  # noqa: E402
from sklearn.metrics import roc_auc_score  # noqa: E402
from torch import nn  # noqa: E402

from lecad.config import PATHS  # noqa: E402
from lecad.data import build_loader  # noqa: E402
from lecad.labels import NUM_LABELS  # noqa: E402


def main() -> None:
    print(f"data root : {PATHS.data_root}")
    PATHS.check()

    loader = build_loader("train", batch_size=8, num_workers=0, limit=32)
    images, targets = next(iter(loader))
    print(f"batch     : images {tuple(images.shape)}, targets {tuple(targets.shape)}")
    assert images.shape[1:] == (3, 224, 224), "unexpected image shape"
    assert targets.shape[1] == NUM_LABELS

    from torchvision.models import densenet121

    model = densenet121(weights=None)
    model.classifier = nn.Linear(model.classifier.in_features, NUM_LABELS)

    logits = model(images)
    loss = nn.BCEWithLogitsLoss()(logits, targets)
    loss.backward()
    print(f"forward   : logits {tuple(logits.shape)}, loss {loss.item():.4f}")

    probs = torch.sigmoid(logits).detach().numpy()
    scored = [
        i for i in range(NUM_LABELS) if len(set(targets[:, i].numpy().tolist())) > 1
    ]
    if scored:
        auc = roc_auc_score(targets.numpy()[:, scored], probs[:, scored], average="macro")
        print(f"metric    : macro AUC on this batch {auc:.3f} (meaningless, but it runs)")
    else:
        print("metric    : batch had no positive/negative mix — fine, path still works")

    print("\nSmoke test passed. The pipeline is wired end to end.")


if __name__ == "__main__":
    main()
