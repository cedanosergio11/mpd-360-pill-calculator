/**
 * PillView versioning — bump this file on every user-facing change.
 *
 *  major.minor.patch.build   (shown as v 1.0.0.0)
 *  - build  : visual / copy / small fix
 *  - patch  : contained feature
 *  - minor  : new workflow or tab
 *  - major  : breaking calc / procedure change
 *
 * Always prepend a ReleaseNote and mirror it in CHANGELOG.md.
 */

export const APP_VERSION = "1.0.6.2";

export type ReleaseNote = {
  version: string;
  date: string;
  title: string;
  notes: string[];
};

export const RELEASES: ReleaseNote[] = [
  {
    version: "1.0.6.2",
    date: "2026-09-01",
    title: "WoolWorth Load well",
    notes: [
      "Load well includes WoolWorth #11 HH (R Lacy, Tanner Hembling, 2026-07-26).",
    ],
  },
  {
    version: "1.0.6.1",
    date: "2026-09-01",
    title: "Displacement wellbore ladder",
    notes: [
      "Displacement tab shows the closed-end RIH stops on a wellbore strip next to the stage list.",
    ],
  },
  {
    version: "1.0.6.0",
    date: "2026-09-01",
    title: "RIH stop at shoe FIT",
    notes: [
      "Displacement tab: run closed-end pipe into the no-DP pill until shoe ESD hits FIT, circulate extra KMW, repeat.",
    ],
  },
  {
    version: "1.0.5.0",
    date: "2026-09-01",
    title: "MASP at shoe TVD",
    notes: [
      "MASP is (FIT − MW) × 0.052 × casing shoe TVD, not anchor TVD.",
    ],
  },
  {
    version: "1.0.4.1",
    date: "2026-09-01",
    title: "FIT print confirm and banner",
    notes: [
      "Print stays enabled when shoe ESD is at or above FIT; confirm first, then a red not-issuable banner on SDS-FRM-087.",
    ],
  },
  {
    version: "1.0.4.0",
    date: "2026-09-01",
    title: "GitHub Pages SPA",
    notes: ["SPA build at /mpd-360-pill-calculator/ plus 404.html for GitHub Pages."],
  },
  {
    version: "1.0.3.4",
    date: "2026-09-01",
    title: "Print fidelity and sim ≠ procedure chip",
    notes: [
      "Field sheet print uses ink-on-paper colors; long spotting schedules paginate instead of clipping.",
      "Sticky chip when the simulator has been moved off the procedure, with From procedure to reseat it. Print still uses the field sheet.",
    ],
  },
  {
    version: "1.0.3.3",
    date: "2026-08-25",
    title: "POOH pill volume honors open hole",
    notes: [
      "No-DP pill volume uses 6.75 in OH + 6.88 in casing instead of casing ID for the whole height.",
      "After the pipe is pulled, annulus KMW = spotted + KMW backfill (18.0 ppge Momentum: 460 bbl).",
    ],
  },
  {
    version: "1.0.3.2",
    date: "2026-08-25",
    title: "Honor open-hole geometry in room-with-pipe",
    notes: [
      "KMW that fits with pipe is casing annulus + OH annulus + DP bore to the bit, not a uniform 6.88 in hole.",
      "18.0 ppge on Momentum geometry: 462 needed, 455 fits, 7 bbl KMW backfill while POOH.",
    ],
  },
  {
    version: "1.0.3.1",
    date: "2026-08-25",
    title: "Room-with-pipe backfill",
    notes: [
      "KMW that fits with pipe in the hole is spot × (C_ann + C_DP), not pill-height annulus + DP volume.",
      "18.0 ppge on Momentum geometry: 462 needed, 457 fits, 5 bbl KMW backfill while POOH.",
    ],
  },
  {
    version: "1.0.3.0",
    date: "2026-08-25",
    title: "KMW backfill while POOH",
    notes: [
      "When needed KMW (no-DP) is more than fits with pipe in the hole, the shortfall is backfilled with KMW while tripping.",
      "Procedure step 10 shows the red note. Simulator applies those barrels to the pill as you pull with Trip Tank On.",
    ],
  },
  {
    version: "1.0.2.4",
    date: "2026-08-25",
    title: "Blank startup",
    notes: [
      "App opens on empty well fields instead of Momentum.",
      "Momentum remains under Load well → Workbook examples. Saved wells are kept.",
    ],
  },
  {
    version: "1.0.2.3",
    date: "2026-08-24",
    title: "Keep tables on one page",
    notes: ["Procedure tables move to the next page instead of splitting across a page break."],
  },
  {
    version: "1.0.2.2",
    date: "2026-08-24",
    title: "Procedure table spacing",
    notes: ["More space after the well grid, trip table, and spotting schedule before the next step."],
  },
  {
    version: "1.0.2.1",
    date: "2026-08-24",
    title: "Procedure step spacing",
    notes: ["More space between numbered procedure steps on screen and in the PDF."],
  },
  {
    version: "1.0.2.0",
    date: "2026-08-24",
    title: "Equalize worked example",
    notes: [
      "Audit tab walks through C_ann, C_DP, as-pumped bit pressures, dump V, and equalized EMW using the loaded well.",
    ],
  },
  {
    version: "1.0.1.0",
    date: "2026-08-24",
    title: "Print / PDF field procedure",
    notes: [
      "Procedure prints as a letter-size field form: well block, numbered steps, trip table, spotting schedule.",
      "As-pumped vs equalized volumes, signature lines, SDS-FRM-087 footer, PillView version.",
      "Save-as-PDF uses a well-name filename. Screen chrome stays hidden.",
    ],
  },
  {
    version: "1.0.0.1",
    date: "2026-08-24",
    title: "Version log",
    notes: [
      "Clickable version label opens release notes.",
      "Single source of truth for app version going forward.",
    ],
  },
  {
    version: "1.0.0.0",
    date: "2026-08-24",
    title: "PillView 1.0",
    notes: [
      "Unified calculator + wellbore simulator (as-pumped / equalized, float, chase, trip tank).",
      "Procedure, spotting schedule, SBP vs strokes chart, displacement, cement, audit.",
      "Excel paste, save/load wells on this device, casing shoe on the schematic.",
      "Anchor EMW, air-cap U-tube, 200 ft/min slug math.",
    ],
  },
];

export function formatVersion(version = APP_VERSION) {
  return `v ${version}`;
}
