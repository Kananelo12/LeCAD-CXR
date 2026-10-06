# Model card — LeCAD-CXR

*Fill in as the work progresses. Written alongside development, not at the
end — it is examinable evidence of rigour and it feeds the Communication
activity of the DSRM.*

## Model details
- Architecture: _TBD (DenseNet-121 / ResNet-50 / EfficientNet-B0 compared)_
- Version / commit: _TBD_
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
  learn "AP film" rather than the finding. Validation AUC is to be reported
  per view. *(EDA, docs/eda-summary.md §6)*
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
