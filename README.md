# LeCAD-CXR

**Lesotho Computer-Aided Detection for Chest X-ray** — a deep learning
clinical decision-support system for multi-disease chest X-ray
classification.

> Research prototype. **Not a medical device.** It is not deployed in any
> clinical service and must not inform the care of any patient. Output is
> decision support; the clinical decision remains the clinician's.

---

## Run it

This runs the whole system on your laptop: the trained model behind a
FastAPI service, and the web app clinicians use. The database is hosted
(Neon), so there is nothing to install for it. Allow about 15 minutes and
1.5 GB of downloads the first time; after that it starts in under a minute.

### What you need

| | Check in a terminal | If missing |
|---|---|---|
| Windows 10 or 11 | | For macOS or Linux, use [the manual steps](#manual-steps-macos-linux-or-if-the-script-fails) |
| Python 3.10 or newer | `python --version` | [python.org/downloads](https://www.python.org/downloads/). On the first screen tick **Add python.exe to PATH** |
| Node.js 20.9 or newer | `node --version` | [nodejs.org](https://nodejs.org), the LTS version |
| The **database connection string** | | In the supervisor guide submitted with this project. It is not in this repository because it contains a password |
| An internet connection | | |

After installing Python or Node.js, close and reopen VS Code so its terminal
can find them.

### Steps

1. **Get the code.** Either:
   - with Git: `git clone https://github.com/Kananelo12/LeCAD-CXR.git`, or
   - without Git: on the [repository page](https://github.com/Kananelo12/LeCAD-CXR),
     click **Code → Download ZIP**, then right-click the ZIP and choose
     **Extract All**.
2. **Open the folder in VS Code**: **File → Open Folder…**, then choose
   `LeCAD-CXR` (the folder that contains `run.cmd` and `README.md`).
3. **Open a terminal**: **Terminal → New Terminal**.
4. **Run:**
   ```powershell
   .\run.cmd
   ```
5. **On the first run it asks for `DATABASE_URL`.** Paste the connection
   string from the supervisor guide (right-click pastes in the terminal) and
   press Enter. It then installs everything, which takes about 10 minutes.
6. **Sign in.** The browser opens at http://localhost:3000 by itself. Sign
   in with the account in the supervisor guide. If the page says *Waking the
   database…*, wait a few seconds; it continues on its own.
7. **Try it.** On the Analyse page, drop in an image from
   [`sample-images/`](sample-images/), which has five labelled test-set
   X-rays per finding. Compare the result with
   [`sample-images/labels.csv`](sample-images/labels.csv); the folder's
   README says what to expect.

**To stop**, press `Ctrl+C` in the terminal. **Next time**, open the folder
and run `.\run.cmd` again.

You are using the real system, not a demo, if:
- there is no "mock API" label in the bottom-right corner, and
- **About the model** gives the model version as `densenet121-00cd10b12611`.

### What `run.cmd` does

Nothing on the laptop changes outside this folder. It:

1. checks Python and Node.js, and says what to install if one is missing;
2. writes `.env` from the connection string you paste. A random session key
   is generated, and the model path is `ml/models/model_sens90.pt`;
3. installs the API's Python packages into `.venv` in this folder;
4. installs and builds the web app in `web/`;
5. starts the API on port 8000 and the web app on port 3000, waits until
   both answer, then opens the browser;
6. stops both when you press `Ctrl+C`.

The installation steps are skipped on later runs unless something changed.
Logs are written to `ml/artifacts/logs/`. The PowerShell script policy is
bypassed for this one script only (`run.cmd` calls `run.ps1`), not changed.

### Manual steps (macOS, Linux, or if the script fails)

Run these from the `LeCAD-CXR` folder.

**1. Create `.env`** in that folder, with these lines. Use the connection
string from the supervisor guide, changing its start from `postgresql://` to
`postgresql+psycopg://`. Generate the secret with
`python -c "import secrets; print(secrets.token_urlsafe(48))"`.

```
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=<the generated secret>
LECAD_MODEL_PATH=ml/models/model_sens90.pt
LECAD_COOKIE_SECURE=0
```

**2. Install and start the API** (terminal 1):

```bash
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -e "ml[serve]"      # Linux: first pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
uvicorn lecad.serving.app:app --port 8000
```

Wait for `Application startup complete`. http://localhost:8000/health
should show `{"status":"ok"}`.

**3. Install, build and start the web app** (terminal 2):

```bash
cd web
npm ci
echo API_URL=http://localhost:8000 > .env.local
npm run build
npm start
```

Then open http://localhost:3000.

### If something goes wrong

| You see | Do this |
|---|---|
| `python` opens the Microsoft Store, or *Python 3.10 or newer was not found* | Install Python from python.org with **Add python.exe to PATH** ticked, then reopen VS Code. |
| *running scripts is disabled* | Run `.\run.cmd`, not `.\run.ps1`. |
| *Port 8000 (or 3000) is already in use* | An earlier run is still open in another terminal: close it, or restart the laptop. To use other ports: `.\run.cmd -ApiPort 8100 -WebPort 3100`. |
| *The API stopped while starting*, mentioning the database | The connection string in `.env` is wrong. Delete `.env`, run `.\run.cmd`, and paste it again. |
| *The server is not responding yet* on the sign-in page | The API has stopped. Look at the terminal, or at `ml/artifacts/logs/api.log`. |
| Anything else | Run `.\run.cmd -Rebuild`. If it still fails, the last lines of the log it prints say why. |

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
│   │   ├── models.py       DenseNet-121 / ResNet-50 / EfficientNet-B0 factory
│   │   ├── metrics.py      per-class AUC, PR-AUC, thresholds chosen on val
│   │   └── serving/        FastAPI: auth, /predict + Grad-CAM, audit log
│   ├── scripts/            one-shot entry points
│   ├── configs/            experiment configs
│   ├── splits/             generated split — COMMITTED, part of the record
│   └── notebooks/          EDA and result plots only
├── ml/models/             the deployed model (model_sens90.pt), 28 MB
├── web/                    Next.js frontend
├── docs/                   model card, API contract, decision records
├── sample-images/          75 labelled test-set X-rays for trying the system
└── run.cmd, run.ps1        one-command start (see Run it)
```

**The dataset is not in this repository and never will be**, apart from
the 75 images in `sample-images/`. It lives at
`D:\Work\archive` on this laptop and at `/kaggle/input/data` on Kaggle,
and is found through `LECAD_DATA_ROOT`.

## Setup for training and development

To run the finished system, see [Run it](#run-it) above. This section is
for retraining the model, which needs the NIH dataset.

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

Before pushing training changes, prove the loop runs on CPU in a couple of
minutes (tiny, random weights, no download):

```bash
python ml/scripts/train.py --config ml/configs/baseline.yaml --limit 64 --epochs 1 --num-workers 0 --no-pretrained
```

## Training on a GPU (Lightning AI)

Real training runs on a T4 GPU in a Lightning AI Studio. The NIH images are
downloaded there once and stored at 256 x 256 by
`ml/scripts/make_resized_cache.py`, using the same `prepare_image()` step
the API applies to uploads. That's about 3.7 GB instead of 42 GB, and much
faster to train from. The same `train.py` / `evaluate.py` then run unchanged.
Kaggle also works, if its GPU is available to you
(`ml/notebooks/kaggle_train.ipynb`).

**Step-by-step walkthrough, from account setup to the final test
evaluation: [docs/training-guide.md](docs/training-guide.md).**

The test set is refused unless `LECAD_ALLOW_TEST=1` is set for a single
command, once, for the final model. Never set it in `.env`.

## Ground rules

1. **The test set is closed.** `test_list.txt` is the NIH's own split. No
   EDA on it, no tuning against it, no peeking. It is opened once, for the
   final evaluation.
   The one exception is `sample-images/`: 75 of its images, chosen by
   fixed rules (not by model output) after the final evaluation, so the
   system can be tried on films it never trained on.
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
