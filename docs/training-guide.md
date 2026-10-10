# Training guide — from laptop to the GPU and back

A step-by-step walkthrough. It assumes no prior cloud experience. Lightning
and Kaggle move their buttons around occasionally; if a label below doesn't match
exactly, look for the nearest equivalent.

**The division of labour:** the laptop is for checking that code runs (tiny
amounts of data, CPU, minutes). **Lightning AI** is for real training (the
full dataset, a T4 GPU, about an hour or two per run). The same scripts run
in both places. Kaggle remains an option if its GPU becomes available to
you (Appendix K).

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

The GPU machine downloads the code from GitHub, so **it only sees what you
have pushed**. After pushing, run `git pull` in the Studio.

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

## Part B — One-time setup (about 20 minutes, done once)

### B1. Lightning AI account

1. Sign up at **lightning.ai** and complete **phone verification** when
   asked. It unlocks the free GPU credits.
2. Check your credits: profile picture → **Billing** → *Total org credits*.
   The free tier starts at 5 credits (about $5, roughly 9 hours on a T4
   GPU). **Add card** unlocks 25 more. If you add a card, keep
   **Auto-reload credits switched off**, so your card is never charged
   automatically.

### B2. A GitHub token, so the Studio can read your private repo

Your repository is private, so the cloud machine needs a password-like token
to download it. Give it the smallest access possible: read-only, one repo.

1. On **github.com**, click your profile picture → **Settings**.
2. Left sidebar, at the bottom: **Developer settings**.
3. **Personal access tokens → Fine-grained tokens → Generate new token**.
4. Fill in:
   - **Token name:** `lecad-read`
   - **Expiration:** 90 days (you can make a new one later)
   - **Repository access:** *Only select repositories* → `LeCAD-CXR`
   - **Permissions → Repository permissions → Contents:** *Read-only*
     (leave everything else at *No access*)
5. **Generate token**, then **copy it now**. GitHub only shows it once.
   Keep it in a password manager. Never paste it into a file in the
   repository.

### B3. A Kaggle API token, to download the dataset

Lightning doesn't host the NIH images, so they're downloaded once from
Kaggle. Downloading uses an API token, which may work even though the
notebook GPU is locked on your Kaggle account.

1. On **kaggle.com**: profile picture → **Settings** → **API** section →
   **Create New Token**.
2. Depending on Kaggle's current version, you either get a file
   `kaggle.json` downloaded, or a token shown on screen. Keep whichever you
   get; C3 uses it.

---

## Part C — Lightning AI: data, then the first run

**How Lightning works.** A *Studio* is a Linux computer in the cloud with
its own storage. You can switch the same Studio between a free **CPU**
machine and a paid **GPU** machine; your files stay. The plan:

- prepare the data on the free CPU machine (C1–C4)
- switch to a T4 GPU only for training (C5–C7)
- switch back, or stop, when done (C8)

**Credits are only used while a GPU machine is running.** Note the free CPU
Studio also "becomes paid after 4 hours" of running, so stop it when idle.

### C1. Open a Studio and its terminal

1. On lightning.ai click **New Studio** (or open the one you created). Keep
   the machine on **CPU**, which is free.
2. Open a **terminal**: in the Studio, the *Terminal* icon or menu
   **Terminal → New Terminal**.
3. Type `pwd` and press Enter. Note the folder it prints (usually
   `/teamspace/studios/this_studio`). This is your Studio's own storage.
   Everything below is created inside it.

### C2. Fetch the code

In the terminal (one line at a time):

```bash
git clone https://github.com/Kananelo12/LeCAD-CXR.git
```

When asked: **Username** `Kananelo12`, **Password**: paste the GitHub token
from B2. Nothing appears as you paste; that's normal. Press Enter. Then:

```bash
cd LeCAD-CXR
pip install -q -e "ml[train]"
git log --oneline -1
```

The last line should show your latest commit. Later, to get new code:
`cd ~/LeCAD-CXR && git pull`. It asks for the token again.

### C3. Download the dataset (about 20–40 minutes)

**If B3 gave you a `kaggle.json` file:** drag it from your laptop into the
Studio's file panel (left side) so it lands in your Studio folder, then:

```bash
mkdir -p ~/.kaggle && mv ~/kaggle.json ~/.kaggle/ && chmod 600 ~/.kaggle/kaggle.json
```

**If B3 showed a token on screen instead** (it starts with `KGAT_`), save it
where the Kaggle tool looks for it. Replace `YOUR_TOKEN` with your token:

```bash
mkdir -p ~/.kaggle && echo YOUR_TOKEN > ~/.kaggle/access_token && chmod 600 ~/.kaggle/access_token
```

Saving it to a file, rather than `export KAGGLE_API_TOKEN=...`, means it
still works after the terminal is closed or the Studio restarts.

Then download and unpack. About 42 GB, so this takes a while:

```bash
pip install -q -U kaggle
kaggle datasets download -d nih-chest-xrays/data -p ~/data/nih-raw
cd ~/data/nih-raw && unzip -q data.zip && rm data.zip && cd ~/LeCAD-CXR
ls ~/data/nih-raw
```

The last command should list `Data_Entry_2017.csv`, `train_val_list.txt`,
`test_list.txt` and folders `images_001` … `images_012`.

If the download is refused (for example because of the account
verification), stop and tell Claude. There are other download routes.

### C4. Shrink the images once (about 15–30 minutes)

This stores every image at 256 × 256, exactly as the training pipeline
would prepare it: about 3.7 GB instead of 42 GB, and much faster to train
from. (Why this doesn't affect accuracy is noted in
`ml/src/lecad/config.py` at `CACHE_SIZE`.)

```bash
cd ~/LeCAD-CXR
LECAD_DATA_ROOT=~/data/nih-raw python ml/scripts/make_resized_cache.py --out ~/data/nih-256
```

It prints progress every 5,000 images and ends with
`Done: 112,120 written ... Now set LECAD_DATA_ROOT=...`. If it stops part
way (the Studio restarted, or you closed it), run the same command again.
Finished images are skipped.

Now tell the project where the data is, and check it works:

```bash
echo "LECAD_DATA_ROOT=$HOME/data/nih-256" > .env
python ml/scripts/smoke_test.py
```

You should see `Smoke test passed.` and `data root : .../data/nih-256`.

When it passes, **delete the originals** so they don't fill your storage:

```bash
rm -rf ~/data/nih-raw
```

The cache is all that training and evaluation use. The originals can be
downloaded again if ever needed.

**Check your files survive a restart** (once): stop the Studio (power
button, top right), start it again, open a terminal and run
`ls ~/data/nih-256/images | wc -l`. It should print `112120`.

### C5. Switch to the GPU

1. In the Studio's machine panel, click **GPU**.
2. In *Choose GPU machine*, leave **Interruptible** off for now, and pick
   **T4** (quantity 1, about $0.55/hour). Confirm.
3. Wait for the machine to start (a few minutes), then open a terminal and
   check:

```bash
nvidia-smi -L
```

It should print `GPU 0: Tesla T4 ...`.

### C6. Timing run (about 5–10 minutes, a few cents)

```bash
cd ~/LeCAD-CXR
python ml/scripts/train.py --config ml/configs/baseline.yaml --limit 2000 --epochs 1
```

The line to look for:
`epoch  1  loss 0.9xxx  val macro AUC 0.6xxx  (NNN.Ns)`.

**Estimate the full run:** multiply the seconds by about **37** for one
full epoch (a slight overestimate), then by **15** epochs. Share the
seconds with Claude to check the estimate and the credit cost.

### C7. The full run, in the background

Start it so it keeps running if you close the browser:

```bash
cd ~/LeCAD-CXR
nohup python ml/scripts/train.py --config ml/configs/baseline.yaml > train-baseline.log 2>&1 &
```

Check progress at any time:

```bash
grep -a "val macro" train-baseline.log
```

**First time only, check it really runs in the background:** close the
browser tab, come back after 15 minutes, and run the `grep` line again. If
new epochs have appeared, all is well. If the Studio went to sleep and
training stopped, tell Claude. Nothing is lost: continue with

```bash
python ml/scripts/train.py --config ml/configs/baseline.yaml --resume ml/artifacts/runs/<run-folder>
```

The run folder name is printed at the top of the log (`run dir : ...`).

When it ends, the log's last line reads
`Done. Best validation macro AUC 0.8xxx`. Then the validation report:

```bash
python ml/scripts/evaluate.py --run ml/artifacts/runs/<run-folder>
```

For reference, published DenseNet-121 results on this dataset reach about
0.80–0.84 macro AUC.

### C8. Stop paying, and collect the results

1. **Switch the machine back to CPU** (or stop the Studio) as soon as
   training and evaluation are done. The GPU bills by the second while it
   runs, even if nothing is happening.
2. In the Studio's file panel, open
   `LeCAD-CXR/ml/artifacts/runs/<run-folder>/` and download (right-click →
   Download):
   - `best.pt`: the model, about 30 MB for DenseNet-121
   - `best_val_metrics.json`, `eval_val.json`: the numbers
   - `history.jsonl`: per-epoch progress, for learning-curve plots
   - `config.yaml`: exactly what produced this run
3. On the laptop, put them in
   `D:\Work\LeCAD-CXR\ml\artifacts\runs\<run-folder>\`. This folder is
   ignored by git, which is correct: weights don't belong in git.

---

## Part D — Comparing the three architectures

The study compares DenseNet-121, ResNet-50 and EfficientNet-B0. The configs
are identical apart from the architecture, so the comparison is fair.

1. Repeat **C7** (and C8) twice more, changing only the config file:

   ```bash
   nohup python ml/scripts/train.py --config ml/configs/resnet50.yaml > train-resnet50.log 2>&1 &
   nohup python ml/scripts/train.py --config ml/configs/efficientnet_b0.yaml > train-effnet.log 2>&1 &
   ```

   Run them **one after the other**, not at the same time: one T4, one run.
2. Pick the winner on **validation macro AUC** (`best_val_metrics.json`).
   Never use the test set for this choice.
3. Once the three runs' files are in `ml/artifacts/runs/` on the laptop,
   print a side-by-side table:

   ```powershell
   python ml\scripts\compare_runs.py
   ```

Credits: check what the first full run cost (Billing page, before and
after) before starting the next two. If credits run short, the
**Interruptible** option in C5 costs 50–80% less. A run that gets
interrupted continues with `--resume` (see C7).

---

## Part E — Writing it down (after every training run)

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

On the Lightning GPU machine (faster):

```bash
LECAD_ALLOW_TEST=1 python ml/scripts/evaluate.py --run ml/artifacts/runs/<final-run> --split test
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

---

## Appendix K — Kaggle instead of Lightning

Only if your Kaggle account has GPU access. Kaggle hosts the NIH dataset, so no download or cache step is needed: training reads the original images and `prepare_image()` shrinks them on the fly (slower, same result). Upload `ml/notebooks/kaggle_train.ipynb`; it clones the repo with the GitHub token (B2) stored as a Kaggle Secret.

### K0. Kaggle account with phone verification

1. Sign up or log in at **kaggle.com**.
2. Click your profile picture (top right) → **Settings**.
3. Find **Phone verification** and complete it. Without this, Kaggle won't
   give you a GPU or internet access in notebooks, and you need both.
   **ID verification does not replace it.** As of October 2026, an
   ID-verified account still cannot turn on Internet, and the Accelerator
   (GPU) option stays hidden until the phone is verified. If phone
   verification fails with "too many requests", stop retrying and contact
   Kaggle support (kaggle.com/contact).

### K1. Create the notebook

1. On kaggle.com, click **+ Create** (left sidebar) → **New Notebook**.
2. In the notebook editor: **File → Import Notebook** → upload
   `D:\Work\LeCAD-CXR\ml\notebooks\kaggle_train.ipynb`.
3. Rename it (click the title at the top left) to `lecad-cxr-train`.

### K2. Configure the session (right-hand panel)

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

### K3. Store the GitHub token as a Kaggle Secret

1. Top menu: **Add-ons → Secrets → Add Secret**.
2. **Label:** `GITHUB_TOKEN` (exactly this, the notebook looks for this name).
   **Value:** paste the token from B2 (Part B). Save.
3. Make sure the checkbox next to `GITHUB_TOKEN` is **ticked**. That
   attaches it to this notebook.

Secrets are never shown in the notebook or its outputs. The notebook also
removes the token from the cloned repo's settings straight after cloning.

### K4. A timing run (about 15-20 minutes)

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

### K5. The full run, in the background

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

### K6. Collect the results

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

### K7. If a run is cut off before it finishes

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
