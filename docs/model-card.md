# Model card — LeCAD-CXR

*Fill in as the work progresses. Written alongside development, not at the
end — it is examinable evidence of rigour and it feeds the Communication
activity of the DSRM.*

## Model details
- Architecture: **DenseNet-121** (selected from DenseNet-121, ResNet-50 and
  EfficientNet-B0; see *Model selection and operating point*)
- Version: run `baseline-densenet121-20261010-201111` (code `6122a5c`),
  deployed as `model_sens90.pt` (sha256 `00cd10b12611…`) with a 90%-sensitivity
  operating point
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
Per-class and macro AUC-ROC, sensitivity, specificity, precision, F1,
PR-AUC. Reported per class, because aggregates hide poor performance on
rare but important findings.

**Sensitivity is the clinically primary metric**: a missed case is the
costly error in decision support. Models are compared on specificity at a
fixed 90% sensitivity, and the deployed thresholds target at least 90%
sensitivity per finding. AUC-ROC remains the threshold-free summary of
discrimination.

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

**Specificity at 90% sensitivity.** In decision support a missed case is
the costly error: a patient with disease is reassured. Sensitivity is
therefore the clinically primary metric. Models are compared fairly on it by
fixing sensitivity at 90% (each finding's threshold set to catch 9 in 10
cases) and comparing how many healthy images are then correctly left
unflagged. Same patient-level bootstrap:

| Model | Macro specificity @ 90% sens. | 95% CI |
|---|---:|---:|
| DenseNet-121 | 0.546 | [0.505, 0.570] |
| ResNet-50 | 0.538 | [0.477, 0.566] |
| EfficientNet-B0 | 0.556 | [0.518, 0.573] |

| Difference | Δ | 95% CI | A ahead in |
|---|---:|---:|---:|
| EfficientNet-B0 − DenseNet-121 | +0.009 | [-0.022, +0.038] | 65% |
| EfficientNet-B0 − ResNet-50 | +0.018 | [-0.016, +0.066] | 77% |
| DenseNet-121 − ResNet-50 | +0.009 | [-0.015, +0.034] | 73% |

Equivalent again: every interval spans zero.

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

## Model selection and operating point (decided 2026-10-12)

**Chosen model: DenseNet-121** (run 1, `baseline-densenet121-20261010-201111`).

**Why.** The three architectures are statistically equivalent on every
comparison made:
- macro AUC, overall and on AP films
- specificity at 90% sensitivity

All 95% intervals for the differences span zero (see *Uncertainty*). With no
evidence that an alternative is better, the **pre-specified baseline is
kept**. Switching on a non-significant difference would be choosing on
noise. DenseNet-121 is also the standard architecture in the chest X-ray
literature (e.g. CheXNet), which aids comparison with published work. Its
28 MB weights and sub-second CPU inference suit the API.

**Operating point: at least 90% sensitivity per finding.** The thresholds
saved by training (Youden's J) weigh a miss and a false alarm equally. At
those, the model missed about 40% of Nodules and Infiltrations. The deployed
model instead uses, for each finding, the highest threshold that still
flags ≥ 90% of validation cases. It keeps the Youden threshold where that
was already more sensitive (Cardiomegaly 0.93, Hernia 0.91). The accepted
cost is more false alarms; every flag is reviewed by a clinician.

Thresholds were chosen on **validation only**
(`ml/scripts/set_operating_point.py`), before the test set is opened. The
test evaluation measures how well this pre-chosen operating point holds.

| | |
|---|---|
| Deployment file | `ml/artifacts/runs/baseline-densenet121-20261010-201111/model_sens90.pt` (sha256 `00cd10b12611…`) |
| Weights | identical to run 1 `best.pt` |
| Thresholds | `operating_point_sens90.json` alongside |

| Finding | n pos | Youden: sens / spec | **Deployed: sens / spec** | Threshold |
|---|---:|---:|---:|---:|
| Atelectasis | 1,329 | 0.788 / 0.695 | **0.901** / 0.531 | 0.353 |
| Cardiomegaly | 273 | 0.930 / 0.740 | **0.930** / 0.740 | 0.377 |
| Effusion | 1,421 | 0.849 / 0.794 | **0.900** / 0.721 | 0.390 |
| Infiltration | 2,156 | 0.596 / 0.687 | **0.901** / 0.311 | 0.321 |
| Mass | 588 | 0.684 / 0.807 | **0.901** / 0.415 | 0.184 |
| Nodule | 756 | 0.603 / 0.792 | **0.902** / 0.321 | 0.251 |
| Pneumonia | 143 | 0.783 / 0.595 | **0.902** / 0.366 | 0.194 |
| Pneumothorax | 417 | 0.791 / 0.760 | **0.902** / 0.529 | 0.115 |
| Consolidation | 451 | 0.763 / 0.738 | **0.900** / 0.518 | 0.279 |
| Edema | 209 | 0.900 / 0.759 | **0.904** / 0.732 | 0.275 |
| Emphysema | 251 | 0.781 / 0.855 | **0.900** / 0.617 | 0.102 |
| Fibrosis | 183 | 0.787 / 0.677 | **0.902** / 0.453 | 0.152 |
| Pleural Thickening | 356 | 0.711 / 0.747 | **0.902** / 0.424 | 0.229 |
| Hernia | 22 | 0.909 / 0.949 | **0.909** / 0.949 | 0.231 |

(Validation figures; thresholds were fitted to these images, so these
sensitivities hold by construction. The test set gives the honest figures.)

## Test results (opened once, 2026-10-12)

The official NIH test set: 25,596 images, 2,797 patients, never used for any
decision. It was evaluated **once**, with the deployed model
(`model_sens90.pt`) and its pre-chosen thresholds, on 1 × T4. The thresholds
rebuilt on Lightning matched the recorded ones exactly. 95% CIs come from a
patient-level bootstrap (2,000 rounds, `bootstrap_compare.py --name test`).

| | Test | 95% CI | Validation |
|---|---:|---:|---:|
| **Macro AUC** | **0.7983** | [0.7914, 0.8040] | 0.8297 |
| **Macro sensitivity** (fixed thresholds) | **0.9213** | [0.9093, 0.9324] | 0.904 |
| Macro specificity (fixed thresholds) | 0.4015 | [0.3921, 0.4114] | 0.545 |
| PA / AP macro AUC | 0.7936 / 0.7732 | | 0.8291 / 0.7812 |
| Adults 18+ macro AUC | 0.7988 | | 0.8286 |
| AP share of images | 57% | | 36% |

| Finding | n pos | AUC [95% CI] | Sensitivity [95% CI] | Specificity [95% CI] | Val AUC | Val sens / spec |
|---|---:|---:|---:|---:|---:|---:|
| Atelectasis | 3,279 | 0.751 [0.74, 0.76] | 0.919 [0.90, 0.93] | 0.347 [0.32, 0.37] | 0.812 | 0.901 / 0.531 |
| Cardiomegaly | 1,069 | 0.892 [0.88, 0.90] | 0.929 [0.91, 0.95] | 0.626 [0.60, 0.65] | 0.909 | 0.930 / 0.740 |
| Effusion | 4,658 | 0.817 [0.81, 0.83] | 0.940 [0.93, 0.95] | 0.447 [0.42, 0.47] | 0.889 | 0.900 / 0.721 |
| Infiltration | 6,112 | 0.697 [0.69, 0.71] | 0.960 [0.95, 0.97] | 0.132 [0.12, 0.14] | 0.700 | 0.901 / 0.311 |
| Mass | 1,748 | 0.812 [0.79, 0.83] | 0.965 [0.95, 0.97] | 0.277 [0.26, 0.30] | 0.816 | 0.901 / 0.415 |
| Nodule | 1,623 | 0.732 [0.71, 0.75] | 0.938 [0.92, 0.95] | 0.240 [0.22, 0.26] | 0.754 | 0.902 / 0.321 |
| Pneumonia | 555 | 0.695 [0.67, 0.72] | 0.942 [0.92, 0.96] | 0.227 [0.21, 0.24] | 0.746 | 0.902 / 0.366 |
| Pneumothorax | 2,665 | 0.849 [0.83, 0.86] | 0.957 [0.94, 0.97] | 0.422 [0.40, 0.45] | 0.838 | 0.902 / 0.529 |
| Consolidation | 1,815 | 0.739 [0.72, 0.75] | 0.971 [0.96, 0.98] | 0.227 [0.21, 0.24] | 0.802 | 0.900 / 0.518 |
| Edema | 925 | 0.834 [0.82, 0.85] | 0.948 [0.93, 0.96] | 0.475 [0.45, 0.50] | 0.905 | 0.904 / 0.732 |
| Emphysema | 1,093 | 0.889 [0.87, 0.90] | 0.944 [0.92, 0.96] | 0.513 [0.49, 0.54] | 0.887 | 0.900 / 0.617 |
| Fibrosis | 435 | 0.804 [0.78, 0.83] | 0.913 [0.88, 0.94] | 0.425 [0.40, 0.45] | 0.802 | 0.902 / 0.453 |
| Pleural Thickening | 1,143 | 0.759 [0.74, 0.78] | 0.945 [0.93, 0.96] | 0.306 [0.28, 0.33] | 0.790 | 0.902 / 0.424 |
| Hernia | 86 | 0.906 [0.85, 0.95] | 0.628 [0.47, 0.77] | 0.957 [0.95, 0.96] | 0.965 | 0.909 / 0.949 |

**Findings.**
1. **Discrimination: macro AUC 0.798 [0.791, 0.804].** This is lower than
   validation (0.830, outside the test interval), so the drop is real. It is
   consistent with the known shift between NIH train_val and test:
   - the test set has more disease (see `splits.py`)
   - 57% of test images are AP films, against 36% in validation, and every
     model is weaker on AP films

   To be compared with published results on the same official split
   (literature review chapter).
2. **The sensitivity objective holds for 13 of 14 findings**, at 0.91–0.97
   on unseen data. Lower CI bounds are at or near 0.90 throughout (lowest:
   Fibrosis 0.88). On these images, scores run higher than on validation, so
   the fixed thresholds catch *more* than the 90% target.
3. **Hernia fails the objective: sensitivity 0.628 [0.47, 0.77].** Its
   threshold was fitted to 22 validation cases, too few to fix a reliable
   operating point. Its AUC remains high (0.906), so the model ranks Hernia
   well; it is the threshold that did not transfer.
4. **Specificity fell sharply** (macro 0.40; Infiltration 0.13, Nodule 0.24,
   Pneumonia and Consolidation 0.23). The same score shift that raised
   sensitivity raises false alarms. A threshold fitted to one population
   drifts on another, which is direct evidence for the local
   re-calibration requirement in *Limitations*.

Under the DSRM, finding 3 is an objective not met: it is to be taken back to
design and development (e.g. a Hernia threshold fitted with more positives,
or Hernia reported only as a ranked score). This must not be fixed by tuning
on the test set.

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
- At the 90%-sensitivity operating point, specificity is low for some
  findings: 0.31 for Infiltration and 0.32 for Nodule on validation, and
  0.13 and 0.24 on test. About
  two in three healthy images get flagged for those findings. The output is
  only usable as decision support reviewed by a clinician, never as a
  diagnosis.
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
- Thresholds do not transfer reliably. On test, sensitivity rose and
  specificity fell for every finding. Hernia's threshold, fitted to 22
  cases, caught only 63% of test cases. Any new population (including
  Lesotho) needs thresholds re-fitted on local validation data.

## Ethical considerations
No patient-identifiable data used. Images are from a public de-identified
dataset used under the terms of its release. Automation bias mitigated by
presenting graded likelihood with Grad-CAM evidence rather than categorical
assertion.
