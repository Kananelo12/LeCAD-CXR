# Model card — LeCAD-CXR

*Fill in as the work progresses. Written alongside development, not at the
end — it is examinable evidence of rigour and it feeds the Communication
activity of the DSRM.*

## Model details
- Architecture: _TBD (DenseNet-121 / ResNet-50 / EfficientNet-B0 compared)_
- Version / commit: _TBD (final model)_. Candidate runs below.
- Preprocessing: greyscale, resized to 256 × 256 (`prepare_image`, shared
  with the API), then 224 × 224 model input. Training reads a cache of the
  256 px images.
- Training data: NIH ChestX-ray14, official train_val split, patient-level
  train/validation partition (seed 42)

## Intended use
Decision support for qualified healthcare professionals interpreting
frontal chest radiographs. **Not** an autonomous diagnostic system, not a
registered medical device, not for clinical use.

## Out of scope
Paediatric imaging, lateral views, non-radiographic images, any use where
a clinician does not review the output.

## Metrics
Per-class and macro AUC-ROC (primary), sensitivity, specificity, precision,
F1, PR-AUC. Reported per class — aggregates hide poor performance on rare
but important findings.

## Training runs

All on validation (13,025 images, 4,201 patients). The test set is unopened.

### Run 1: DenseNet-121 baseline (2026-10-10)

| | |
|---|---|
| Run | `baseline-densenet121-20261010-201111` |
| Code | commit `6122a5c`, config `ml/configs/baseline.yaml` |
| Setup | ImageNet-pretrained, 15 epochs, AdamW lr 1e-4, cosine, batch 32, pos_weight (cap 50), seed 42 |
| Hardware | 1 × NVIDIA T4 (Lightning AI), about 8 min/epoch, 2.1 h total |
| **Best epoch** | **4 of 15** (later epochs overfit: train loss fell 0.80 → 0.34 while val AUC fell 0.830 → 0.803) |
| **Macro AUC** | **0.8297** (macro PR-AUC 0.247, macro F1 0.196 at Youden thresholds) |
| Adults 18+ | 0.8286 (12,373 images) |
| PA / AP | 0.8291 (8,339) / 0.7812 (4,686) |

| Finding | n pos | AUC | PA | AP |
|---|---:|---:|---:|---:|
| Atelectasis | 1,329 | 0.812 | 0.823 | 0.775 |
| Cardiomegaly | 273 | 0.909 | 0.935 | 0.855 |
| Effusion | 1,421 | 0.889 | 0.909 | 0.844 |
| Infiltration | 2,156 | 0.700 | 0.647 | 0.736 |
| Mass | 588 | 0.816 | 0.847 | 0.751 |
| Nodule | 756 | 0.754 | 0.748 | 0.763 |
| Pneumonia | 143 | 0.746 | 0.729 | 0.729 |
| Pneumothorax | 417 | 0.838 | 0.863 | 0.784 |
| Consolidation | 451 | 0.802 | 0.777 | 0.745 |
| Edema | 209 | 0.905 | 0.903 | 0.827 |
| Emphysema | 251 | 0.887 | 0.865 | 0.933 |
| Fibrosis | 183 | 0.802 | 0.779 | 0.674 |
| Pleural thickening | 356 | 0.790 | 0.794 | 0.760 |
| Hernia | 22 | 0.965 | 0.987 | 0.759 |

Sensitivity/specificity per class are in `eval_val.json`; their thresholds
were chosen on this same validation set, so they are optimistic.

**View-position check.** If the model leaned on "AP film" as a shortcut,
the overall AUC for a finding would sit clearly *above* both its PA-only
and AP-only AUCs, since within one view the shortcut cannot help.
- **Consolidation** (overall 0.802 vs 0.777 / 0.745) and **Pneumonia**
  (0.746 vs 0.729 / 0.729) show this pattern by 2–3 points: view position
  likely contributes to these two.
- **Edema**, the strongest AP-skewed label, does not (0.905 vs 0.903 PA).
  Within-view AUCs stay well above chance for every finding, so the model
  reads more than the view.
- Small within-view counts make some cells unreliable: Edema PA n=30,
  Fibrosis AP n=19, Hernia AP n=2.

## Limitations
- Labels are NLP-mined from reports, not image annotations.
- "No Finding" ≠ normal.
- Hernia (141 train_val images) and Pneumonia (876) are too sparse for
  reliable per-class estimates. Validation holds only about 22 Hernia and
  143 Pneumonia images. **Decision (2026-10-06, with supervisor): all 14
  labels retained.** The task is multi-label with an independent output per
  finding, so sparse labels are trained and reported, with that caveat.
- Training data come from a single US institution. Population, equipment
  and disease prevalence differ from Lesotho; performance is not assumed to
  transfer and local validation is required before any clinical use.
- Test set prevalence is systematically higher than train_val, so
  threshold-dependent metrics shift between validation and test.
- View position confounds labels: Edema is 11× and Consolidation 2.8×
  more prevalent on AP (often bedside) films than PA. The model may partly
  learn "AP film" rather than the finding. Run 1 shows a modest view
  contribution for Consolidation and Pneumonia, not Edema, and lower
  performance on AP films overall (0.781 vs 0.829). *(EDA §6; Training
  runs, Run 1)*
- Most films carry burned-in laterality markers, and AP films often show
  ECG leads and lines. These are potential shortcut features, to be checked
  with Grad-CAM. *(EDA §8)*
- 4.8% of training images are from patients under 18, although paediatric
  use is out of scope. **Decision (2026-10-06): retained** for
  comparability with published results on this dataset. An adults-only
  (18+) validation result is reported alongside the overall one. *(EDA §5)*
- The class-weight cap (50) under-weights the five rarest classes; Hernia
  by about 12×. *(EDA §2)*

## Ethical considerations
No patient-identifiable data used. Images are from a public de-identified
dataset used under the terms of its release. Automation bias mitigated by
presenting graded likelihood with Grad-CAM evidence rather than categorical
assertion.
