# 0002 — Frontend scope and approach

**Status:** accepted · **Date:** 2026-10-10

## Context

The frontend is being built while model training waits on Kaggle access, so
neither a trained model nor the FastAPI service exists yet. Decisions
below were agreed on 2026-10-10.

## Decisions

**Contract first, mocked backend.** The API is specified in
`docs/api-contract.md`, mirrored as Zod schemas in the frontend, and
mocked with MSW (Mock Service Worker). The same mocks serve as test
fixtures. When FastAPI is built to the contract, mocking is switched off
and no frontend code changes.

**Graded likelihood bands first, numbers second.** Each finding is shown as
*Flagged for review / Borderline / Not flagged*, relative to its
validation-chosen threshold. The raw model output is available in a
detail view, labelled as a model score rather than a probability of
disease. This is the automation-bias mitigation named in the model card:
graded likelihood with Grad-CAM evidence rather than categorical
assertion. Sparse labels (Hernia, Pneumonia, Fibrosis) carry a
low-confidence marker.

**Accounts are created by an administrator only.** No self-registration
screen or endpoint. Account creation will be a backend command, not a UI
screen, in v1.

**Scope attestation before upload.** The user confirms the image is a frontal
chest X-ray of an adult before it can be submitted, because paediatric and
lateral images are out of scope (model card). The attestation is recorded
in the audit row.

**Disclaimer from the payload.** Every screen showing a prediction renders
the disclaimer text returned by `/predict`. A separate, static "research
prototype" banner appears on every page.

## Deferred to future increments

- **DICOM upload.** v1 accepts PNG and JPEG only (ChestX-ray14 is PNG).
  Clinical systems export DICOM, so a deployment in a Lesotho facility
  would need it. It brings windowing (VOI LUT), `MONOCHROME1` inversion,
  pixel-spacing metadata, and stripping patient identifiers in the DICOM
  header before anything leaves the browser.
- **Admin UI for accounts.** Backend command only in v1.
- **Calibrated probabilities.** If the model is calibrated later
  (e.g. temperature scaling), the detail view could show a calibrated
  estimate instead of a raw score.
