# EDA summary: NIH ChestX-ray14 (train + validation)

Source: `ml/notebooks/01_eda.ipynb`, executed 2026-10-06. Figures are in
`docs/figures/eda/`.

**Scope.** 86,524 images from 28,008 patients: the NIH `train_val` list,
split by patient into train (73,499) and validation (13,025). The official
test set (25,596 images) was excluded before any analysis and remains
unseen.

> Some figures here differ from those quoted elsewhere for the *whole*
> dataset (for example "No Finding" 53.8% over all 112,120 images vs 58.4%
> here). The difference is the test set, which is enriched for disease.
> Quote train+val figures when describing the training data.

---

## 1. The split is clean and balanced

| | Images | Patients | Images / patient |
|---|---:|---:|---:|
| Train | 73,499 | 23,807 | 3.09 |
| Validation | 13,025 | 4,201 | 3.10 |

- **0 patients** appear in both train and validation. **0** duplicate files.
- Label prevalence is closely matched across the two
  (`01_label_prevalence.png`). The largest gap is 1.1 percentage points
  (Effusion: 9.8% train vs 10.9% validation).

## 2. Severe and uneven class imbalance

58.4% of images are "No Finding". This means none of the 14 findings was
reported, **not** that the film is normal.

| Finding | Images | % | Negatives per positive |
|---|---:|---:|---:|
| Infiltration | 13,782 | 15.9 | 5 |
| Effusion | 8,659 | 10.0 | 9 |
| Atelectasis | 8,280 | 9.6 | 9 |
| Nodule | 4,708 | 5.4 | 17 |
| Mass | 4,034 | 4.7 | 20 |
| Consolidation | 2,852 | 3.3 | 29 |
| Pneumothorax | 2,637 | 3.0 | 32 |
| Pleural thickening | 2,242 | 2.6 | 38 |
| Cardiomegaly | 1,707 | 2.0 | 50 |
| Emphysema | 1,423 | 1.6 | 60 |
| Edema | 1,378 | 1.6 | 62 |
| Fibrosis | 1,251 | 1.4 | 68 |
| Pneumonia | 876 | 1.0 | 98 |
| Hernia | 141 | 0.16 | 613 |

**Implications**
- AUC-ROC as the primary metric is justified. Accuracy would reward
  predicting "nothing".
- The loss weights each class by its negative:positive ratio, **capped at
  50** (`lecad.data.positive_weights`). The cap binds for five classes:
  Emphysema, Edema, Fibrosis, Pneumonia and Hernia. Hernia is
  under-weighted by a factor of about 12. This is a deliberate stability
  trade-off and should be stated as one.
- Validation holds only about **22 Hernia** and about **143 Pneumonia**
  images. Their per-class AUCs will have wide uncertainty and should be
  reported with that caveat (ideally with bootstrap confidence intervals).

## 3. Multi-label: findings come in clusters

- 41.6% of images have at least one finding. Among those, the mean is
  **1.50 findings per image**, and **36.2%** have two or more
  (`02_findings_per_image.png`). This confirms the design: 14 independent
  sigmoid outputs, not one softmax.
- The strongest co-occurrences (`03_cooccurrence.png`):
  - 43% of Edema images are also labelled Infiltration.
  - 39% of Pneumonia images are also labelled Infiltration.
  - 36% of Cardiomegaly images are also labelled Effusion.
  - Most-shared pairs by count: Effusion + Infiltration (2,404),
    Atelectasis + Infiltration (2,119), Atelectasis + Effusion (2,086).
- Pneumonia, Edema and Consolidation appear **alone** in fewer than 30% of
  their images.

**Implication.** The model can learn one finding as a proxy for its usual
companion. Grad-CAM for one label may highlight evidence for another.
Interpret explanations per image, not per label in isolation.

## 4. Repeat imaging is concentrated in a few patients

- 57.6% of patients have one image. The median is 1, the maximum is 109.
- **6.6% of patients (those with 10 or more images) contribute 37.6% of all
  images** (`04_images_per_patient.png`).

**Implications**
- A patient-level split is essential. An image-level split would put these
  frequently imaged patients on both sides and inflate validation scores.
- Training is weighted toward a small group of heavily imaged, probably
  chronically ill, patients. This is a limitation to note. Per-patient
  sampling weights are a possible later experiment.

## 5. Demographics

- Age: median 49 (IQR 35–59). **12 implausible ages** (over 100, up to 413)
  were set to missing.
- Sex: 56.0% male, 44.0% female, by image (`05_age_sex.png`).
- **4,190 images (4.8%) are from patients under 18.**
- Prevalence differs by sex for some labels. For example, Hernia is 2.0×
  and Cardiomegaly 1.6× more prevalent in female images, and Emphysema is
  0.74× as prevalent.

**Implication / decision needed.** The model card lists paediatric imaging
as *out of scope*, yet children's films are in the training data. Either
exclude patients under 18 from training (consistent with the stated scope),
or keep them and say so explicitly. Whichever is chosen, record the
decision.

## 6. View position is a strong confounder

- 65.0% PA (usually standing outpatients), 35.0% AP (often bedside
  inpatients).
- "No Finding" is 61.4% of PA films vs 52.8% of AP films.
- Several labels are far more common on AP films
  (`06_prevalence_by_view.png`):

| Finding | AP prevalence ÷ PA prevalence |
|---|---:|
| **Edema** | **11.1×** |
| Consolidation | 2.8× |
| Atelectasis | 1.7× |
| Pneumonia | 1.6× |
| Effusion, Infiltration | 1.5× |
| … | |
| Pleural thickening | 0.55× |
| Hernia, Fibrosis | 0.3× |

**Implication.** The model can learn "this is an AP/bedside film" as a
shortcut, especially for Edema. AP films are visually distinctive (wider
heart shadow, monitoring equipment, different positioning). Mitigation and
evidence:
- report validation AUC **separately for PA and AP films**
- check Grad-CAM maps for attention on devices and image borders rather
  than lung fields

## 7. Image files

- All sampled files are 1024 × 1024 PNGs, downsampled by NIH from originals
  of about 2,500–3,000 px (pixel spacing 0.12–0.20 mm).
- About 1% of files (3 of 400 sampled) are stored as **RGBA**, not
  greyscale. The pipeline converts every image to single-channel greyscale
  first (`img.convert("L")`), so this is handled.
- Mean pixel intensity varies widely between films (on 0–255: median
  126, IQR 113–149, range 71–194 across the 400 sampled). Exposure differs between films, which supports
  the mild brightness/contrast augmentation already in `transforms.py`.

## 8. Visual inspection

From `07_examples_per_label.png`:
- **Burned-in laterality markers** ("L", "R", often with technologist
  initials) appear on most films, in varying positions.
- **AP films often carry ECG leads, lines and tubes.** These are visual
  correlates of inpatient status, so they are a second shortcut route
  alongside view position.
- Some films are rotated slightly or have exposed borders. This supports
  the small-rotation augmentation and argues against aggressive cropping.
- Chest anatomy is not left–right symmetric (heart on the left), which
  confirms that horizontal flipping is correctly excluded.

---

## Decisions this EDA feeds

| # | Item | Status |
|---|---|---|
| 1 | AUC-ROC primary; per-class reporting | Already implemented |
| 2 | Patient-level split | Implemented and verified (0 overlap) |
| 3 | Class weighting capped at 50 | Implemented; **document** the effect on five classes |
| 4 | Confidence intervals for sparse classes | To add to evaluation |
| 5 | Per-view (PA/AP) validation AUC | To add to evaluation |
| 6 | Grad-CAM shortcut check (markers, devices, borders) | When Grad-CAM is built |
| 7 | Under-18 images: exclude or keep | **Decision needed** |
