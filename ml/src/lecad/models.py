"""Model factory — the three architectures compared in the study.

Each is an ImageNet-pretrained torchvision backbone with its classifier head
replaced by a 14-way linear layer. The head outputs LOGITS: sigmoid is
applied in the loss (BCEWithLogitsLoss) and at inference, never inside the
model, so training stays numerically stable.

Training and serving both call `build_model`, and a checkpoint records the
architecture name, so the API can rebuild exactly what was trained.
"""
from __future__ import annotations

from torch import nn
from torchvision import models

from .labels import NUM_LABELS

ARCHITECTURES = ("densenet121", "resnet50", "efficientnet_b0")


def build_model(
    architecture: str, pretrained: bool = True, num_labels: int = NUM_LABELS
) -> nn.Module:
    if architecture == "densenet121":
        weights = models.DenseNet121_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.densenet121(weights=weights)
        model.classifier = nn.Linear(model.classifier.in_features, num_labels)
    elif architecture == "resnet50":
        weights = models.ResNet50_Weights.IMAGENET1K_V2 if pretrained else None
        model = models.resnet50(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, num_labels)
    elif architecture == "efficientnet_b0":
        weights = models.EfficientNet_B0_Weights.IMAGENET1K_V1 if pretrained else None
        model = models.efficientnet_b0(weights=weights)
        head = model.classifier[-1]
        model.classifier[-1] = nn.Linear(head.in_features, num_labels)
    else:
        raise ValueError(f"Unknown architecture {architecture!r}; choose from {ARCHITECTURES}")
    return model


def gradcam_target_layer(model: nn.Module, architecture: str) -> nn.Module:
    """The last convolutional block, which Grad-CAM hooks into."""
    if architecture == "densenet121":
        return model.features[-1]
    if architecture == "resnet50":
        return model.layer4[-1]
    if architecture == "efficientnet_b0":
        return model.features[-1]
    raise ValueError(f"Unknown architecture {architecture!r}")
