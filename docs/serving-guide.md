# Running the system: API + web app

How to run LeCAD-CXR end to end on this laptop: the FastAPI service, its
database, and the web app in front of it. Every command is run from the
repository root (`D:\Work\LeCAD-CXR`) unless a step says otherwise.

Before a model is trained, the API runs with a **fake model**: everything
works (sign-in, upload, results, heatmaps, history, audit log), but the
findings are random. Every result says so in its disclaimer, and the model
version reads `FAKE-not-a-trained-model`. Step 9 swaps in the real model.

---

## 1. Install the API's Python packages (once)

Open a terminal in the repository root and activate the virtual environment:

```bash
.venv\Scripts\activate
```

Your prompt now starts with `(.venv)`. Then install:

```bash
pip install -e "ml[serve,dev]"
```

## 2. Choose a database

**Option A: SQLite (simplest, for trying things out).** Nothing to install.
Create the folder it will live in:

```bash
mkdir ml\artifacts
```

(If it says the folder already exists, that's fine.)

**Option B: PostgreSQL (what a deployment uses).** Needs Docker Desktop.

1. Start **Docker Desktop** from the Start menu and wait until it says
   *Engine running* (bottom-left of its window).
2. Run:

   ```bash
   docker run -d --name lecad-pg -e POSTGRES_USER=lecad -e POSTGRES_PASSWORD=lecad -e POSTGRES_DB=lecad -p 5432:5432 -v lecad-pg-data:/var/lib/postgresql/data postgres:16-alpine
   ```

   The `-v lecad-pg-data:...` part keeps the data when the container
   stops. Next time, start it again with `docker start lecad-pg`.

**Option C: Neon (the hosted deployment database, ADR 0004).** Nothing to
install. The project is `LeCAD-CXR` in the Joel Projects organization,
AWS Europe (Frankfurt).

1. Open https://console.neon.tech/app/projects/sparkling-cherry-56827249/
   and sign in with the account that belongs to Joel Projects.
2. Click **Connect** (top right of the project dashboard).
3. In the window that opens, turn **Connection pooling** *off*. The host
   name must not contain `-pooler`.
4. Copy the connection string. It starts with `postgresql://` and ends
   with `?sslmode=require&channel_binding=require`.

You will paste it into `.env` in step 3. Neon's free plan puts the
database to sleep when nobody uses it, so the first request after a quiet
spell takes a few seconds longer.

With PostgreSQL (Options B and C), the database itself refuses any change or
deletion of audit rows. SQLite cannot do that; the hash chain still detects
tampering.

## 3. Fill in `.env`

If you don't have a `.env` file in the repository root yet, copy the example:

```bash
copy .env.example .env
```

Open `.env` in VS Code and find the `API` section at the bottom.

1. **DATABASE_URL**
   - Option A (SQLite): change it to
     `DATABASE_URL=sqlite:///./ml/artifacts/lecad.db`
   - Option B (PostgreSQL): leave it as it is.
   - Option C (Neon): paste the connection string after `DATABASE_URL=`,
     then change its start from `postgresql://` to `postgresql+psycopg://`.
     Keep the rest, including `?sslmode=require&channel_binding=require`.
2. **JWT_SECRET.** Generate a random value:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   Copy the line it prints and paste it after `JWT_SECRET=`, replacing
   the placeholder. The API will not start with the placeholder. Never
   commit `.env` (git already ignores it).
3. Leave `LECAD_FAKE_MODEL=1` and `LECAD_COOKIE_SECURE=0` as they are.

Save the file.

## 4. Create your first account

There is no sign-up page: accounts are created here, by an administrator.

```bash
python -m lecad.serving.admin create-user --username mokoena --display-name "Dr T. Mokoena"
```

It asks for a password twice (at least 12 characters). Nothing appears
while you type; that is normal. Add `--role admin` for an administrator.

Other account commands:

```bash
python -m lecad.serving.admin list-users
python -m lecad.serving.admin set-password --username mokoena
python -m lecad.serving.admin deactivate --username mokoena
python -m lecad.serving.admin activate --username mokoena
```

A deactivated user is signed out at their next request.

## 5. Start the API

```bash
uvicorn lecad.serving.app:app --port 8000
```

Leave this terminal open. To check it is running, open
http://localhost:8000/docs in a browser: you should see the list of
endpoints. Press `Ctrl+C` in the terminal to stop it.

## 6. Point the web app at the API (once)

In the `web` folder, create a file named `.env.local` containing one line:

```
API_URL=http://localhost:8000
```

This switches off the mock API the web app otherwise uses.

## 7. Start the web app

Open a **second** terminal:

```bash
cd web
npm run dev
```

Open http://localhost:3000 and sign in with the account from step 4. The
"mock API" tag in the bottom-right corner should be gone.

## 8. Check the audit log

Every analysis writes one audit row: who, when, the image's SHA-256
fingerprint, the model version, and what was shown. The image itself is
never stored. To check nobody has altered the log:

```bash
python -m lecad.serving.admin verify-audit
```

It prints `Audit log intact` and a **head hash**. Copy the head hash into a
dated note somewhere outside this laptop's database from time to time. A
hash chain cannot notice the newest rows being deleted, but a head hash
recorded earlier can.

## 9. Use the trained model

The deployed model is DenseNet-121 at the 90%-sensitivity operating point
(`docs/model-card.md`, *Model selection and operating point*):
`ml/artifacts/runs/baseline-densenet121-20261010-201111/model_sens90.pt`.
If it isn't on this laptop, collect it from the training machine (C8 in
`docs/training-guide.md`), or rebuild it from `best.pt` and the validation
predictions with `ml/scripts/set_operating_point.py`.

In `.env`:

1. Set the **full path** (a relative path depends on the folder the API is
   started from):
   `LECAD_MODEL_PATH=D:/Work/LeCAD-CXR/ml/artifacts/runs/baseline-densenet121-20261010-201111/model_sens90.pt`
2. Delete any `LECAD_FAKE_MODEL=1` line (only one of the two may be set).

Restart the API (step 5). The model version becomes the architecture plus
the first 12 characters of the checkpoint file's SHA-256
(`densenet121-00cd10b12611` for the deployed file), so each audit row names
the exact weights and thresholds used. On a laptop CPU, one analysis,
Grad-CAM included, takes about 0.25–0.5 s.

The checkpoint is loaded with `weights_only=True`: a tampered file cannot
run code when it is loaded.

## 10. Tests

```bash
cd ml
pytest
```

The PostgreSQL-only tests (append-only trigger, concurrent writes) are
skipped unless you give them a **throwaway** database. They drop its tables,
so never point them at the Neon database.

```bash
docker run -d --rm --name lecad-pg-test -e POSTGRES_USER=lecad -e POSTGRES_PASSWORD=lecad -e POSTGRES_DB=lecad -p 55432:5432 postgres:16-alpine
set LECAD_TEST_POSTGRES_URL=postgresql+psycopg://lecad:lecad@localhost:55432/lecad
pytest
docker stop lecad-pg-test
```

(`set` is for the Windows command prompt; in PowerShell use
`$env:LECAD_TEST_POSTGRES_URL="..."`.)

To run the browser test against the real API, start the API (step 5) and
make sure no `npm run dev` is running, then from `web`:

```bash
set API_URL=http://localhost:8000
set E2E_USERNAME=mokoena
set E2E_PASSWORD=<that account's password>
npm run test:e2e
```

The test expects the account to have no analyses yet, so use a fresh one.

## Troubleshooting

| Message | Fix |
|---|---|
| `JWT_SECRET must be a random value…` | Step 3.2: replace the placeholder. |
| `Set exactly one of LECAD_MODEL_PATH … or LECAD_FAKE_MODEL=1` | `.env` has both or neither. |
| `DATABASE_URL is not set.` | `.env` is missing, or you are not in the repository root. |
| `unable to open database file` | SQLite: create `ml\artifacts` (step 2A) and run from the repository root. |
| `connection refused` on port 5432 | PostgreSQL: `docker start lecad-pg`, with Docker Desktop running. |
| `No module named 'psycopg2'` | Neon: the URL must start with `postgresql+psycopg://` (step 3.1, Option C). |
| First request hangs a few seconds, then works | Neon was asleep after a quiet spell; that is normal. |
| Sign-in "works" but you are sent back to the login page | `LECAD_COOKIE_SECURE=0` is missing while using plain `http://`. |
| `Too many failed sign-in attempts` | 5 wrong passwords in 15 minutes. Wait, or restart the API. |
| `address already in use` | Something already uses that port; stop it, or use `--port 8001` (and update `web/.env.local`). |

## Known limits (prototype)

- Database tables are created on startup. A deployment that must change
  its schema later should move to migrations (Alembic).
- The sign-in throttle is in memory: per process, cleared on restart.
- Sessions are stateless tokens. Signing out deletes the cookie; a copied
  token stays valid until it expires (at most 30 minutes). Deactivating
  the account ends it at once.
