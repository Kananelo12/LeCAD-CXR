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
  reliable per-class estimates.
- Training data come from a single US institution. Population, equipment
  and disease prevalence differ from Lesotho; performance is not assumed to
  transfer and local validation is required before any clinical use.
- Test set prevalence is systematically higher than train_val, so
  threshold-dependent metrics shift between validation and test.

## Ethical considerations
No patient-identifiable data used. Images are from a public de-identified
dataset used under the terms of its release. Automation bias mitigated by
presenting graded likelihood with Grad-CAM evidence rather than categorical
assertion.
