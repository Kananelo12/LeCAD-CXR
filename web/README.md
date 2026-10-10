# web — Next.js frontend

The browser interface for LeCAD-CXR: sign in, upload a chest X-ray, read
the graded findings with Grad-CAM heatmaps, review your past analyses.

Frontend only — no API routes in the request path. It talks to FastAPI
through a Next rewrite (`/api/*` → `${API_URL}/*`), so the browser sees
one origin and the session cookie needs no CORS (ADR 0001).

The interface is specified in [docs/api-contract.md](../docs/api-contract.md).
Decisions behind the screens are in
[ADR 0002](../docs/decisions/0002-frontend.md).

## Run it

Needs Node 22 (`node -v` to check).

1. Open a terminal in this `web` folder.
2. Install dependencies, once:

   ```bash
   npm install
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser.
5. Sign in as `clinician`, password `demo`.

### Mock API

Until the FastAPI service exists, `npm run dev` runs against a **mock
API** whenever `API_URL` is not set. A small "mock API" tag in the
bottom-right corner shows it is on. The mock:

- is implemented with MSW in `src/mocks/`, following the contract;
- returns made-up findings, seeded from the image's SHA-256 so the same
  file always gives the same result. **Nothing it shows is a model output.**
- keeps its "session" and history in the browser's localStorage.

### Real API

Start FastAPI first ([docs/serving-guide.md](../docs/serving-guide.md),
steps 1–5), then create `web/.env.local`:

```bash
API_URL=http://localhost:8000
```

and restart `npm run dev`. The mock switches off; no code changes.

## Checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # unit and component tests (Vitest), incl. mock-vs-contract
npm run test:e2e    # end-to-end in Chromium (Playwright), against the mock
```

The first `test:e2e` needs a browser download: `npx playwright install chromium`.
Stop any running `npm run dev` first; Next allows one dev server per project.

## Rules

- **Every screen that shows a prediction also shows that it is decision
  support, not a diagnosis.** The disclaimer comes from the API response;
  never hardcode it. There is a test for this.
- **Every response is validated** against the Zod schemas in
  `src/lib/api/schemas.ts`. When the contract changes, change
  `docs/api-contract.md`, the schemas and FastAPI together.
- **Label order lives in one place** per language: `ml/src/lecad/labels.py`
  and `LABELS` in `schemas.ts`. Never retype the list.
- **Images never leave the analyse screen.** The preview is a local object
  URL; nothing is cached or stored in the browser.

## Layout

```
src/
├── app/
│   ├── login/            sign-in (accounts are admin-created; no sign-up)
│   └── (app)/            signed-in area, gated on /auth/me
│       ├── analyse/      upload → findings → heatmap viewer
│       ├── history/      your audit rows, by image fingerprint
│       └── about/        model card summary + validation metrics
├── components/           shared UI
├── lib/
│   ├── api/              contract schemas and the typed client
│   ├── auth.ts           session hooks
│   ├── heatmap.ts        Grad-CAM grid → canvas
│   └── labels.ts         display names and band wording
├── mocks/                MSW mock of the API
└── test/                 test setup
e2e/                      Playwright
```

## Not yet

- **DICOM upload** — deferred (ADR 0002). PNG and JPEG only for now.
- **Admin screen for accounts** — accounts are created with a backend command.
