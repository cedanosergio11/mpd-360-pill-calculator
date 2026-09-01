# PillView release notes

Version scheme: `major.minor.patch.build` (shown in-app as `v 1.0.0.0`).

- **build** — visual / copy / small fix
- **patch** — contained feature
- **minor** — new workflow or tab
- **major** — breaking calc / procedure change

---

## 1.0.6.1 — 2026-09-01

Displacement wellbore ladder

- Displacement tab shows the closed-end RIH stops on a wellbore strip next to the stage list.

## 1.0.6.0 — 2026-09-01

RIH stop at shoe FIT

- Displacement tab: run closed-end pipe into the no-DP pill until shoe ESD hits FIT, circulate extra KMW, repeat.

## 1.0.5.0 — 2026-09-01

MASP at shoe TVD

- MASP is (FIT − MW) × 0.052 × casing shoe TVD, not anchor TVD.

## 1.0.4.1 — 2026-09-01

FIT print confirm and banner

- Print stays enabled when shoe ESD is at or above FIT; confirm first, then a red not-issuable banner on SDS-FRM-087.

## 1.0.4.0 — 2026-09-01

GitHub Pages SPA

- SPA build at `/mpd-360-pill-calculator/` plus `404.html` for GitHub Pages.

## 1.0.3.4 — 2026-09-01

Print fidelity and sim ≠ procedure chip

- Field sheet print uses ink-on-paper colors; long spotting schedules paginate instead of clipping.
- Sticky chip when the simulator has been moved off the procedure, with From procedure to reseat it. Print still uses the field sheet.
- GitHub Pages hosting at https://cedanosergio11.github.io/mpd-360-pill-calculator/.

## 1.0.3.3 — 2026-08-25

POOH pill volume honors open hole

- No-DP pill volume uses 6.75 in OH + 6.88 in casing instead of casing ID for the whole height.
- After the pipe is pulled, annulus KMW = spotted + KMW backfill (18.0 ppge Momentum: 460 bbl).

## 1.0.3.2 — 2026-08-25

Honor open-hole geometry in room-with-pipe

- KMW that fits with pipe is casing annulus + OH annulus + DP bore to the bit, not a uniform 6.88 in hole.
- 18.0 ppge on Momentum geometry: 462 needed, 455 fits, 7 bbl KMW backfill while POOH.

## 1.0.3.1 — 2026-08-25

Room-with-pipe backfill

- KMW that fits with pipe in the hole is spot × (C_ann + C_DP), not pill-height annulus + DP volume.
- 18.0 ppge on Momentum geometry: 462 needed, 457 fits, 5 bbl KMW backfill while POOH.

## 1.0.3.0 — 2026-08-25

KMW backfill while POOH

- When needed KMW (no-DP) is more than fits with pipe in the hole, the shortfall is backfilled with KMW while tripping.
- Procedure step 10 shows the red note. Simulator applies those barrels to the pill as you pull with Trip Tank On.

## 1.0.2.4 — 2026-08-25

Blank startup

- App opens on empty well fields instead of Momentum.
- Momentum remains under Load well → Workbook examples. Saved wells are kept.

## 1.0.2.3 — 2026-08-24

Keep tables on one page

- Procedure tables move to the next page instead of splitting across a page break.

## 1.0.2.2 — 2026-08-24

Procedure table spacing

- More space after the well grid, trip table, and spotting schedule before the next step.

## 1.0.2.1 — 2026-08-24

Procedure step spacing

- More space between numbered procedure steps on screen and in the PDF.

## 1.0.2.0 — 2026-08-24

Equalize worked example

- Audit tab walks through C_ann, C_DP, as-pumped bit pressures, dump V, and equalized EMW using the loaded well.

## 1.0.1.0 — 2026-08-24

Print / PDF field procedure

- Procedure prints as a letter-size field form: well block, numbered steps, trip table, spotting schedule.
- As-pumped vs equalized volumes, signature lines, SDS-FRM-087 footer, PillView version.
- Save-as-PDF uses a well-name filename. Screen chrome stays hidden.

## 1.0.0.1 — 2026-08-24

Version log

- Clickable version label opens release notes.
- Single source of truth for app version going forward.

## 1.0.0.0 — 2026-08-24

PillView 1.0

- Unified calculator + wellbore simulator (as-pumped / equalized, float, chase, trip tank).
- Procedure, spotting schedule, SBP vs strokes chart, displacement, cement, audit.
- Excel paste, save/load wells on this device, casing shoe on the schematic.
- Anchor EMW, air-cap U-tube, 200 ft/min slug math.
