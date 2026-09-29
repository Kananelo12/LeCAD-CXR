"""Image preprocessing — imported by BOTH training and the API.

This is the most important file in the repository for correctness.

If training resizes one way and the API resizes another, the model will
score well offline and produce nonsense in the app, with no error message
anywhere. Serving imports `build_transform("eval")`, training imports
`build_transform("train")`, and they share the same eval path. Never
reimplement any of this in the API.
"""
from __future__ import annotations

from typing import Literal

from torchvision import transforms

from .config import IMAGE_SIZE, IMAGENET_MEAN, IMAGENET_STD

Stage = Literal["train", "eval"]


def build_transform(stage: Stage = "eval", image_size: int = IMAGE_SIZE):
    """Return the torchvision transform pipeline for a given stage.

    Chest radiographs are NOT horizontally symmetric — the heart sits left,
    and Cardiomegaly is one of your 14 labels. Horizontal flipping is
    therefore deliberately excluded: it would teach the model that
    dextrocardia is normal. Augmentation here is limited to small
    rotations and mild intensity jitter, which reflect real positioning
    and exposure variation.
    """
    normalise = [
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
    ]

    if stage == "eval":
        return transforms.Compose(
            [
                transforms.Grayscale(num_output_channels=3),
                transforms.Resize((image_size, image_size)),
                *normalise,
            ]
        )

    return transforms.Compose(
        [
            transforms.Grayscale(num_output_channels=3),
            transforms.Resize((int(image_size * 1.14), int(image_size * 1.14))),
            transforms.RandomRotation(degrees=7),
            transforms.RandomResizedCrop(
                image_size, scale=(0.85, 1.0), ratio=(0.95, 1.05)
            ),
            transforms.ColorJitter(brightness=0.15, contrast=0.15),
            *normalise,
        ]
    )
