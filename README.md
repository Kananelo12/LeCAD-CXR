# LeCAD-CXR

**Lesotho Computer-Aided Detection for Chest X-ray** — a deep learning
clinical decision-support system for multi-disease chest X-ray
classification.

> Research prototype. **Not a medical device.** It is not deployed in any
> clinical service and must not inform the care of any patient. Output is
> decision support; the clinical decision remains the clinician's.

---

## Layout

```
LeCAD-CXR/
├── ml/                     Python — training, evaluation and the API
│   ├── src/lecad/
│   │   ├── transforms.py   preprocessing, shared by training AND serving
│   │   ├── image_index.py  filename -> path across the 12 dataset shards
│   │   ├── splits.py       patient-level train/val split; test quarantine
│   │   ├── data.py         PyTorch dataset and loaders
│   │   └── serving/        FastAPI (not built yet)
│   ├── scripts/            one-shot entry points
│   ├── configs/            experiment configs
│   ├── splits/             generated split — COMMITTED, part of the record
│   └── notebooks/          EDA and result plots only
├── web/                    Next.js frontend (not built yet)
└── docs/                   model card, datasheet, decision records
```

**The dataset is not in this repository and never will be.** It lives at
`D:\Work\archive` on this laptop and at `/kaggle/input/data` on Kaggle,
and is found through `LECAD_DATA_ROOT`.

## Setup

```bash
cp .env.example .env          # then edit LECAD_DATA_ROOT if needed

python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -e "ml[train,dev]"
```

## First run, in order

```bash
python ml/scripts/make_splits.py    # once; commit ml/splits/
python ml/scripts/smoke_test.py     # proves the pipeline end to end
```

Only after the smoke test passes is it worth training anything.

For laptop development, build a small subset so you are not reading 40GB:

```bash
python ml/scripts/make_dev_subset.py --n 2000 --out D:/Work/cxr-dev
# then set LECAD_DATA_ROOT=D:/Work/cxr-dev in .env
```

Real training runs on Kaggle, where the dataset is already mounted.

## Ground rules

1. **The test set is closed.** `test_list.txt` is the NIH's own split. No
   EDA on it, no tuning against it, no peeking. It is opened once, for the
   final evaluation.
2. **Validation is split by patient, never by image.** Patients average
   three radiographs; an image-level split puts the same person on both
   sides and inflates the score.
3. **Preprocessing lives in `transforms.py` and is imported, never
   copied.** Training/serving skew is silent and it is the most common way
   a working model becomes a broken product.
4. **Nothing derived from interviews enters this repository.** Transcripts,
   audio and consent forms are personal data under the Data Protection Act
   and are stored separately, encrypted.
5. **No patient images are stored by the API.** The audit log records a
   SHA-256 of the submitted image, never the image itself.

## Dataset

NIH ChestX-ray14 — 112,120 frontal radiographs, 30,805 patients, 14 labels.

Labels were mined from radiology reports by NLP, not annotated on the
images; the NIH estimates >90% accuracy and an independent audit found
material problems. "No Finding" (53.8% of images) means none of the 14
listed patterns were found, **not** that the image is normal. Both facts
cap what any performance figure here can mean, and both belong in the
limitations section.

Wang, X., Peng, Y., Lu, L., Lu, Z., Bagheri, M. and Summers, R.M. (2017)
*ChestX-ray8: Hospital-scale Chest X-ray Database and Benchmarks on
Weakly-Supervised Classification and Localization of Common Thorax
Diseases.* IEEE CVPR, pp. 3462–3471.
