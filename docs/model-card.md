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

### Run 2: ResNet-50 (2026-10-11)

| | |
|---|---|
| Run | `resnet50-20261011-030417` |
| Code | commit `37c0a99`, config `ml/configs/resnet50.yaml` |
| Setup | As run 1, plus early stopping (patience 3) |
| Best epoch | **5**; stopped after epoch 8. 0.96 h on 1 × T4, ~7 min/epoch |
| **Macro AUC** | **0.8274** (macro PR-AUC 0.240, macro F1 0.203) |
| Adults 18+ / PA / AP | 0.8259 / 0.8279 / 0.7679 |

### Run 3: EfficientNet-B0 (2026-10-11)

| | |
|---|---|
| Run | `efficientnet-b0-20261011-041329` |
| Code | commit `37c0a99`, config `ml/configs/efficientnet_b0.yaml` |
| Setup | As run 1, plus early stopping (patience 3) |
| Best epoch | **4**; stopped after epoch 7. 0.92 h on 1 × T4, ~8 min/epoch |
| **Macro AUC** | **0.8274** (macro PR-AUC 0.225, macro F1 0.192) |
| Adults 18+ / PA / AP | 0.8259 / 0.8234 / **0.7981** |

Early stopping does not change what run 1 would have produced: the
learning-rate schedule spans 15 epochs either way, and run 1 peaked at
epoch 4, before any stop would have triggered. The three runs are
therefore comparable.

### Architecture comparison (validation)

| | DenseNet-121 | ResNet-50 | EfficientNet-B0 |
|---|---:|---:|---:|
| **Macro AUC** | **0.8297** | 0.8274 | 0.8274 |
| Macro PR-AUC | **0.247** | 0.240 | 0.225 |
| PA films | **0.8291** | 0.8279 | 0.8234 |
| AP films | 0.7812 | 0.7679 | **0.7981** |
| PA − AP gap | 0.048 | 0.060 | **0.025** |
| Adults 18+ | **0.8286** | 0.8259 | 0.8259 |
| Weights file | 28 MB | 94 MB | **16 MB** |
| Best epoch / training time | 4 / 2.1 h* | 5 / 1.0 h | 4 / 0.9 h |

\* run 1 trained all 15 epochs; with early stopping it would have taken
about 1 h.

| Finding | n pos | DenseNet-121 | ResNet-50 | EfficientNet-B0 |
|---|---:|---:|---:|---:|
| Atelectasis | 1,329 | 0.812 | 0.814 | **0.815** |
| Cardiomegaly | 273 | **0.909** | 0.894 | 0.898 |
| Effusion | 1,421 | **0.889** | 0.888 | 0.883 |
| Infiltration | 2,156 | 0.700 | **0.707** | 0.701 |
| Mass | 588 | **0.816** | 0.813 | 0.802 |
| Nodule | 756 | 0.754 | **0.766** | 0.749 |
| Pneumonia | 143 | **0.746** | 0.739 | 0.741 |
| Pneumothorax | 417 | 0.838 | 0.834 | **0.851** |
| Consolidation | 451 | 0.802 | 0.806 | **0.810** |
| Edema | 209 | **0.905** | 0.890 | 0.900 |
| Emphysema | 251 | 0.887 | 0.890 | **0.893** |
| Fibrosis | 183 | 0.802 | **0.804** | 0.794 |
| Pleural Thickening | 356 | 0.790 | **0.799** | 0.785 |
| Hernia | 22 | **0.965** | 0.938 | 0.963 |

Best per row in bold. **No architecture is ahead across the board.** The
macro AUCs lie within 0.0023 of each other. Per finding, the lead changes
hands, typically by 0.01–0.02. None of these gaps is statistically
meaningful (see *Uncertainty* below).

### Uncertainty: are the differences real?

Paired bootstrap over **patients** (2,000 rounds, seed 42;
`ml/scripts/bootstrap_compare.py`). Resampling patients rather than images
respects that one patient's radiographs are not independent. All three
models are scored on the same resampled patients in each round. Predictions
are from re-running the trained models on the T4 (`evaluate.py --name
val-gpu`); the point estimates reproduce the recorded results exactly.

**All validation images** (13,025 images, 4,201 patients):

| Model | Macro AUC | 95% CI |
|---|---:|---:|
| DenseNet-121 | 0.8297 | [0.8210, 0.8376] |
| ResNet-50 | 0.8274 | [0.8167, 0.8362] |
| EfficientNet-B0 | 0.8274 | [0.8191, 0.8347] |

| Difference | Δ AUC | 95% CI | A ahead in |
|---|---:|---:|---:|
| DenseNet-121 − EfficientNet-B0 | +0.0023 | [-0.0032, +0.0077] | 80% |
| DenseNet-121 − ResNet-50 | +0.0023 | [-0.0024, +0.0077] | 82% |
| EfficientNet-B0 − ResNet-50 | +0.0001 | [-0.0063, +0.0079] | 48% |

**AP (bedside) films only** (4,686 images, 1,196 patients):

| Model | Macro AUC | 95% CI | Excluding Hernia |
|---|---:|---:|---:|
| DenseNet-121 | 0.7812 | [0.7534, 0.8110] | 0.7829 |
| ResNet-50 | 0.7679 | [0.7295, 0.8073] | 0.7803 |
| EfficientNet-B0 | 0.7981 | [0.7759, 0.8150] | 0.7862 |

| Difference (AP only) | Δ AUC | 95% CI | A ahead in |
|---|---:|---:|---:|
| EfficientNet-B0 − DenseNet-121 | +0.0170 | [-0.0071, +0.0373] | 87% |
| EfficientNet-B0 − ResNet-50 | +0.0302 | [-0.0035, +0.0606] | 93% |
| DenseNet-121 − ResNet-50 | +0.0132 | [-0.0045, +0.0313] | 88% |

**Conclusion.** Every pairwise difference has a 95% interval spanning zero,
overall and on AP films. **The three architectures perform equivalently on
validation.**

EfficientNet-B0's apparent lead on AP films (0.798) rests largely on Hernia,
which has **2** AP positives. There, its AUC of 0.95 against 0.76 and 0.61
moves a 14-finding average by more than a point. Excluding Hernia, the AP
averages are 0.786 / 0.783 / 0.780.

Per-finding intervals overlap throughout (full table in
`ml/artifacts/comparisons/bootstrap_val-gpu.json`). Hernia's spans about
0.84–1.00 overall, confirming the sparse-label caveat.

**View-position check, all three models.** The table shows the overall AUC
minus the better of the PA-only and AP-only AUCs. A positive value means
mixing the views helps, a sign the model uses view position.

| Finding | DenseNet-121 | ResNet-50 | EfficientNet-B0 |
|---|---:|---:|---:|
| Consolidation | +0.026 | +0.030 | +0.026 |
| Pneumonia | +0.017 | -0.003 | +0.013 |
| Edema | +0.002 | +0.049 | -0.002 |
| Infiltration | -0.036 | -0.030 | -0.040 |

- **Consolidation** shows a consistent +0.026 to +0.030 in all three. This
  is the clearest evidence of a view-position contribution.
- **Edema** shows it only for ResNet-50 (+0.049), on 30 PA positives, which
  is too few to rely on.
- **Pneumonia** is mixed.
- **Infiltration** is negative in all three: the model does better within
  each view than across them.

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
  learn "AP film" rather than the finding. All three trained models show a
  view contribution for Consolidation (about +0.03 AUC); none shows a
  consistent one for Edema. All perform worse on AP films (0.768–0.798
  vs 0.823–0.829 on PA). *(EDA §6; Training runs, Architecture
  comparison)*
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
