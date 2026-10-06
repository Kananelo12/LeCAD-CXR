# Training guide — from laptop to Kaggle and back

A step-by-step walkthrough. It assumes no prior Kaggle experience. Kaggle
moves its buttons around occasionally; if a label below doesn't match
exactly, look for the nearest equivalent.

**The division of labour:** the laptop is for checking that code runs (tiny
amounts of data, CPU, minutes). Kaggle is for real training (the full
dataset, a free GPU, hours). The same scripts run in both places.

---

## Part A — On the laptop

All commands are for **PowerShell**, run from the repository folder.

### A1. Open a terminal in the project

In VS Code: **Terminal → New Terminal**. Then:

```powershell
cd D:\Work\LeCAD-CXR
.\.venv\Scripts\Activate.ps1
```

Your prompt now starts with `(.venv)`. Every command below assumes this.
If PowerShell refuses to run the activate script, run this once and retry:
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

### A2. Check that everything still works

Run these after pulling or changing code, before pushing.

```powershell
# 1. Smoke test — loads 32 images, one forward/backward pass. ~1 minute.
python ml\scripts\smoke_test.py

# 2. Tiny training run — 64 images, 2 epochs, random weights. ~1-2 minutes.
python ml\scripts\train.py --config ml\configs\baseline.yaml --limit 64 --epochs 2 --num-workers 0 --no-pretrained

# 3. Evaluate that run (replace the folder name with the one train.py printed).
python ml\scripts\evaluate.py --run ml\artifacts\runs\baseline-densenet121-YYYYMMDD-HHMMSS --limit 64 --num-workers 0
```

The AUC from step 2 will be around 0.5. That is correct: random weights,
64 images. These runs prove the code works, not that the model is good.

Useful extras:

```powershell
# Try a different architecture locally
python ml\scripts\train.py --config ml\configs\resnet50.yaml --limit 64 --epochs 1 --num-workers 0 --no-pretrained

# Delete old local test runs (they are not tracked by git)
Remove-Item -Recurse -Force ml\artifacts\runs\*

# Lint
python -m ruff check ml
```

Don't train on the full dataset on the laptop. On CPU one epoch would take
days.

### A3. Commit and push

Kaggle downloads the code from GitHub, so **Kaggle only sees what you have
pushed**.

```powershell
git status                 # review what changed
git add -A
git commit                 # opens an editor for the message; or use -m "..."
git push
```

`.env`, the dataset, `ml/artifacts/` and model weights are in
`.gitignore`, so `git add -A` will not pick them up. Check `git status`
anyway before committing.

---

## Part B — One-time setup (about 15 minutes, done once)

### B1. Kaggle account with phone verification

1. Sign up or log in at **kaggle.com**.
2. Click your profile picture (top right) → **Settings**.
3. Find **Phone verification** and complete it. Without this, Kaggle won't
   give you a GPU or internet access in notebooks, and you need both.

### B2. A GitHub token, so Kaggle can read your private repo

Your repository is private, so Kaggle needs a password-like token to
download it. Give it the smallest access possible: read-only, one repo.

1. On **github.com**, click your profile picture → **Settings**.
2. Left sidebar, at the bottom: **Developer settings**.
3. **Personal access tokens → Fine-grained tokens → Generate new token**.
4. Fill in:
   - **Token name:** `kaggle-lecad-read`
   - **Expiration:** 90 days (you can make a new one later)
   - **Repository access:** *Only select repositories* → `LeCAD-CXR`
   - **Permissions → Repository permissions → Contents:** *Read-only*
     (leave everything else at *No access*)
5. **Generate token**, then **copy it now**. GitHub only shows it once.
   Don't paste it into any file in the repository.

---

## Part C — Kaggle: the first run

### C1. Create the notebook

1. On kaggle.com, click **+ Create** (left sidebar) → **New Notebook**.
2. In the notebook editor: **File → Import Notebook** → upload
   `D:\Work\LeCAD-CXR\ml\notebooks\kaggle_train.ipynb`.
3. Rename it (click the title at the top left) to `lecad-cxr-train`.

### C2. Configure the session (right-hand panel)

If the right panel is hidden, click the small arrow on the right edge to
open it.

1. **Session options → Accelerator:** choose **GPU P100** if offered,
   otherwise **GPU T4 x2**. The code uses one GPU either way.
2. **Session options → Internet:** switch **on**. It's needed to clone
   from GitHub and to download the ImageNet weights.
3. **Input → + Add Input:** search **NIH Chest X-rays** and choose the
   dataset published by *National Institutes of Health Chest X-Ray Dataset*
   (about 42 GB, 112,120 images). Click **+** to add it. It is mounted,
   not downloaded, so this takes seconds.

### C3. Store the GitHub token as a Kaggle Secret

1. Top menu: **Add-ons → Secrets → Add Secret**.
2. **Label:** `GITHUB_TOKEN` (exactly this, the notebook looks for this name).
   **Value:** paste the token from B2. Save.
3. Make sure the checkbox next to `GITHUB_TOKEN` is **ticked**. That
   attaches it to this notebook.

Secrets are never shown in the notebook or its outputs. The notebook also
removes the token from the cloned repo's settings straight after cloning.

### C4. A timing run (about 15-20 minutes)

The first run uses 2,000 images for 1 epoch. It proves everything works on
Kaggle and tells you how long a full run will take.

1. In the **Settings** cell, keep `CONFIG = "ml/configs/baseline.yaml"`
   and `EXTRA = "--limit 2000 --epochs 1"`.
2. Click **Run All** (top toolbar), or run the cells one by one with
   **Shift+Enter**.
3. What you should see:
   - Cell 2 prints a GPU name and `data root: /kaggle/input/...`
   - Cell 3 prints the latest commit message. Check it's the one you just
     pushed.
   - Cell 4 ends with a line like
     `epoch  1  loss 0.9xxx  val macro AUC 0.6xxx  (420.0s)`
   - Cell 5 prints a per-label table.
4. **Estimate the full run.** Take the seconds in brackets and multiply by
   about 37. That gives one full epoch, a slight overestimate. Multiply by
   15 epochs.
   - Example: 60 s × 37 ≈ 37 minutes per epoch, × 15 ≈ 9.3 hours. That
     fits. Anything up to about 70 s fits in Kaggle's 12-hour limit with
     some margin.
   - If the estimate is over 11 hours, stop and share the number with
     Claude. Options are fewer epochs or caching resized images, a
     one-off preprocessing step that speeds up every later run.
5. **Stop the session:** click the **power icon** (top right) or
   **Run → Stop Session**. An open session uses your GPU quota even while
   idle. Kaggle shows your remaining weekly GPU hours in the right panel,
   usually about 30.

If something fails, copy the full error output and share it.

### C5. The full run, in the background

An interactive session dies when you close the browser. For a long run,
use **Save Version**, which runs the whole notebook on Kaggle's servers for
up to 12 hours whether or not you are watching.

1. In the **Settings** cell, set `EXTRA = ""`.
2. Top right: **Save Version** → choose **Save & Run All (Commit)** →
   **Save**.
3. You can close the browser. To check progress, open the notebook from
   **Your Work** (left sidebar) → click the running version → **Logs**.
4. When it finishes you get a notification. The last log lines read
   `Done. Best validation macro AUC 0.8xxx`.

For reference, published DenseNet-121 results on this dataset reach about
0.80-0.84 macro AUC. Treat anything in that region as a healthy baseline,
not as a target to beat on test.

### C6. Collect the results

1. Open the finished version → **Output** tab.
2. Browse to `LeCAD-CXR/ml/artifacts/runs/<run-name>/`.
3. Download:
   - `best.pt`: the model, about 30 MB for DenseNet-121
   - `best_val_metrics.json`, `eval_val.json`: the numbers
   - `history.jsonl`: per-epoch progress, for learning-curve plots
   - `config.yaml`: exactly what produced this run
4. On the laptop, put them in
   `D:\Work\LeCAD-CXR\ml\artifacts\runs\<run-name>\` (create the folder).
   This folder is ignored by git, which is correct: weights don't belong in
   git. They will go to Hugging Face Hub when the API is built.

You can re-check those numbers on the laptop with a limited sample:

```powershell
python ml\scripts\evaluate.py --run ml\artifacts\runs\<run-name> --limit 500 --num-workers 0
```

### C7. If a run is cut off before it finishes

`last.pt` is saved after every epoch, so nothing is lost but the epoch in
progress.

1. Open the notebook in the editor again.
2. **Input → + Add Input → Your Work → Notebooks** → choose
   `lecad-cxr-train` (the version that was cut off). Its output is mounted
   under `/kaggle/input/lecad-cxr-train/`.
3. In the **Settings** cell set `RESUME_FROM` to the run folder, e.g.
   `"/kaggle/input/lecad-cxr-train/LeCAD-CXR/ml/artifacts/runs/baseline-densenet121-20261006-101500"`.
   To find the exact path, expand the input in the right-hand panel.
4. **Save Version → Save & Run All** again. Training continues from the
   next epoch.

---

## Part D — Comparing the three architectures

The study compares DenseNet-121, ResNet-50 and EfficientNet-B0. The configs
are identical apart from the architecture, so the comparison is fair.

1. Repeat **C5** (and C6) twice more, changing only the Settings cell:
   - `CONFIG = "ml/configs/resnet50.yaml"`
   - `CONFIG = "ml/configs/efficientnet_b0.yaml"`

   Each is its own **Save Version**. Run them one after the other, not
   at the same time. Kaggle allows only one GPU session at once.
2. Pick the winner on **validation macro AUC** (`best_val_metrics.json`).
   Never use the test set for this choice.
3. Once the three runs' files are in `ml/artifacts/runs/` on the laptop,
   print a side-by-side table:

   ```powershell
   python ml\scripts\compare_runs.py
   ```

Kaggle hours: three full runs of maybe 6-10 hours each is more than one
week's quota. Plan on two weeks, or one run per few days.

---

## Part E — Writing it down (after every Kaggle run)

Open `docs/model-card.md` and fill in, per run:

- **Version / commit:** the `git_commit` value from that run's `config.yaml`
- **Architecture** and **config file** used
- **Validation macro AUC** and the per-class AUCs from
  `best_val_metrics.json`. Keep the Hernia/Pneumonia caveat next to their
  numbers.
- **Which epoch was best** (`epoch` in `eval_val.json`) and the training
  time

Do it the same day. Reconstructing it later from memory is where
dissertation results go wrong.

---

## Part F — The final test evaluation (once, at the very end)

Do this **only** when the architecture and every setting are final and
won't change again. The test set result is what the dissertation reports.
Looking at it earlier and then adjusting anything would make it
meaningless.

The test set is locked in code. It opens only when `LECAD_ALLOW_TEST=1` is
set **for that one command**. Never put it in `.env`.

On Kaggle (faster), add a cell after the last one:

```python
!LECAD_ALLOW_TEST=1 python ml/scripts/evaluate.py --run {run} --split test
```

Or on the laptop (25,596 images on CPU, so expect a few hours):

```powershell
$env:LECAD_ALLOW_TEST = "1"
python ml\scripts\evaluate.py --run ml\artifacts\runs\<final-run> --split test --num-workers 4
Remove-Item Env:LECAD_ALLOW_TEST
```

This writes `eval_test.json` beside the model. Record it in the model card.
Expect precision and F1 to differ from validation: the test set has more
disease (see `ml/src/lecad/splits.py`). AUC is the comparable figure.

---

## What comes next

Once a trained `best.pt` exists, the API gets built: FastAPI with login,
prediction with Grad-CAM heatmaps, and the audit log. Then the Next.js
interface. That is development work done together in the repository, and
there is no setup to do for it yet.
