# Results and findings: LeCAD-CXR

*A complete, chronological record of what was found, from data preparation
to the final test evaluation, organised as a working draft of
**Chapter 4: Results and Findings**. Last updated 2026-10-12.*

**How this differs from the model card.** `docs/model-card.md` documents
the *model*: what it is, how it scores, its limits. This document tells the
*story of the research*, in the order it happened, against the study's
objectives and DSRM activities, with the interpretation the chapter needs.
The two agree on every number. Detail tables live in the model card and are
referenced, not repeated, where they are long.

**Conventions.** "Validation" means the 13,025-image patient-level
validation partition. "Test" means the official NIH test set (25,596
images), opened once. AUC is the area under the ROC curve; 95% CIs come
from a patient-level bootstrap (2,000 rounds). Figures are in
`docs/figures/eda/` and `docs/figures/results/`.

**Still to add from outside this repository:** interview findings (Objective
1, DSRM activities 1–2) and the participants' comments from the
demonstration (DSRM activity 4). Placeholders mark where they belong.

---

## 4.1 Introduction

The study set out to develop a deep learning-based clinical decision-support
system for multi-disease chest X-ray classification in Lesotho. This
chapter reports the results that bear on:

- **Objective 3 / RQ3: development** of the system on the publicly
  available NIH ChestX-ray14 dataset. Sections 4.2–4.6.
- **Objective 4 / RQ4: evaluation** of how accurately it classifies
  multiple chest diseases. Sections 4.7–4.10.
- The **solution objectives** derived in DSRM activity 2, against which the
  artefact is evaluated. Section 4.11.

Within the DSRM (Peffers et al., 2007), the results span Design &
Development (activity 3) and Evaluation (activity 5). Where an objective was
not met, the outcome is reported together with the decision taken (§4.11).

> *Placeholder: summary of interview and document-review findings that
> shaped the solution objectives (Objective 1, RQ1/RQ2), if Chapter 4
> rather than Chapter 3 reports them.*

---

## 4.2 Dataset, integrity checks and data partitioning

### 4.2.1 The dataset

NIH ChestX-ray14 (Wang et al., 2017): 112,120 frontal radiographs of 30,805
patients, each carrying up to 14 pathology labels mined from radiology
reports by natural-language processing. They are not annotations drawn on
the images. "No Finding" means none of the 14 was reported, not that the
radiograph is normal. Both properties limit what any performance figure can
mean (§4.12).

### 4.2.2 Integrity checks

| Check | Result |
|---|---|
| Overlap between the official `train_val` and `test` lists, by image | 0 |
| Overlap between them by **patient** | 0 (28,008 vs 2,797 patients) |
| Images in neither list | 0 |
| Duplicate file names | 0 |
| Implausible ages (> 100 years) | 16 records in the full dataset, 12 in train+val (maximum recorded 413), set to missing |
| Stored as colour (RGBA) rather than greyscale | about 1% of files (3 of 400 sampled); converted to greyscale in preprocessing |

### 4.2.3 Partitioning

The official NIH test list was kept as the test set and **quarantined**. It
is enforced in code: the loader refuses the test split unless
`LECAD_ALLOW_TEST=1` is set for a single command. NIH provides no validation
set, so one was carved from `train_val` **by patient** (15%, seed 42).
Patients contribute about three images each, and an image-level split would
place the same person on both sides and inflate validation scores (§4.3.4).

**Table 4.1: Data partitions**

| Partition | Images | Patients | Images / patient |
|---|---:|---:|---:|
| Train | 73,499 | 23,807 | 3.09 |
| Validation | 13,025 | 4,201 | 3.10 |
| Test (official, quarantined) | 25,596 | 2,797 | 9.15 |

The split is reproducible: the patient lists and a manifest (with the
metadata file's SHA-256) are committed, and regenerating them reproduces
them exactly. This was verified after a later code change.

---

## 4.3 Exploratory data analysis (train + validation only)

The EDA used training and validation images only; the test set was removed
before any analysis (`ml/notebooks/01_eda.ipynb`; full write-up in
`docs/eda-summary.md`).

### 4.3.1 The partitions are balanced

Label prevalence in train and validation agrees to within 1.1 percentage
points for every finding (largest gap: Effusion, 9.8% vs 10.9%;
*Figure 4.1*, `eda/01_label_prevalence.png`).

### 4.3.2 Severe, uneven class imbalance

58.4% of train+val images are "No Finding". Prevalence ranges from 15.9%
(Infiltration, 5 negatives per positive) down to 0.16% (Hernia, 141 images,
613 negatives per positive) (*Table 4.2* = EDA §2). Consequences carried
into the design:

- **Accuracy is not reported:** a model predicting "nothing" would score
  highly. AUC-ROC was adopted as the threshold-free discrimination metric.
- **The loss weights positives by the negative:positive ratio, capped at
  50.** The cap binds for five findings and under-weights Hernia about 12×,
  a deliberate stability trade-off.
- **Validation holds only 22 Hernia and 143 Pneumonia cases,** so their
  estimates are imprecise. This later proved decisive for Hernia (§4.9).

### 4.3.3 The task is genuinely multi-label

41.6% of images carry at least one finding. Among those, the mean is 1.50,
and 36.2% carry two or more (*Figure 4.2*, `eda/02_findings_per_image.png`).
Co-occurrence is strong (*Figure 4.3*, `eda/03_cooccurrence.png`):

- 43% of Edema images are also labelled Infiltration
- 39% of Pneumonia images are also labelled Infiltration
- 36% of Cardiomegaly images are also labelled Effusion

This confirms the design of 14 independent sigmoid outputs, not a softmax.
It also cautions that a model can learn one finding as a proxy for another.

### 4.3.4 Repeat imaging is concentrated

57.6% of patients have one image, but the 6.6% with ten or more contribute
37.6% of all images (maximum 109; *Figure 4.4*,
`eda/04_images_per_patient.png`). This is the empirical justification for
the patient-level split.

### 4.3.5 Demographics

- Median age 49 (IQR 35–59); 56.0% male by image (*Figure 4.5*,
  `eda/05_age_sex.png`).
- **4.8% of images (4,190) are from patients under 18,** although paediatric
  use is outside the intended scope (§4.4.1).

### 4.3.6 View position is a confounder

65.0% of train+val films are PA (standing, typically outpatients) and 35.0%
AP (often bedside, sicker patients). Several findings are far more common
on AP films (*Figure 4.6*, `eda/06_prevalence_by_view.png`):

| Finding | AP prevalence ÷ PA prevalence |
|---|---:|
| Edema | 11.1× |
| Consolidation | 2.8× |
| Atelectasis | 1.7× |

A model could therefore learn "bedside film" instead of the pathology
(shortcut learning). This motivated reporting results separately for PA and
AP films throughout (§4.6.4).

### 4.3.7 Visual inspection

Most films carry burned-in laterality markers ("L", "R"), and AP films
frequently show ECG leads, lines and tubes (*Figure 4.7*,
`eda/07_examples_per_label.png`). These are further potential shortcuts.
Chest anatomy is not left–right symmetric, so horizontal flipping was
excluded from augmentation.

---

## 4.4 Design decisions taken from the data

### 4.4.1 Decisions recorded (2026-10-06, with the supervisor)

| Decision | Reason |
|---|---|
| **Retain all 14 labels**, including the sparse Hernia and Pneumonia | Each finding has an independent output, so a sparse label does not displace the others. Sparse results are reported with a caveat. |
| **Retain under-18 images** | Comparability with published results, which use all images. An adults-only (18+) result is reported alongside (§4.6, §4.9). |
| **Report PA and AP results separately** | View-position confounding (§4.3.6) |

### 4.4.2 Preprocessing and augmentation

All images are converted to greyscale and reduced to 256 × 256, then
presented to the network at 224 × 224 with ImageNet normalisation. This one
function (`prepare_image`) is shared by training and the web API, so the
two cannot drift apart. Training augmentation is limited to realistic
variation:
- rotation of ±7°
- a mild random crop (85–100% of the area)
- brightness and contrast jitter of ±15%
- no flipping

**Finding: reducing images to 256 px once does not affect the model's
input.** Training from 256 px copies saves substantial time and cost. On 100
training images, the reduction changed the 224 px model input by a mean
**0.51 / 255 per pixel (0.20%)**; worst image 0.84. One routine brightness
augmentation changes it by 11.6, about 20 times more. On 300 images, a
cached image and an original upload produced **identical** model input
(300/300). The cache occupies **3.02 GB instead of 42 GB** and took 29
minutes to build.

---

## 4.5 Development environment and training process

### 4.5.1 Compute platform (a practical finding)

The plan named Kaggle or Colab GPUs. Kaggle's GPU proved unavailable to the
researcher's account: phone verification failed repeatedly from Lesotho, and
ID verification did not unlock GPU access. Training moved to **Lightning
AI**, on one NVIDIA T4 GPU, using the free-tier credits. Compute for the
entire study, all training and every evaluation, cost **4.79 credits
(about US$4.79)**. About 2.7 of those were lost to a GPU left idle overnight
after the first run. An automatic shutdown was added afterwards, and no
later run wasted any. Training one model costs about **US$0.55–0.65**. This
bears directly on the feasibility of the approach in a resource-constrained
setting (§4.11).

> *For the chapter: the access barrier itself is a small finding about
> infrastructure availability for researchers in Lesotho.*

### 4.5.2 Training configuration

Identical for all three architectures:
- ImageNet-pretrained weights
- AdamW, learning rate 1×10⁻⁴, weight decay 1×10⁻⁵, cosine schedule over 15
  epochs
- batch size 32, mixed precision
- weighted binary cross-entropy (§4.3.2), seed 42

The checkpoint with the highest validation macro AUC is kept. After run 1,
**early stopping** (patience 3) was added. Run 1 shows it cannot change the
outcome, because its best epoch came before any stop would trigger.

### 4.5.3 Finding: the models overfit after 4–5 epochs

All three models reached their best validation AUC at **epoch 4 or 5**
(*Figure 4.8*, `results/01_learning_curves.png`). The baseline ran all 15
epochs: training loss kept falling (0.80 → 0.34) while validation AUC fell
from 0.830 to 0.803. The model was memorising the training images. Early
stopping halved the training time of runs 2 and 3, from about 2 hours to
about 1 hour.

**Table 4.3: Training runs**

| Run | Architecture | Best epoch / epochs run | Training time (T4) | Validation macro AUC |
|---|---|---:|---:|---:|
| 1 | DenseNet-121 | 4 / 15 | 2.1 h (≈1 h with early stopping) | **0.8297** |
| 2 | ResNet-50 | 5 / 8 | 0.96 h | 0.8274 |
| 3 | EfficientNet-B0 | 4 / 7 | 0.92 h | 0.8274 |

---

## 4.6 Comparison of the three architectures (validation)

### 4.6.1 Discrimination

The three architectures are **statistically indistinguishable**
(*Table 4.4*; per-finding AUCs in the model card, *Architecture
comparison*). Each wins some findings:
- DenseNet-121: 6 findings
- ResNet-50: 4
- EfficientNet-B0: 4

**Table 4.4: Validation macro AUC with 95% CIs, and paired differences**

| Model | Macro AUC [95% CI] |
|---|---|
| DenseNet-121 | 0.8297 [0.8210, 0.8376] |
| ResNet-50 | 0.8274 [0.8167, 0.8362] |
| EfficientNet-B0 | 0.8274 [0.8191, 0.8347] |

| Difference | Δ AUC [95% CI] | First model ahead in |
|---|---|---:|
| DenseNet-121 − EfficientNet-B0 | +0.0023 [−0.0032, +0.0077] | 80% of resamples |
| DenseNet-121 − ResNet-50 | +0.0023 [−0.0024, +0.0077] | 82% |
| EfficientNet-B0 − ResNet-50 | +0.0001 [−0.0063, +0.0079] | 48% |

### 4.6.2 The clinically primary metric: specificity at 90% sensitivity

A missed case is the costly error in decision support: a patient with
disease is falsely reassured. Sensitivity is therefore treated as the
primary clinical metric. Models are compared fairly on it by fixing each
finding's sensitivity at 90% and comparing specificity.

| Model | Macro specificity at 90% sensitivity [95% CI] |
|---|---|
| EfficientNet-B0 | 0.556 [0.518, 0.573] |
| DenseNet-121 | 0.546 [0.505, 0.570] |
| ResNet-50 | 0.538 [0.477, 0.566] |

The models are equivalent again: every difference's interval includes
zero. EfficientNet-B0 led DenseNet-121 in only 65% of resamples.

### 4.6.3 Bedside (AP) films

All models perform worse on AP films (0.768–0.798) than on PA films
(0.823–0.829). EfficientNet-B0 appeared best on AP films (0.798 vs 0.781 and
0.768), but **this is not significant**. It also rests largely on Hernia,
which has **2** AP cases. Excluding Hernia, the AP averages are 0.786 /
0.783 / 0.780.

### 4.6.4 Shortcut-learning check: view position

If a model used "AP film" as a shortcut, a finding's AUC across all films
would sit clearly *above* both its PA-only and its AP-only AUC.

| Finding | DenseNet-121 | ResNet-50 | EfficientNet-B0 |
|---|---:|---:|---:|
| Consolidation | +0.026 | +0.030 | +0.026 |
| Pneumonia | +0.017 | −0.003 | +0.013 |
| Edema | +0.002 | +0.049 | −0.002 |
| Infiltration | −0.036 | −0.030 | −0.040 |

- **Consolidation shows a consistent view contribution** in all three
  models. This is the study's clearest evidence of shortcut learning.
- **Edema does not show one consistently,** although it is the most
  AP-skewed finding. ResNet-50's +0.049 rests on 30 PA positives.
- **Every finding is discriminated well above chance within a single
  view,** so the models read the radiograph and not only the view.

---

## 4.7 Model selection and operating point

### 4.7.1 Selection: DenseNet-121

No comparison distinguished the architectures. The **pre-specified
baseline, DenseNet-121, was retained**: choosing on a non-significant
difference would be choosing on noise. It is also the standard architecture
in the chest X-ray literature, which aids comparison with published work,
and its 28 MB weights suit a CPU-served API. ResNet-50 is 94 MB with no
advantage; EfficientNet-B0 is 16 MB.

### 4.7.2 Operating point: at least 90% sensitivity per finding

The thresholds produced by training (Youden's J) weigh misses and false
alarms equally. At those thresholds, DenseNet-121 missed about **40% of
Nodules and Infiltrations** on validation (sensitivity 0.60). Consistent
with §4.6.2, the deployed model instead uses, for each finding, the highest
threshold that still flags at least 90% of validation cases. It keeps the
original threshold where that was already more sensitive (Cardiomegaly
0.93, Hernia 0.91). Thresholds were fixed **on validation, before the test
set was opened** (model card, *Model selection and operating point*). The
accepted cost is more false alarms. In a decision-support role the
clinician filters those, whereas a missed case cannot be recovered.

---

## 4.8 Final evaluation on the held-out test set

The official test set was evaluated **once** with the deployed model and
its pre-chosen thresholds. The thresholds were rebuilt on the GPU machine
and confirmed identical before the test run.

**Table 4.5: Test results (DenseNet-121, 90%-sensitivity operating point)**

| Metric | Test [95% CI] | Validation |
|---|---|---:|
| **Macro AUC** | **0.798 [0.791, 0.804]** | 0.830 |
| **Macro sensitivity** | **0.921 [0.909, 0.932]** | 0.904 |
| Macro specificity | 0.402 [0.392, 0.411] | 0.545 |
| AUC on PA / AP films | 0.794 / 0.773 | 0.829 / 0.781 |
| AUC, adults 18+ | 0.799 | 0.829 |

Per-finding results with CIs are in the model card, *Test results*.
*Figure 4.9* (`results/02_test_roc_per_finding.png`) shows each finding's
ROC curve with the deployed operating point marked.

### 4.8.1 Findings

1. **Discrimination is somewhat lower on test than on validation:** 0.798
   against 0.830, and the validation value lies outside the test interval.
   This matches the known difference between the NIH partitions:
   - the test set is enriched for disease (Pneumothorax 10.4% vs 3.0%;
     Cardiomegaly 4.2% vs 2.0%)
   - **57%** of test images are AP films, against 36% in validation
   - every model is weaker on AP films (§4.6.3)

   Retaining children's images made no difference (adults-only 0.799).
2. **The sensitivity objective held on unseen data for 13 of 14 findings,**
   at 0.91–0.97. Lower CI bounds sit at or near 0.90 (lowest: Fibrosis
   0.88).
3. **Hernia did not hold: sensitivity 0.628 [0.47, 0.77].** Its threshold
   was fitted to 22 validation cases. Its AUC remained high (0.906), so the
   model ranks Hernia well; it is the threshold that failed to transfer.
4. **Specificity fell under distribution shift:**
   - macro specificity 0.40
   - Infiltration 0.13, Pneumonia and Consolidation 0.23, Nodule 0.24

   Test-set scores run higher overall, so fixed thresholds flag more
   images. Sensitivity therefore rose above target, but so did false
   alarms. **An operating point fitted to one population drifts on
   another.** This is direct evidence that thresholds must be re-fitted on
   local data before use in Lesotho.

---

## 4.9 Comparison with published results on the same test split

Published results are only comparable if they use the **official NIH test
split**; many studies use random splits and report higher figures.
Taslimi et al. (2022, *SwinCheX*), from this study's preliminary literature
review, use the official split. They tabulate earlier official-split
results (their Table 1; cite the original papers).

**Table 4.6: Mean AUC on the official NIH test split**

| Study | Model | Mean AUC |
|---|---|---:|
| Wang et al. (2017) | ResNet-50, weakly supervised | 0.745 |
| Yao et al. (2018) | | 0.761 |
| Dosovitskiy et al. (2021), as reported by Taslimi et al. | ViT | 0.779 |
| **This study** | **DenseNet-121** | **0.798 [0.791, 0.804]** |
| Baltruschat et al. (2019) | ResNet-38 | 0.806 |
| Guendel et al. (2018) | DNet | 0.807 |
| Taslimi et al. (2022) | SwinCheX | 0.810 |

**Finding: the system's discrimination is comparable to published work,
slightly below the best results.**
- It is clearly above the dataset's original benchmark (0.745).
- It is about 0.01 below the strongest results (0.806–0.810).
- Its interval excludes those, so the gap is small but probably real.

Per finding (*Figure 4.10*, `results/03_published_comparison.png`):
- **Ahead of all three plotted studies:** Cardiomegaly (0.892) and Hernia
  (0.906).
- **Level with Guendel et al.'s DNet, below SwinCheX:** Pneumothorax
  (0.849 vs 0.846 and 0.871) and Edema (0.834 vs 0.835 and 0.848).
- **Furthest behind:** Nodule (0.732 vs 0.780), Pneumonia and Atelectasis.

Small findings like nodules plausibly benefit from the higher input
resolutions some studies use. The published figures carry no confidence
intervals and differ in preprocessing, so differences of about 0.01 should
not be over-interpreted.

> *Other review studies are not directly comparable:*
> - *Aldib & El-Medany (2023), 0.846: split not confirmed as official.*
> - *Monshi et al. (2022): results reported on MIMIC-CXR and CheXpert.*
> - *Zhang et al. (2024), Xiao et al. (2024): CheXpert / MIMIC-CXR.*
> - *Rahman et al. (2022): eight findings.*
>
> *Check the official-split status in each paper before citing any as
> comparable.*

---

## 4.10 The artefact (Design & Development output)

The trained model is embedded in a working decision-support system. The
architecture was revised from the proposal's Streamlit prototype; the
reasons are in `docs/decisions/0001-architecture.md`:

- **Back end:** a FastAPI service that authenticates users, runs inference,
  computes **Grad-CAM** heatmaps for flagged findings, and writes an
  **append-only, hash-chained audit log**. The log records each image's
  SHA-256, never the image itself.
- **Front end:** a Next.js web interface. For each finding it presents a
  **graded result** ("above", "near" or "below" the threshold) with the
  heatmap, the decision-support disclaimer, and a caution on sparse
  findings.
- **Model in service:** DenseNet-121 at the 90%-sensitivity operating point
  (`model_sens90.pt`), loaded under PyTorch's restricted loader, which
  refuses executable content. An end-to-end check (2026-10-12) passed on a
  laptop CPU without a GPU: sign-in, analysis of real radiographs, Grad-CAM,
  history, and verification of the audit chain. Each analysis took
  **0.25–0.5 s**.

> *Placeholder: demonstration on unseen cases and participants' usability
> comments (DSRM activity 4).*

---

## 4.11 Evaluation against the solution objectives

The objectives below are those defined in DSRM activity 2 (proposal,
"Define Objectives of a Solution"), plus the sensitivity target adopted
during evaluation.

**Table 4.7: Objectives and outcomes**

| Solution objective | Evidence | Status |
|---|---|---|
| Multi-label output beyond TB | 14 thoracic findings, independent outputs (§4.3.3) | **Met** |
| Performance comparable to published models | Test macro AUC 0.798 vs 0.806–0.810 for the best official-split results; above the original benchmark, 0.745 (§4.9) | **Met, slightly below the state of the art** |
| Visual explanation of each prediction | Grad-CAM heatmap per flagged finding (§4.10) | **Implemented**; quality to be assessed in the demonstration |
| Graded confidence | Above / near / below bands with probability and threshold (§4.10) | **Implemented** |
| Feasible on locally available computing | 28 MB model; one analysis, Grad-CAM included, takes 0.25–0.5 s on a laptop CPU with no GPU; one model trains for about US$0.60 of cloud GPU (§4.5.1) | **Met** |
| Sensitivity ≥ 90% per finding (adopted during evaluation) | 13 of 14 findings at 0.91–0.97 on test (§4.8) | **Met for 13 of 14** |
| — Hernia | 0.63 [0.47, 0.77] on test | **Not met: known limitation** |

**Hernia (DSRM iteration decision).** The objective was not met for Hernia.
Iterating back to design and development would require more Hernia
examples than the validation partition offers (22). Re-fitting on the test
set would invalidate the evaluation. **Hernia is therefore reported as a
known limitation.** It remains in the model and interface, because its
ranking is informative (AUC 0.906), and the interface already marks it as
a low-confidence finding. Its flag must not be relied on to rule Hernia out.

---

## 4.12 Limitations of the findings

1. **Label quality.** Labels are NLP-mined from reports, not annotated on
   the images. "No Finding" does not mean normal.
2. **Hernia's operating point is unreliable** (§4.11), and the estimates
   for other sparse findings (Pneumonia, Fibrosis) are less precise.
3. **Low specificity at the chosen operating point.** On test, roughly two
   in three to nine in ten healthy images are flagged for some findings
   (Infiltration specificity 0.13). The output is usable only as
   clinician-reviewed decision support.
4. **Thresholds do not transfer reliably between populations** (§4.8.1).
5. **Partial shortcut learning** via view position, for Consolidation
   (§4.6.4). Burned-in markers and devices remain unexamined as possible
   shortcuts.
6. **No external validation.** All data come from one US institution.
   Performance on Lesotho radiographs, equipment and disease prevalence
   (notably TB, which is not among the 14 labels) is unknown and must be
   established locally before any clinical use.
7. **Single training run per architecture.** Seed-to-seed variation was not
   measured. The bootstrap captures sampling uncertainty in the evaluation
   data, not training variability.
8. **Input resolution of 224 px,** standard but possibly limiting for small
   findings such as nodules (§4.9).

---

## 4.13 Chapter summary

From 112,120 radiographs, a patient-level partition was built and verified
leak-free. Exploratory analysis found:
- severe class imbalance
- genuinely multi-label images
- view position as a confounder

Each shaped the design. Three ImageNet-pretrained architectures, trained
identically on one T4 GPU for under US$5 in total, proved **statistically
equivalent** (validation macro AUC 0.827–0.830), so the pre-specified
DenseNet-121 was kept. Its decision thresholds were set for at least 90%
sensitivity, because a missed case is the costly error. On the official
test set, opened once:
- macro AUC **0.798 [0.791, 0.804]**, comparable to published
  official-split results (0.745–0.810)
- sensitivity of **0.91–0.97 for 13 of 14 findings**
- Hernia, with 22 validation cases, as the exception, reported as a known
  limitation

Specificity fell under distribution shift. This confirms that the system
supports rather than replaces clinical judgement, and that thresholds must
be re-fitted on local data before use in Lesotho.

---

## Appendix A: Figure and table index

| # | Content | File |
|---|---|---|
| Figure 4.1 | Label prevalence, train vs validation | `docs/figures/eda/01_label_prevalence.png` |
| Figure 4.2 | Findings per image | `docs/figures/eda/02_findings_per_image.png` |
| Figure 4.3 | Co-occurrence of findings | `docs/figures/eda/03_cooccurrence.png` |
| Figure 4.4 | Images per patient | `docs/figures/eda/04_images_per_patient.png` |
| Figure 4.5 | Age by sex | `docs/figures/eda/05_age_sex.png` |
| Figure 4.6 | Prevalence by view position | `docs/figures/eda/06_prevalence_by_view.png` |
| Figure 4.7 | Example radiographs per finding | `docs/figures/eda/07_examples_per_label.png` |
| Figure 4.8 | Validation AUC per epoch, three models | `docs/figures/results/01_learning_curves.png` |
| Figure 4.9 | Test ROC curves with operating points | `docs/figures/results/02_test_roc_per_finding.png` |
| Figure 4.10 | Test AUC vs published official-split results | `docs/figures/results/03_published_comparison.png` |
| Tables 4.2+ | Full per-finding tables | `docs/eda-summary.md`, `docs/model-card.md` |

## Appendix B: Reproducibility

| Item | Where |
|---|---|
| Code | GitHub `Kananelo12/LeCAD-CXR`; runs record their commit (`6122a5c`, `37c0a99`) |
| Split | `ml/splits/` (patient lists, manifest with metadata SHA-256) |
| Configs | `ml/configs/{baseline,resnet50,efficientnet_b0}.yaml` |
| Training / evaluation | `ml/scripts/train.py`, `evaluate.py` |
| Statistics | `ml/scripts/bootstrap_compare.py` (patient-level bootstrap, 2,000 rounds, seed 42) |
| Operating point | `ml/scripts/set_operating_point.py` → `operating_point_sens90.json` |
| Figures | `ml/notebooks/01_eda.ipynb`, `ml/scripts/make_results_figures.py` |
| Step-by-step procedure | `docs/training-guide.md` |

## Appendix C: Timeline

| Date (2026) | Milestone |
|---|---|
| 29 Sep | Repository scaffolded; patient-level split generated and committed |
| 6 Oct | Training and evaluation pipeline; EDA; decisions to keep all 14 labels and under-18 images |
| 8–10 Oct | Kaggle GPU access blocked by verification; moved to Lightning AI; 256 px cache built |
| 10 Oct | Run 1, DenseNet-121 (baseline) |
| 11 Oct | Early stopping and automatic shutdown; runs 2 (ResNet-50) and 3 (EfficientNet-B0); bootstrap comparison |
| 12 Oct | Sensitivity identified as primary metric; DenseNet-121 selected; 90%-sensitivity operating point; test set opened once; Hernia recorded as a known limitation |
