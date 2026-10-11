"""Train one model from one config.

    python ml/scripts/train.py --config ml/configs/baseline.yaml

Laptop check (a couple of minutes on CPU, proves the loop end to end):

    python ml/scripts/train.py --config ml/configs/baseline.yaml \\
        --limit 64 --epochs 1 --num-workers 0 --no-pretrained

Each run writes to <artifacts>/runs/<name>-<timestamp>/:
    config.yaml     the exact config used, plus CLI overrides
    history.jsonl   one line of metrics per epoch
    best.pt         highest validation macro AUC (what gets evaluated/served)
    last.pt         latest epoch, for --resume after a Kaggle session ends

Model selection uses VALIDATION only. The test set is never touched here.

Early stopping: with optim.early_stopping_patience set, training ends once the
validation macro AUC has not improved for that many epochs. The learning-rate
schedule still spans optim.epochs, so a stopped run follows exactly the path a
full-length run would have taken up to that point, and best.pt is identical.
"""
from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import numpy as np
import torch
import yaml
from torch import nn
from tqdm import tqdm

import lecad
from lecad.config import IMAGE_SIZE, PATHS, SEED
from lecad.data import build_loader, positive_weights
from lecad.labels import LABELS
from lecad.metrics import evaluate
from lecad.models import build_model


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True, type=Path)
    ap.add_argument("--limit", type=int, help="images per split (debugging only)")
    ap.add_argument("--epochs", type=int, help="override optim.epochs")
    ap.add_argument("--batch-size", type=int, help="override data.batch_size")
    ap.add_argument("--num-workers", type=int, help="override data.num_workers")
    ap.add_argument("--no-pretrained", action="store_true", help="skip weight download")
    ap.add_argument("--resume", type=Path, help="run directory to continue from last.pt")
    return ap.parse_args()


def seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)


def git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=Path(__file__).parent, text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


@torch.no_grad()
def predict(model: nn.Module, loader, device: torch.device, amp: bool):
    model.eval()
    probs, targets = [], []
    for images, y in tqdm(loader, desc="  val", leave=False):
        with torch.autocast(device.type, enabled=amp):
            logits = model(images.to(device, non_blocking=True))
        probs.append(torch.sigmoid(logits.float()).cpu().numpy())
        targets.append(y.numpy())
    return np.concatenate(targets), np.concatenate(probs)


def main() -> None:
    args = parse_args()

    if args.resume:
        run_dir = args.resume
        cfg = yaml.safe_load((run_dir / "config.yaml").read_text())
    else:
        cfg = yaml.safe_load(args.config.read_text())
        for key, section, value in (
            ("epochs", "optim", args.epochs),
            ("batch_size", "data", args.batch_size),
            ("num_workers", "data", args.num_workers),
        ):
            if value is not None:
                cfg[section][key] = value
        if args.no_pretrained:
            cfg["model"]["pretrained"] = False
        if args.limit:
            cfg["data"]["limit"] = args.limit
        cfg["seed"] = SEED
        cfg["git_commit"] = git_commit()
        cfg["lecad_version"] = lecad.__version__

        stamp = time.strftime("%Y%m%d-%H%M%S")
        run_dir = PATHS.artifacts / "runs" / f"{cfg['name']}-{stamp}"
        run_dir.mkdir(parents=True)
        (run_dir / "config.yaml").write_text(yaml.safe_dump(cfg, sort_keys=False))

    if cfg["data"]["image_size"] != IMAGE_SIZE:
        raise ValueError(
            f"Config image_size {cfg['data']['image_size']} != transforms IMAGE_SIZE "
            f"{IMAGE_SIZE}. Change it in config.py so serving changes with it."
        )

    seed_everything(cfg["seed"])
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    amp = device.type == "cuda"
    print(f"run dir : {run_dir}\ndevice  : {device}\ndata    : {PATHS.data_root}")

    limit = cfg["data"].get("limit")
    workers = cfg["data"]["num_workers"]
    loader_kw = {"persistent_workers": workers > 0}
    train_loader = build_loader(
        "train", cfg["data"]["batch_size"], workers, limit=limit, **loader_kw
    )
    val_loader = build_loader(
        "val", cfg["data"]["batch_size"] * 2, workers, limit=limit, **loader_kw
    )
    print(f"images  : train {len(train_loader.dataset)}, val {len(val_loader.dataset)}")

    model = build_model(cfg["model"]["architecture"], cfg["model"]["pretrained"]).to(device)

    pos_weight = None
    if cfg["optim"]["use_pos_weight"]:
        pos_weight = positive_weights(train_loader.dataset.frame).to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    optimizer = torch.optim.AdamW(
        model.parameters(), lr=cfg["optim"]["lr"], weight_decay=cfg["optim"]["weight_decay"]
    )
    epochs = cfg["optim"]["epochs"]
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)
    scaler = torch.amp.GradScaler(device.type, enabled=amp)

    patience = cfg["optim"].get("early_stopping_patience")
    start_epoch, best_auc, best_epoch = 1, -1.0, 0
    if args.resume:
        state = torch.load(run_dir / "last.pt", map_location=device, weights_only=False)
        model.load_state_dict(state["model"])
        optimizer.load_state_dict(state["optimizer"])
        scheduler.load_state_dict(state["scheduler"])
        scaler.load_state_dict(state["scaler"])
        start_epoch, best_auc = state["epoch"] + 1, state["best_auc"]
        best_epoch = state.get("best_epoch", state["epoch"])
        if patience and state["epoch"] - best_epoch >= patience:
            start_epoch = epochs + 1  # this run already stopped early; nothing to resume
        print(f"resumed : from epoch {state['epoch']}, best macro AUC {best_auc:.4f}")

    for epoch in range(start_epoch, epochs + 1):
        model.train()
        t0, running, seen = time.time(), 0.0, 0
        bar = tqdm(train_loader, desc=f"epoch {epoch}/{epochs}", leave=False)
        for images, targets in bar:
            images = images.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(device.type, enabled=amp):
                loss = criterion(model(images), targets)
            scaler.scale(loss).backward()
            scaler.step(optimizer)
            scaler.update()
            running += loss.item() * len(images)
            seen += len(images)
            bar.set_postfix(loss=f"{running / seen:.4f}")
        scheduler.step()

        y, p = predict(model, val_loader, device, amp)
        metrics = evaluate(y, p)
        metrics["n_images"] = len(y)  # the API reports it (GET /model)
        record = {
            "epoch": epoch,
            "train_loss": running / max(seen, 1),
            "val_macro_auc": metrics["macro_auc"],
            "val_macro_pr_auc": metrics["macro_pr_auc"],
            "val_auc": {k: v["auc"] for k, v in metrics["per_class"].items()},
            "lr": optimizer.param_groups[0]["lr"],
            "seconds": round(time.time() - t0, 1),
        }
        with (run_dir / "history.jsonl").open("a") as fh:
            fh.write(json.dumps(record) + "\n")
        print(
            f"epoch {epoch:>2}  loss {record['train_loss']:.4f}  "
            f"val macro AUC {metrics['macro_auc']:.4f}  ({record['seconds']}s)"
        )

        checkpoint = {
            "model": model.state_dict(),
            "architecture": cfg["model"]["architecture"],
            "labels": list(LABELS),
            "image_size": IMAGE_SIZE,
            # Chosen on validation, applied unchanged at test and in the API.
            "thresholds": [m["threshold"] for m in metrics["per_class"].values()],
            "val_metrics": metrics,
            "epoch": epoch,
            "config": cfg,
        }
        score = float(np.nan_to_num(metrics["macro_auc"], nan=0.0))
        if score > best_auc:
            best_auc, best_epoch = score, epoch
            torch.save(checkpoint, run_dir / "best.pt")
            (run_dir / "best_val_metrics.json").write_text(json.dumps(metrics, indent=2))
            print("          new best -> best.pt")
        torch.save(
            {
                **checkpoint,
                "optimizer": optimizer.state_dict(),
                "scheduler": scheduler.state_dict(),
                "scaler": scaler.state_dict(),
                "best_auc": best_auc,
                "best_epoch": best_epoch,
            },
            run_dir / "last.pt",
        )

        if patience and epoch - best_epoch >= patience and epoch < epochs:
            print(f"          no improvement for {patience} epochs: stopping early")
            break

    print(f"\nDone. Best validation macro AUC {best_auc:.4f} (epoch {best_epoch}). "
          f"Run: {run_dir}")


if __name__ == "__main__":
    main()
