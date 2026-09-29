# 0001 — System architecture

**Status:** accepted · **Date:** 2026-09-20

## Context

The artefact is a system, not only a model: a browser interface, a served
model, authenticated users and an audit trail. The developer knows
Next.js and Express; the model is PyTorch.

## Decision

**One backend, in Python (FastAPI). No Express or Next.js API tier.**

Inference and Grad-CAM must run in a Python process. The audit log must be
written at the moment of inference, recording user, input hash, output and
model version — so FastAPI has to authenticate the user regardless of where
login happens. Once FastAPI validates tokens anyway, a Node auth tier
duplicates state with two places for the session to drift.

**Next.js is the frontend only**, served same-origin with FastAPI behind
`/api/*` via Next rewrites. This removes CORS configuration entirely and
makes httpOnly cookies straightforward.

**Training and serving share one Python package.** `lecad.transforms` is
imported by both, so training/serving skew is structurally impossible
rather than a thing to remember.

```
Next.js (UI)
   │  /api/*  ── rewrite ──►  FastAPI
   │                            ├── auth    argon2id, httpOnly cookie, short JWT
   │                            ├── predict preprocess → model → Grad-CAM
   │                            └── audit   append-only, hash-chained
   └── PostgreSQL
```

## Audit log

Append-only. Per row: `user_id`, `timestamp`, `image_sha256`,
`model_version`, `predictions`, `prev_row_hash`.

Storing the hash rather than the image reconciles auditability with the
no-retention commitment in the ethics section: if an image is later
produced, the system can prove what it said about it; if not, no patient
data is held.

## Consequences

- Accounts and an audit log are artefact features, so a solution objective
  must require them, traceable to interview evidence. Without that, the
  build is unjustified under design science. **Open — depends on interview
  findings.**
- Chapter 3 needs updating: Table 3.3 (Streamlit → Next.js, FastAPI,
  PostgreSQL), a system-architecture subsection in 3.4.3, and an
  access-control/audit paragraph in 3.5.
- Cold starts on sleeping free tiers load the model (30–60s). Demo from a
  local or university machine; treat cloud deployment as a bonus.
