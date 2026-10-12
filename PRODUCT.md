# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clinicians first: doctors reading frontal chest X-rays, using LeCAD-CXR in
evaluation sessions (including in Lesotho). They upload a film, read which
of 14 findings the model flags, check the Grad-CAM evidence against the
anatomy, and decide for themselves. The thesis supervisor and examiners
also see it, in demonstrations and the defence.

## Product Purpose

Decision support for multi-finding chest X-ray reading: a trained
classifier scores 14 ChestX-ray14 findings, the interface shows graded
likelihood with heatmap evidence, and the clinician keeps the decision.
Success is a clinician who can read a result correctly in seconds,
without over-trusting it, and an audit trail that proves what was shown.

## Positioning

Graded likelihood bands (flagged for review / borderline / not flagged)
against validation-chosen thresholds, with Grad-CAM evidence, instead of
categorical diagnoses; images are never stored, and every result is
recorded in a hash-chained audit log by image fingerprint.

## Operating Context

Runs in a laptop or desktop browser, sometimes on a projector during
demonstrations. Mobile must work but is not optimised for. Clinicians sign
in with administrator-created accounts. A session is: upload a PNG/JPEG,
confirm it is a frontal adult film, read the results, optionally review
past analyses (History) or the model's validation results (About).

## Capabilities and Constraints

- Screens: Sign in, Analyse (upload, results, heatmap viewer), History,
  About the model. Nothing else exists; do not design features the product
  does not have (no patient records, vitals, appointments, scheduling,
  notifications, search, prescriptions).
- 14 fixed findings in `lecad.labels.LABELS` order; Hernia, Pneumonia and
  Fibrosis are sparse and carry a low-confidence marker.
- Images are not stored; History shows fingerprints, not thumbnails.
- The disclaimer shown with a prediction comes from the API payload.
- No DICOM yet (PNG/JPEG only).
- Research prototype, not a medical device; this is stated on every page.

## Brand Commitments

- Light theme only; no dark theme (user decision, 2026-10-11).
- Blue accents, applied with the 60-30-10 colour rule.
- Visual references chosen by the user: `web/public/leCad-CXR-inspo2.webp`
  (preferred) and `web/public/leCad-CXR-inspo.webp`.
- Name: LeCAD-CXR (Lesotho Computer-Aided Detection for Chest X-ray).

## Evidence on Hand

- The analysed X-ray itself (local preview) and its Grad-CAM grids.
- Real validation metrics from the trained checkpoints (`docs/model-card.md`).
- No logo, photography or illustration assets exist; none may be invented.
- No user testimonials or clinical validation results exist.

## Product Principles

1. Support the clinician's judgement; never present output as a diagnosis.
2. Show evidence and uncertainty together: band, score on demand, heatmap,
   low-confidence markers.
3. Truthful scope: only what the system does, and say what it cannot do.
4. Privacy by construction: no image retention, fingerprint-only history.

## Accessibility & Inclusion

WCAG AA contrast; bands never rely on colour alone; full keyboard use;
focus moves to results when they appear.
