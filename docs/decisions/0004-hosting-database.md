# 0004 — Hosting the database on Neon

**Status:** accepted · **Date:** 2026-11-07

## Context

ADR 0001 made PostgreSQL the deployment database but did not say where it
runs. The serving guide only covered a local Docker container, which ties
the data to one laptop.

## Decisions

**Neon hosts the deployment database.** Project `LeCAD-CXR`
(`sparkling-cherry-56827249`) in the Joel Projects organization, PostgreSQL
18. Neon is plain PostgreSQL, so nothing in the code changes: the
append-only triggers on `audit_log` and the `pg_advisory_xact_lock` that
serialises audit writes both work there, and both were checked on the new
database.

**Region: AWS Europe (Frankfurt), `aws-eu-central-1`.** Neon has no African
region. Users, password hashes and the audit log (user, image hash, model
version, findings) are therefore stored in the EU. No images are stored.
The region cannot be changed later without moving the data to a new project.

**Use the direct connection, not the pooled one.** `DATABASE_URL` points at
the endpoint host without `-pooler`. The advisory lock is transaction-scoped
and would also work through the pooler, but the direct host avoids any
pooler surprises for a service with a handful of workers.

**The URL keeps the SQLAlchemy driver prefix.** Neon hands out
`postgresql://…`; `.env` must use `postgresql+psycopg://…` with Neon's
`sslmode=require` parameters left in place.

## Consequences

- The free plan suspends an idle database after about 5 minutes and closes
  its connections. The API therefore checks each pooled connection before
  use (`pool_pre_ping`, recycled after 240 s); without that, the first
  request after a quiet spell failed with a 500. An unreachable database
  is a 503 with `Retry-After`, never a crash. The sign-in page calls
  `GET /health` on opening to wake the database early, shows *Waking the
  database* when that takes more than a moment, and retries sign-in on
  503 by itself.
- Accounts are still created only with `python -m lecad.serving.admin`
  (ADR 0002). It now writes to Neon whenever `.env` points there.
- Local Docker PostgreSQL and SQLite remain fine for development and the
  PostgreSQL-only tests, which must never be pointed at the Neon database:
  they drop its tables.
- The audit head hash should still be recorded outside the database from
  time to time; Neon's history does not replace that check.
