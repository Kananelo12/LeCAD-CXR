---
version: 1
slug: "web-src-app"
primary_target: "web/src/app"
related_targets: []
---

# Surface: LeCAD-CXR web app (all screens)

Scope: web/src/app: Sign in, Analyse (upload, results, heatmap viewer),
History, About the model. Visitor mode: Operate.

Audience and task: clinicians first (examiners second) at a laptop or
desktop browser, sometimes projected. Upload a frontal adult chest film,
read which findings are flagged, check the heatmap against the anatomy,
decide. Constraints: no features beyond the four screens; disclaimer from
the payload; research-prototype notice on every page; bands never by
colour alone.

Physical scene: a clinician at a clinic or office desk in daylight or
fluorescent light, or a meeting room with a projector. Light theme,
pinned by the user.

Pinned by the user: light only, blue accent, 60-30-10, inspo2 preferred
(web/public/leCad-CXR-inspo2.webp), inspo1 secondary. The analysed film
is the centrepiece; no anatomy art.

## Direction contract

THESIS: The film is the exhibit. Each working screen sets the X-ray on a
centre stage with the evidence panel beside it, as a clinical viewing
station rather than a form with an image attached; it refuses the
category default of a grey admin page with a yellow banner and a list.

OWN-WORLD: 60 cool pale ground (#eef1f5), 30 white panels with one soft
navy-tinted shadow and no borders, 10 clinical blue (#2563c9) for primary
actions, the active tab, selection and focus only. Amber only as caution
state. Geist, one family, fixed rem scale, medium-weight titles with
slight negative tracking, tabular numerals. Radius rule: panels 16px,
inner rows and inputs 10px, controls and tabs full pill. Phosphor icons,
one weight.

STORY: The clinician sees the film large, knows at once how many
findings need review, steps through each flagged finding's heatmap, opens
a score only when wanted, and reads the caution before trusting anything.

FIRST VIEWPORT: Top bar: blue logo tile and name left, pill tab track
(Analyse, History, About the model) centre-left, user name and sign out
right; slim research notice above. Page title plus one-line subtitle.
Results: caution card, then two columns: left the film on its stage with
a floating pill toolbar docked on its lower edge, analysis record below;
right the findings panel, selected finding raised as a white card.
Upload: same two columns, drop stage left, confirm-and-analyse panel right.

FORM: Pinned by the user's brief (inspo2-led clinical dashboard);
concept-seed not run, so no seed key. Signature move: the floating pill
toolbar on the film (previous / current finding / next, heatmap toggle,
opacity), after inspo2's "3D View" pill, with the matching finding row
lifting in the panel.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Logo: none exists; a blue tile with a generic Phosphor scan glyph stands
  in until the user supplies one.
- The "near" band margin (half the threshold) remains provisional.
