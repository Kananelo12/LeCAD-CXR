"""The 14 ChestX-ray14 pathology labels, in the dataset's own order.

Import this everywhere. Never retype the list — a reordering bug between
training and serving silently mislabels every prediction, and nothing
will crash to tell you.
"""
from __future__ import annotations

LABELS: tuple[str, ...] = (
    "Atelectasis",
    "Cardiomegaly",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
    "Pneumonia",
    "Pneumothorax",
    "Consolidation",
    "Edema",
    "Emphysema",
    "Fibrosis",
    "Pleural_Thickening",
    "Hernia",
)

NUM_LABELS = len(LABELS)
LABEL_TO_IDX = {name: i for i, name in enumerate(LABELS)}

# "No Finding" means none of the 14 above were found in the report.
# Per the NIH FAQ this is NOT the same as "normal" — the image may hold
# findings outside these 14, or findings the NLP marked as uncertain.
NO_FINDING = "No Finding"

# Train_val counts, for reference. Anything under ~1000 will not produce a
# trustworthy per-class AUC; report it with a caveat or exclude it.
SPARSE_LABELS: tuple[str, ...] = ("Hernia", "Pneumonia", "Fibrosis")
