---
name: LeCAD-CXR
description: Chest X-ray decision support, set as a calm clinical viewing station.
colors:
  clinical-blue: "#2563c9"
  clinical-blue-deep: "#1c4fa6"
  blue-mist: "#e7eefb"
  ground: "#eef1f5"
  ground-deep: "#e2e7ee"
  panel: "#ffffff"
  inset: "#f5f7fa"
  hairline: "#dde3eb"
  ink: "#0f1b2d"
  slate: "#566376"
  flag-amber: "#8f4400"
  flag-amber-wash: "#fff0dd"
  borderline-ochre: "#6e5400"
  borderline-ochre-wash: "#fbf3d6"
  clear-slate: "#4a5866"
  caution-brown: "#6b3d00"
  caution-wash: "#fff7ea"
  error-red: "#b42318"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.5
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum"
rounded:
  badge: "6px"
  inset: "10px"
  panel: "16px"
  pill: "9999px"
spacing:
  row-gap: "8px"
  inset-padding: "14px"
  panel-padding: "24px"
  panel-gap: "24px"
  page-gutter: "32px"
components:
  button-primary:
    backgroundColor: "{colors.clinical-blue}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.clinical-blue-deep}"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-ghost:
    textColor: "{colors.slate}"
    rounded: "{rounded.pill}"
    padding: "10px 12px"
  nav-tab-current:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  nav-tab:
    textColor: "{colors.slate}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  input:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inset}"
    padding: "10px 14px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-padding}"
  finding-row:
    backgroundColor: "{colors.inset}"
    rounded: "{rounded.inset}"
    padding: "12px 14px"
  finding-row-selected:
    backgroundColor: "{colors.panel}"
  band-flagged:
    backgroundColor: "{colors.flag-amber-wash}"
    textColor: "{colors.flag-amber}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
  band-borderline:
    backgroundColor: "{colors.borderline-ochre-wash}"
    textColor: "{colors.borderline-ochre}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
  band-not-flagged:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.clear-slate}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
---

# Design System: LeCAD-CXR

## Overview

**Creative North Star: "The Viewing Station"**

The chest film is the exhibit. Every working screen sets the X-ray, or the
place it will go, on a centre stage, with the evidence panel beside it, the
way a reporting station puts the film first and the notes second. The
system stays quiet so the radiograph and the model's evidence carry the
screen: a cool, light ground, white panels, and one clinical blue spent
only where a clinician acts or chooses.

It is a light-only system (a user decision, recorded in PRODUCT.md) for
clinicians at a laptop or desktop in daylight or office light, sometimes
on a projector. Familiarity beats flourish: standard controls, one
workhorse sans, and colour that always means something.

**Key Characteristics:**
- The film sits on a near-black stage inside a white panel; nothing ever
  covers the image.
- 60-30-10: cool pale ground, white panels, clinical blue for action,
  current tab, selection and focus.
- Graded evidence is never colour alone: every band has an icon and words.
- One elevation, one family, one corner system.

## Colors

The palette follows the 60-30-10 rule: the ground covers most of the
screen, white panels carry the content, clinical blue is the 10%.

### Primary
- **Clinical Blue** (#2563c9): primary buttons, the current navigation tab's
  icon weight, selected finding ("Heatmap shown"), the heatmap switch when
  on, the drop target, focus rings, caret and links that act. White text on
  it passes 5.6:1.
- **Clinical Blue Deep** (#1c4fa6): hover and pressed state of primary
  buttons only.
- **Blue Mist** (#e7eefb): the soft field behind an active blue control
  (heatmap switch on, drop target, dragging).

### Neutral
- **Ground** (#eef1f5): the page. The 60.
- **Ground Deep** (#e2e7ee): the navigation track and the research notice
  strip; a second neutral layer for chrome.
- **Panel** (#ffffff): every content container. The 30.
- **Inset** (#f5f7fa): rows, inputs and table headers inside a panel.
- **Hairline** (#dde3eb): table row dividers and the one rule in a panel.
- **Ink** (#0f1b2d): text and headings.
- **Slate** (#566376): secondary text (5.4:1 on Ground, 6.1:1 on Panel).

### State
- **Flag Amber** (#8f4400 on #fff0dd): "Review suggested" and suggested
  labels in History.
- **Borderline Ochre** (#6e5400 on #fbf3d6): "Weaker signal".
- **Clear Slate** (#4a5866 on #eef1f5): "Not detected by this tool".
- **Caution Brown** (#6b3d00 on #fff7ea): the per-prediction disclaimer.
- **Error Red** (#b42318): form and request errors.

### Named Rules
**The Ten Percent Rule.** Blue marks only something the clinician can do,
has chosen, or is focused on. Section icons, bullets, avatars and
decoration stay neutral; if removing the blue would not change what the
user can do or knows, it should not be blue.

**The No Red/Green Rule.** Bands avoid red and green. "Flagged" is a prompt
to look, not a diagnosis, and must never read as an alarm or an all-clear.

## Typography

Geist carries everything; Geist Mono only for data that is measured or
machine-made (scores, fingerprints, model versions, request IDs).

### Hierarchy
- **Display** (2.75rem, 2.25rem on phones, weight 500, -0.03em): one page
  title per screen.
- **Headline** (1.5rem, 500, -0.02em): the result summary, "3 findings
  flagged for review".
- **Title** (17px, 500, -0.01em): panel headings and page subtitles.
- **Body** (0.875rem, 400, line-height 1.5): rows, captions, helper text.
- **Label** (0.75rem, 500): band badges, low-confidence tags, small notes.
- **Data** (Geist Mono 13px, tabular figures): scores, hashes, versions.

### Named Rules
**The One Family Rule.** No display face, no serif. Hierarchy comes from
size and weight steps of the same family.

**The Measured Numbers Rule.** Every number that is compared or copied
uses tabular figures.

## Layout

- Content width caps at 1360px with a 32px gutter (16px on phones).
- Working screens use two columns from 1024px: the stage (about 55%) and
  the evidence panel (minimum 360px). The film's height follows the
  viewport so the film and its toolbar fit a 1440x900 screen.
- Reading order is film, findings, record. Phones stack in that order;
  desktop puts findings in the right column beside both.
- Page header: title, then a one-line subtitle, then the work. More space
  above a panel than inside it (24px between panels, 24px panel padding).

## Elevation & Depth

One elevation for panels, one lift for selection. Shadows are tinted to
the ink's navy and fall from above; panels never also carry a border.

- **Panel shadow** `0 1px 2px rgb(15 27 45 / 0.04), 0 10px 28px -14px rgb(15 27 45 / 0.16)`:
  every panel, primary and secondary buttons, the current tab.
- **Raised shadow** `0 1px 2px rgb(15 27 45 / 0.06), 0 14px 32px -12px rgb(15 27 45 / 0.22)`:
  the selected finding row and the floating film toolbar.

**The One Lift Rule.** Only the current selection rises above a panel. If
two things inside a panel are raised, one of them is wrong.

## Shapes

**The Radius Ladder Rule.** Panels 16px; rows, inputs and the film inset
10px; badges 6px; controls (buttons, tabs, the toolbar, the user chip)
full pill. A shape tells you what something is: pills are pressed, 16px
holds content, 10px sits inside it.

## Components

### Buttons
Full pills, 14px medium text. Primary is Clinical Blue with white text;
secondary is a white pill with the panel shadow; ghost is Slate text that
gains the Ground Deep field on hover. All press to 98% scale; transitions
150ms ease-out. Disabled is 50% opacity with no press.

### Chips
Band badges are 6px-radius labels with a filled icon (flag, half circle,
minus) and words, in their state colour pair. The low-confidence tag is a
neutral 6px label with a hairline ring.

### Cards / Containers
The panel: white, 16px radius, panel shadow, 24px padding (20px on
phones), headed by a 32px neutral icon tile and a Title. Panels never nest
panels; inner groups are Inset rows.

### Inputs / Fields
Inset field, 10px radius, hairline ring; on focus the field turns white
with a 2px Clinical Blue ring. Labels sit above, errors below in Error Red.

### Navigation
A pill track in Ground Deep holding the three destinations; the current
one is a white pill with the panel shadow and a bold icon. On phones the
icons drop and the three tabs share the width equally.

### Film stage (signature)
The X-ray on a near-black inset (#060a12) inside a white panel, never
cropped and never covered. The heatmap toolbar is a white pill with the
raised shadow, straddling the panel's lower edge (below the film on
phones): previous / finding name / next, a Heatmap switch, and an opacity
slider. Selecting a finding in the panel lifts its row and swaps the
overlay; the overlay fades over 200ms. While the model runs, a soft blue
band sweeps down the film (static under reduced motion).

## Do's and Don'ts

### Do:
- Do let the film carry the screen; keep everything around it neutral.
- Do pair every state colour with an icon and words.
- Do spend blue only on action, selection, current location and focus.
- Do keep the toolbar and any overlay clear of the image edges, where the
  lung bases and costophrenic angles sit.
- Do theme browser surfaces (selection, caret, scrollbar, focus) from the
  palette.

### Don't:
- Don't add a dark theme or invert a section.
- Don't use red or green for findings.
- Don't put decorative anatomy art, invented logos or stock imagery on
  working screens; the uploaded film is the only image.
- Don't nest panels or give a panel both a border and a shadow.
- Don't use em dashes in interface copy.
