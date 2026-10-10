# API contract — v1

The HTTP interface between the Next.js frontend (`web/`) and the FastAPI
service (`ml/src/lecad/serving/`). Both sides are built to this document.

- The frontend validates every response against the Zod schemas in
  `web/src/lib/api/schemas.ts`. A response that drifts from this contract
  fails loudly in the browser rather than rendering something wrong.
- Until the FastAPI service exists, the frontend runs against mock
  handlers in `web/src/mocks/` that implement this contract.

Change this file, the schemas and the FastAPI models together, in one commit.

## Conventions

- The browser calls `/api/*` on the Next.js origin. Next rewrites it to
  `${API_URL}/*`, so FastAPI routes are written **without** the `/api`
  prefix (`POST /predict`, not `POST /api/predict`).
- JSON bodies, `snake_case` keys, timestamps in ISO 8601 UTC.
- Metrics that cannot be computed (`NaN` in `lecad.metrics`) are sent as
  `null`. JSON has no NaN.
- Errors use FastAPI's default shape: `{"detail": "<human-readable message>"}`.

| Status | Meaning |
|---|---|
| 401 | Not signed in, or session expired. The frontend sends the user to `/login`. |
| 403 | Signed in but not allowed. |
| 413 | Upload larger than 10 MB. |
| 415 | Upload is not PNG or JPEG. |
| 422 | Request is malformed, or `scope_confirmed` was not `true`. |
| 429 | Too many failed sign-ins for this username (5 in 15 minutes). |

## Authentication

Session is an httpOnly, `SameSite=Lax` cookie holding a short-lived JWT,
set by FastAPI. The frontend never sees the token.

**Accounts are created by an administrator only.** There is no sign-up
endpoint. See `docs/decisions/0002-frontend.md`.

### `User`

```json
{ "id": "u_01", "username": "mokoena", "display_name": "Dr T. Mokoena", "role": "clinician" }
```

`role` is `"clinician"` or `"admin"`.

### `POST /auth/login`

Body `{"username": "...", "password": "..."}`. On success sets the cookie
and returns `{"user": User}`. Wrong credentials: **401** with a generic
detail that does not say which field was wrong. After 5 failures for one
username within 15 minutes: **429** until the window passes.

The session lasts 30 minutes and is renewed by any authenticated request
made after half of that, so an idle session ends and an active one does not.

### `POST /auth/logout`

Clears the cookie. **204**, also when no session exists.

### `GET /auth/me`

`{"user": User}` or **401**.

## Prediction

### `POST /predict`

`multipart/form-data`:

| Field | Value |
|---|---|
| `image` | PNG or JPEG, at most 10 MB |
| `scope_confirmed` | `"true"` — the user attested the image is a frontal chest X-ray of an adult (model card: out of scope otherwise). Recorded in the audit row. |

The image is preprocessed with `lecad.transforms.build_transform("eval")`,
scored, and **not stored**. The audit row records its SHA-256.

Response **200**:

```json
{
  "request_id": "6f1c…",
  "created_at": "2026-10-10T09:14:03Z",
  "image_sha256": "9b2e…(64 hex chars)",
  "model": { "version": "densenet121-2026-10-20-a1b2c3d", "architecture": "densenet121" },
  "disclaimer": "Decision support only — not a diagnosis. …",
  "findings": [
    { "label": "Atelectasis", "probability": 0.31, "threshold": 0.12, "band": "above", "sparse": false }
  ],
  "heatmaps": {
    "Atelectasis": [[0.0, 0.1, …], …]
  }
}
```

**`disclaimer`** — the frontend renders this text on every screen that
shows the prediction. It is never hardcoded in the frontend.

**`findings`** — exactly 14 entries, one per label, in `lecad.labels.LABELS`
order. The frontend sorts for display.

- `probability` — sigmoid output, 0–1. Not calibrated. It is not a
  probability of disease and the UI does not present it as one.
- `threshold` — the per-class Youden threshold from the checkpoint, chosen
  on validation.
- `band` — computed **by the server** so the policy lives in one place:

  | Band | Rule | UI wording |
  |---|---|---|
  | `above` | `probability >= threshold` | Flagged for review |
  | `near` | `0.5 * threshold <= probability < threshold` | Borderline |
  | `below` | `probability < 0.5 * threshold` | Not flagged |

  The `near` margin (half the threshold) is provisional and to be reviewed
  with the supervisor.
- `sparse` — `true` for labels in `lecad.labels.SPARSE_LABELS`. The UI marks
  these as low-confidence estimates.

**`heatmaps`** — Grad-CAM for each finding whose band is `above`, at most
five (the highest probabilities). Keys are labels. Each value is a
row-major grid of numbers in 0–1, top row first, at the target layer's
resolution (e.g. 7×7 for DenseNet-121 at 224 px). The grid covers the
**whole** image: eval preprocessing resizes to a square without cropping,
so the frontend stretches the grid over the full image. Heatmaps are
computed in the same request because the image is not kept for a
later one.

## History

### `GET /history?limit=20&cursor=<opaque>`

The signed-in user's own audit rows, newest first. No images, because
none are stored.

```json
{
  "items": [
    {
      "request_id": "6f1c…",
      "created_at": "2026-10-10T09:14:03Z",
      "image_sha256": "9b2e…",
      "model_version": "densenet121-2026-10-20-a1b2c3d",
      "flagged": ["Effusion", "Atelectasis"]
    }
  ],
  "next_cursor": null
}
```

`flagged` lists labels whose band was `above`, highest probability first.
`limit` defaults to 20, maximum 100. `next_cursor` is `null` on the last page.

## Model

### `GET /model`

Read from the served checkpoint (`architecture`, `image_size`,
`val_metrics`, `thresholds`).

```json
{
  "version": "densenet121-2026-10-20-a1b2c3d",
  "architecture": "densenet121",
  "image_size": 224,
  "validation": {
    "n_images": 17000,
    "macro_auc": 0.82,
    "per_class": {
      "Hernia": {
        "n_pos": 22, "auc": 0.88, "pr_auc": 0.21, "threshold": 0.004,
        "sensitivity": 0.77, "specificity": 0.90, "sparse": true
      }
    }
  }
}
```

`per_class` has all 14 labels. Any metric may be `null`, and so may
`n_images` (e.g. the development fake model, which has no validation data).
