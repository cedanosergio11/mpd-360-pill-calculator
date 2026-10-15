# Paste and simulator at PillView 1.0.7.1

Source commit: `99009230b0d3132c0f542b3b87fc2d05c6bc0660` (`9900923`), message "Steel table shoe EMW follows each row's pill (1.0.7.1)".

This note records those two features as they run at that commit, then proposes a 2.0 contract on the current core (`strokesSchedule`, `kpiVolumes`, `emwProfile`, tapered `stringSections`). The 2.0 contract does not call `src/lib/calc/engine-nodp.ts` and does not read `TRIP_TABLES` or `SURGE_*` from `src/lib/calc/tables.ts`.

Paste and `simulate` share one `Job`. `parseWellPaste` returns a parse result and does not take a job. `previewPaste` reads that result against the job, and `applyPaste` writes that preview onto the same job. `simulate` is called with that job. Neither feature keeps a second input record.

Feature order: TBD, Sergio to decide.

Line numbers below are from that commit.

---

## 1. Copy from Excel

### Where it sits

It is not a survey grid and not a field on the simulator. It is a **Paste from Excel** button that opens a dialog and writes `WellInputs` on the calculator store.

- Header, compact icon button: `src/components/app-shell.tsx` line 220, `<ExcelPasteButton compact />`, next to save / export / print. `aria-label` is "Paste from Excel".
- Inputs column, full-width button above the Well information section: `src/components/input-panel.tsx` lines 20–22.
- Dialog and apply: `src/components/excel-paste.tsx`.
- Parser: `src/lib/calc/paste.ts`. Tests: `src/lib/calc/paste.test.ts`.

The dialog copy says to copy the Well Information block on the Inputs sheet, from Well name through FIT / SafeVision ECD (`excel-paste.tsx` lines 50–53).

### Accepted format

Rows are label, then value, then an optional unit. There is no header row and no fixed column count.

Delimiters:

- Plain text rows split on `\r?\n`. Cells inside a row split on tab only (`cellsFromText`, `paste.ts` lines 224–228). A comma does not separate cells. A comma-separated line with no tab is one cell, and a row with fewer than two non-empty cells is dropped.
- If the string contains `<table` or `<tr`, HTML wins and the plain text is ignored (`parseWellPaste`, lines 235–236). The button does the same check on the clipboard: `text/html` is used when it matches `/<t[rdh]/i`, otherwise `text/plain` (`excel-paste.tsx` lines 60–67).
- HTML rows are `<tr>`, cells are `<td>` or `<th>`. Tags are stripped. `&nbsp;` becomes a space (`cellsFromHtml`, lines 212–221).

Header handling:

- There is no header. Every non-empty cell is tried as a label (`matchRule`).
- The first successful label on a row wins; the scan then `break`s to the next row (lines 243–258).
- A field already present in the patch is not overwritten (`rule.field in patch`, line 245). Later duplicates are ignored with no message.

Decimals, locale, units:

- Numbers: commas are removed first (every comma, with no check that three digits follow), then every character outside `[0-9.eE+-]` is removed, then `Number()` (`parseNumber`, lines 154–159). The decimal mark is `.`. `1,234.5` becomes `1234.5`. `1,5` becomes `15`. There is no locale and no comma-as-decimal. The 2.0 parser does not keep this strip-every-comma rule.
- A cell whose normalized text is in the unit set is skipped while looking for the value (lines 247–250). The number is stored as entered. Nothing converts ft to m, in to mm, or ppg to ppge.
- Recognized unit tokens, after `norm` (`paste.ts` lines 11–33): `ft`, `ft.`, `in`, `in.`, `ppg`, `ppge`, `ppge.`, `psi`, `gpm`, `bbl`, `bbls`, `bbls.`, `bbl/stk`, `bbls/stk`, `bbls/ft`, `bbls/ft.`, `stk`, `md`, `tvd`.
- Dates (`parseDate`, lines 161–178): `YYYY-MM-DD` prefix kept; `M.D.YY`, `M/D/YY`, or `M-D-YY` read as month, day, year (the fixture `8.19.26` becomes `2026-08-19`); a two-digit year at or above 70 becomes `19xx`, otherwise `20xx`; a bare number strictly between 20000 and 80000 is an Excel serial from 1899-12-30 UTC. Anything else is kept as trimmed text.
- `norm` (lines 117–125) lowercases, rewrites the sheet typo `prodcution` to `production`, turns `()` into spaces, turns `/_.,;:` into spaces, and collapses whitespace.

### What each label writes

State is `WellInputs` (`src/lib/calc/types.ts` lines 10–63). The paste does not write a survey array, a fluid table, or the simulator's `WellState`. The simulator later builds a three-station survey from casing, spot, and anchor MD/TVD (`surveyFromWell`, `src/lib/pill/from-calc.ts` lines 18–36).

Match priority when several labels hit the same cell is the longest label (`matchRule`, lines 136–151). A label matches when the normalized cell equals it, starts with it, or (only if the label is longer than 8 characters) contains it.

Sheet order in the Momentum fixture (`paste.test.ts` lines 4–33), which is the Well Information block order, not a column index:

| Sheet label (fixture) | `WellInputs` field | Kind | Unit on the fixture | What it is |
|---|---|---|---|---|
| Well name | `wellName` | text | | Well name |
| Client | `client` | text | | Client |
| Date | `date` | date | | Well date, stored `YYYY-MM-DD` |
| Produced By | `producedBy` | text | | Author |
| Current Well Depth (MD) | `currentDepthMd` | number | ft | Current MD. One of the depths the simulator takes as well depth |
| Anchor Point (BOC) (MD) | `anchorMd` | number | ft | Anchor MD |
| Anchor Point (BOC) (TVD) | `anchorTvd` | number | ft | Anchor TVD |
| Casing Depth (MD) | `casingMd` | number | ft | Casing shoe MD |
| Casing Depth (TVD) | `casingTvd` | number | ft | Casing shoe TVD |
| Spot Depth (MD) | `spotMd` | number | ft | Spot / pill-bottom MD. Simulator places the pipe here |
| Spot Depth (TVD) | `spotTvd` | number | ft | Spot TVD |
| Open Hole Diameter | `openHoleDia` | number | in | Open hole |
| Desired EMW @ Anchor Point | `desiredEmw` | number | ppge | Target EMW |
| OD Drill pipe | `odDp` | number | in | Pipe OD |
| ID Drill pipe | `idDp` | number | in | Pipe ID |
| ID Casing | `idCasing` | number | in | Casing ID |
| Current MW | `currentMw` | number | ppg | Active mud |
| Pump Displacement | `pumpDisp` | number | bbl/stk | Pump output |
| KMW | `kmw` | number | ppg | Pill weight |
| SBP on connection | `sbpConnection` | number | psi | Connection SBP |
| FIT | `fit` | number | ppge | FIT |
| Max Flow Rate | `maxFlowRate` | number | gpm | Max flow |
| Desired Resolution | `desiredResolution` | number | bbl | Pumping-schedule volume step. Not a simulator step |
| Initial Flow Rate | `initialFlowRate` | number | gpm | Schedule flow |
| Over Balance Pressure For Slug | `overbalanceSlug` | number | psi | Slug overbalance |
| Safevision Anchor Point ECD @ Initial Flow Rate (no Slug) | `safevisionNoSlug` | number | ppge | Entered SafeVision ECD. Stored as a number. The paste does not look up a table |
| Is this section Production or Intermediate? | `sectionType` | section | | `Production` or `Intermediate` |

Further labels in `RULES` (`paste.ts` lines 98–114), accepted but absent from that fixture:

| Labels | Field | Kind | Role |
|---|---|---|---|
| top slug | `topSlugBbl` | number | Slug volume, bbl |
| td depth | `tdDepth` | number | TD, ft |
| desired esd for offline cement | `cementDesiredEsd` | number | Cement ESD, ppg |
| new casing od | `newCasingOd` | number | in |
| new casing id | `newCasingId` | number | in |
| mw | `cementMw` | number | Cement MW, ppg. The short label `mw` is how this matches; `current mw` is longer and wins for Current MW |
| tapered string casing trigger, tapered casing | `taperedOn` | bool | Casing-taper switch |
| casing id larger | `casingIdLarger` | number | in |
| casing shoe depth md larger | `casingShoeMdLarger` | number | ft |
| liner id | `linerId` | number | in |
| liner hanger | `linerHangerMd` | number | ft |
| liner shoe | `linerShoeMd` | number | ft |
| od drill pipe 1, id drill pipe 1, length of dp 1 | `odDp1`, `idDp1`, `lengthDp1` | number | Upper string section, in / in / ft |
| od drill pipe 2, id drill pipe 2 | `odDp2`, `idDp2` | number | Lower string section, in. Length is not a paste field |

`pillMode` is not a paste field. `applyWellPaste` spreads the patch over the current inputs and leaves `pillMode` alone (`paste.ts` lines 264–266, test lines 61–65).

Calculated sheet rows are refused by `SKIP_LABELS` (`paste.ts` lines 35–64) when the normalized label equals the skip text, starts with it plus a space, or contains it. That list includes MASP, drill string capacity and volume, casing capacity, annular capacity, open hole capacity, height of pill, total pill volume, required pill, corrected pill, chase volume, final kwm, min height, balanced, static stripping, max dynamic, slug pressure, slug pill, strokes to pump, trip speeds, swab ap, dynamic pressure, and the section titles engineering inputs, horizontal section, relevant pill, pill calculations, calculations, only trigger. The test pins `MASP for this Procedure` so it does not create a `masp` key (`paste.test.ts` lines 67–71).

### Validation, errors, limits

The parser does not return errors. A row is skipped when it has fewer than two non-empty cells, the label matches nothing, the label is a unit or a skip label, the value cell is missing, or `coerce` returns `undefined` (blank, a unit token, a number that does not parse, a section that is neither production nor intermediate, a bool outside on/yes/true/1 and off/no/false/0). Numbers are not range-checked. There is no row cap and no length cap.

The only user-facing failure is in the dialog (`excel-paste.tsx` lines 21–28):

- `matched.length === 0` → toast "Nothing mapped. Copy the Well Information block (labels + values) from the Inputs sheet." Inputs are unchanged.
- Otherwise toast "Pasted N field(s) from Excel", then `setInputs(applyWellPaste(inputs, patch))`.

Apply is disabled while the textarea is blank. Cancel closes the dialog. A clipboard paste with a non-empty clip applies immediately and does not wait for the Apply button.

### Parsing code

`src/lib/calc/paste.ts`:

```154:159:src/lib/calc/paste.ts
function parseNumber(raw: string): number | "" {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.eE+-]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : "";
}
```

```212:266:src/lib/calc/paste.ts
function cellsFromHtml(html: string): string[][] {
  const rows: string[][] = [];
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trs) {
    const tds = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (tds.some((c) => c)) rows.push(tds);
  }
  return rows;
}

function cellsFromText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\t/))
    .filter((row) => row.some((c) => c.trim()));
}

export function parseWellPaste(text: string): {
  patch: Partial<WellInputs>;
  matched: string[];
} {
  const html = text.includes("<table") || text.includes("<tr") ? cellsFromHtml(text) : [];
  const rows = html.length ? html : cellsFromText(text);
  const patch: Partial<WellInputs> = {};
  const matched: string[] = [];

  for (const row of rows) {
    const cells = row.map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    for (let i = 0; i < cells.length - 1; i++) {
      const rule = matchRule(cells[i]);
      if (!rule || rule.field in patch) continue;
      let value: string | undefined;
      for (let j = i + 1; j < cells.length; j++) {
        if (isUnit(cells[j])) continue;
        value = cells[j];
        break;
      }
      if (value == null) continue;
      const coerced = coerce(rule.kind, value);
      if (coerced === undefined) continue;
      (patch as Record<string, unknown>)[rule.field] = coerced;
      matched.push(rule.field);
      break;
    }
  }

  return { patch, matched };
}

export function applyWellPaste(current: WellInputs, patch: Partial<WellInputs>): WellInputs {
  return { ...current, ...patch };
}
```

Label match and the skip list sit at `paste.ts` lines 35–152. The dialog apply and the empty-paste toast sit at `excel-paste.tsx` lines 21–32 and 60–67.

---

## 2. Simulator

### What it is

An interactive wellbore on the Simulator tab (`app-shell.tsx` lines 52, 63, 352–353). Default tab is `"simulator"` (`src/lib/store.ts`). It is not a clock. It does not step by time, by strokes, or by volume, and it has no play, pause, or speed control.

The user moves the pipe in measured depth. Each move replaces the zustand controls, then `computeModel` rebuilds the picture for that depth.

`Desired Resolution` (bbl) is a calculator input. `buildSchedule` (`src/lib/calc/schedule.ts` lines 25–28 and 98–167) walks the pumping sheet in volume steps of that size, up to 80 rows, snapping the last heavy-fluid step onto the pill volume and the last step onto the final chase volume. The simulator never calls `buildSchedule`.

### Inputs

From the procedure, via `geometryFromWell` and `pillFromProcedure` (`src/lib/pill/from-calc.ts`):

- Well depth is the max of current MD, TD, spot MD, casing MD, and anchor MD, or 10000 ft when none of those are positive (lines 38–47).
- Hole ID prefers casing ID, then open-hole diameter, then 6.875 in. Open-hole ID is stored only when it differs from that hole ID. Casing MD 0 means a uniform hole (`types.ts` lines 11–14, `holeDiameterAt` in `physics.ts` lines 22–27).
- Pipe OD / ID and base MW come from `odDp`, `idDp`, `currentMw`.
- Survey stations are surface plus any of casing, spot, and anchor that have both MD and TVD (lines 18–36). Stations within 0.5 ft of MD collapse. This is not a pasted survey.
- Pipe is placed at spot MD, clamped to the well. Pill bottom is that same MD. Pill weight is `kmw`.
- Annular pill volume is `results.correctedPillVol`, else `results.requiredVolAnnulus`, else 19.7 bbl. String KMW is `results.finalKwm`. Chase in the string is `results.correctedChase` (lines 171–190).
- Equalized mode reruns that placement through `equalizeFloatAirCap` (`src/lib/calc/equalize.ts`) and dumps `eq.dumpBbl` onto the annular pill (lines 127–168).

Live controls (`SimControls`, `src/lib/pill/store.ts` lines 25–46): pipe depth, reference (placement) pipe depth, pipe end `closed` | `open`, Trip Tank On (`autoBackfill`), placed pill top / bottom / volume / MW, string KMW volume, string chase volume, draft top / bottom / volume / MW, `equalized`, `kmwBackfillRequired` from `results.bblBackfill`, and `dirty`.

Place-pill drafts (`sim-controls.tsx` lines 182–259): top and bottom in ft, volume in bbl (min 0.1, step 0.1), weight slider 10–22 ppg in 0.5 steps. `setDraftMw` clamps to 8–22 (`store.ts` line 283).

### How a move steps

One user action is one step. The distance is whatever the control asked for. There is no inner loop.

| Control | Where | Step |
|---|---|---|
| Range "Pipe depth" | `sim-controls.tsx` lines 113–122 | `min={0}`, `max={wellDepth}`, `step={50}` ft |
| Up 500 / Up 100 / Down 100 / Down 500 | lines 123–148 | `bumpPipe` of −500, −100, +100, +500 ft |
| ArrowUp / ArrowDown | `simulator-view.tsx` lines 48–65 | −100 / +100 ft. Shift is −500 / +500. Ignored while focus is in an input, textarea, or select |
| Depth clamp | `store.ts` lines 237–244 | `clamp(depth, 0, wellDepth)` |

`applyPipeMove` (`store.ts` lines 131–213) is the whole step:

1. Closed pipe that is not yet equalized: `balanceAtBit` at the current depth (air-cap equalize, extra string KMW added to the annular pill). Sets `equalized`.
2. Closed pipe: `floatDrainOnMove` (`physics.ts` lines 70–94). Pulling only. Drained bbl = min(string KMW, pulled ft × bore bbl/ft), then chase the same way with what pull remains. Running in drains nothing. Open pipe drains nothing.
3. Drained KMW is added to `pillVolume` and the top is recomputed with `topFromVolume`, bottom held.
4. Closed pipe: `balanceAtBit` again at the new depth.

Open-end pill motion is not in that function. `computeModel` → `pillPosition` (`physics.ts` lines 205–244) shifts the placed top and bottom by steel displacement, with a binary search (48 iterations) when the pill would cross the pipe end on the way out.

### State carried between steps

Zustand `SimControls`, not a step array. After each move the store keeps pipe depth, string KMW, string chase, annular pill volume, pill top, the draft copies of top and volume, `equalized`, and `dirty: true`. Pill bottom, pill MW, pipe end, reference depth, and Trip Tank On stay as they were unless another control changes them.

`dirty` blocks `syncFromCalc` from reseating the schematic when the same well name recalculates (`store.ts` lines 344–354). A different well name reseats. **From procedure** (`placeFromProcedure`, lines 317–328) clears `dirty` and reloads placement. The amber chip "Sim ≠ procedure" is `app-shell.tsx` lines 273–286.

### Output at each depth

`SimulatorView` calls `computeModel(state)` (`simulator-view.tsx` lines 21–41). `PillModel` is `src/lib/pill/types.ts` lines 41–65.

Shown on screen:

- Stats (`stats-strip.tsx` lines 51–78): annular pill bbl and top–bottom ft; KMW in the string bbl, with chase or air-cap detail; pipe movement ft versus the placement depth; anchor EMW ppg and pressure psi (TD when anchor MD is missing).
- Toolbar: pipe depth ft; phase sentence; displacement, annulus bbl/ft.
- Schematic (`wellbore-schematic.tsx`): pill, pipe, chase, air, fill, base fluid, casing, anchor. Hover sets `probeDepth` and reads pressure and EMW at that MD. Program top is `results.topOfPillNoDp`; program bottom is `inputs.spotMd`.
- EMW plot (`emw-profile.tsx`): static EMW versus MD. `sampleEmwProfile` (`hydrostatic.ts` lines 131–164) samples about `wellDepth / 240` ft, and at least every 2 ft, plus layer boundaries. That sample is the chart, not the pipe step. Caption at line 626: EMW = hydrostatic / (0.052 × TVD), vertical well, no circulating friction. Reference lines for base MW, pill MW, target EMW, and FIT. Shoe and anchor markers.
- Volume balance (`analysis-panels.tsx` lines 59–88): annular capacity, pipe displacement, and open hole in bbl/ft; annulus to the pipe depth; open hole below the pipe; placed annular pill; KMW backfill applied versus required; KMW left in the string; total KMW; trip-tank gain or fill; fill zone; pipe-bore contribution when the end is open; POOH 1,000 ft fill.
- Hydrostatic snapshot (lines 90–97): surface, pill top, pill bottom, pipe depth, and TD, each as psi and ppg, plus bottomhole EMW and the layer list (MD interval, name, ppg).
- Footer (`simulator-view.tsx` lines 158–172): procedure top, annular top, annulus bbl, string bbl, mixed total. A live region announces pipe depth, pill interval, and trip-tank gain or fill.
- Backfill banner (lines 81–95) when `results.bblBackfill > 0`.

Pressure formula used by those panels is `pressureAt` (`hydrostatic.ts` lines 79–107): when a base MW is passed, pressure is base MW × 0.052 × TVD plus the extra MW × 0.052 × MD height. `emwAt` (lines 118–129) divides that pressure by 0.052 × TVD. No ECD circulation, no SBP line, no pore line.

`phase` strings returned by `computeModel` are the sentences at `physics.ts` lines 296–322 (equalized air cap, chase on KMW, backfill while POOH, float holding, RIH float blocking influx, open-end crossing).

### Controls that are not there

No play button, no pause, no speed, no timeline scrub of a precomputed series. The range input is a pipe-depth slider. Reset is **From procedure**, plus the as-pumped / equalized switch, Float / Open, and Trip Tank On (`sim-controls.tsx` lines 73–110).

### Engine functions it calls

Simulator modules (`src/lib/pill/*`, `simulator-view.tsx`, `sim-controls.tsx`, `analysis-panels.tsx`, `emw-profile.tsx`, `stats-strip.tsx`, `wellbore-schematic.tsx`) do not import `engine-nodp.ts` or `tables.ts`. They do not read `safevisionNoSlug`, `safevisionSlug`, `tripPressures`, `TRIP_TABLES`, or `SURGE_*`. `steel.ts` is not on this path.

They do call:

| Call | File | What it uses |
|---|---|---|
| `calculate(EMPTY_INPUTS)` to seed the store | `src/lib/pill/store.ts` lines 64–65 | `calculate` is re-exported from `engine-run.ts` by `engine.ts` lines 279–286 |
| `results` passed in from the app, also produced by that `calculate` | `simulator-view.tsx`, `from-calc.ts` | Placement volumes listed above |
| `equalizeFloatAirCap` | `store.ts` line 12 and line 101; `from-calc.ts` line 3 and line 141 | `src/lib/calc/equalize.ts`. Air cap 14.7 psi. Not `engine-nodp.ts` |
| `computeModel`, `floatDrainOnMove`, `topFromVolume`, `volumeFromDepths`, `pillIntervalError`, `geometryError` | `store.ts`, `simulator-view.tsx` | `src/lib/pill/physics.ts` |
| `hydrostaticLayers`, `pressureAt`, `emwAt`, `tvdAt`, `sampleEmwProfile` | analysis, stats, schematic, `emw-profile.tsx` | `src/lib/pill/hydrostatic.ts` |

Indirect use, which a 2.0 port must not keep:

- `engine-run.ts` line 14 imports `calcNoDpPill`, `calcEqualizeExtraPpg`, and `calcSlugAt200FtMin` from `engine-nodp.ts`. `calculate` (line 16) sets `correctedPillVol`, `finalKwm`, `bblBackfill`, and `safevisionSlug` from those calls (`engine-run.ts` around lines 93–140). The simulator places the pill from `correctedPillVol`, `finalKwm`, `correctedChase`, and `bblBackfill`. It never reads `safevisionSlug`.
- The same `calculate` copies `tripPressures` from `engine.ts`, and `swabTable` (`engine.ts` lines 23–31) reads `TRIP_TABLES` in `src/lib/calc/tables.ts` (comment on line 1: "Swab tables from Inputs sheet (SafeVision-derived)"). The simulator never reads `tripPressures`. Surge tables in that file (`SURGE_6_75_WIDE` and the rest, from line 43) are not consulted by `calculate` or by the simulator.

---

## 3. Proposed 2.0 paste contract

Pure function. No store, no toast, no SafeVision number stored as an ECD. ECD at a depth comes from `emwProfile`.

Row and column indexes are 1-based, matching the sheet. Column 1 is the label, the next non-unit cell is the value, and a recognized unit cell between them is reported as its own column when the unit is wrong.

```ts
export interface PasteError {
  /** 1-based sheet row in the pasted block. */
  row: number;
  /** 1-based cell on that row. Column 1 is the label. */
  column: number;
  code:
    | "EMPTY"
    | "UNMAPPED_LABEL"
    | "BAD_NUMBER"
    | "BAD_DATE"
    | "BAD_SECTION"
    | "BAD_BOOL"
    | "UNIT_MISMATCH"
    | "NOT_A_2_0_INPUT"
    | "CONFLICTING_DUPLICATE";
  /** 2.0 field path when the label mapped, otherwise the raw label. */
  field: string;
  message: string;
}

export interface PasteIgnored {
  row: number;
  column: number;
  field: string;
  code: "CALCULATED" | "DUPLICATE";
  message: string;
}

export interface PasteMatch {
  /** 2.0 field path. */
  field: string;
  /** 1-based sheet row. */
  row: number;
  /** 1-based column of the value cell. */
  column: number;
  /** Recognized unit cell on that row, or null when the row has none. */
  unit: string | null;
}

/** Patch is a partial Job. Absent fields are left for the caller to keep. */
export interface PasteResult {
  ok: boolean;
  patch: Partial<Job>;
  /** Patched fields, in sheet order. `field` is the 2.0 path. */
  matched: PasteMatch[];
  ignored: PasteIgnored[];
  errors: PasteError[];
}

export function parseWellPaste(text: string): PasteResult;

export type PastePreviewKind = "number" | "text" | "bool" | "date";

export interface PastePreviewRow {
  /** 2.0 field path. */
  field: string;
  /**
   * Unit shown with both values. The recognized sheet unit when the row has one,
   * otherwise the unit that field already uses. Null for text, bool, and date.
   * The unit is not written into `oldDisplay` or `newDisplay`.
   */
  unit: string | null;
  /**
   * How the engine formatted the display strings.
   * `number` uses the field precision. `bool` is Yes/No. `date` is ISO YYYY-MM-DD.
   * `text` is the value as stored.
   */
  kind: PastePreviewKind;
  /** Value on `job` at `field`, in `unit`. Null when the job has no value there. */
  oldValue: unknown;
  /** Coerced value from `result.patch`, in the same `unit`. */
  newValue: unknown;
  /** Engine-formatted `oldValue`. The UI prints this and does not format `oldValue`. */
  oldDisplay: string;
  /** Engine-formatted `newValue`. The UI prints this and does not format `newValue`. */
  newDisplay: string;
  /** 1-based sheet row, copied from `matched`. */
  row: number;
  /** 1-based value column, copied from `matched.column`. */
  col: number;
}

export interface PastePreviewError {
  code: PasteError["code"];
  row: number;
  /** `PasteError.column`. */
  col: number;
  message: string;
  /**
   * True when this code blocks apply.
   * Blocking codes: `BAD_NUMBER`, `CONFLICTING_DUPLICATE`, `EMPTY`, `BAD_DATE`,
   * `BAD_SECTION`, `BAD_BOOL`, `UNIT_MISMATCH`.
   * `UNMAPPED_LABEL` and `NOT_A_2_0_INPUT` are false.
   */
  blocking: boolean;
}

export interface PastePreview {
  rows: PastePreviewRow[];
  errors: PastePreviewError[];
  /** False when any `errors` entry has `blocking: true`. */
  canApply: boolean;
}

export function previewPaste(job: Job, result: PasteResult): PastePreview;

export function applyPaste(job: Job, preview: PastePreview): Job;
```

`parseWellPaste` takes the pasted text and nothing else. It has no `Job` argument, does not read the store, and does not look up the current value of a field. It does not write localStorage, does not build a simulator job, and does not fill `calcJob`.

`ok` is true when `matched` is non-empty and `errors` is empty. `EMPTY` is the single error when the text has no usable row (`row: 0`, `column: 0`). A calculated label (the 1.0 `SKIP_LABELS` set) is `ignored` with `CALCULATED`, which is how MASP stays out of the job. A number, date, section, or bool that fails to parse is an `errors` entry and that field is not patched. `pillMode` on 1.0 is `Job.mode` on 2.0 and is not in the patch.

A repeated label whose coerced value equals the value already patched is `ignored` with `DUPLICATE`. That is a warning. The first value stays, and `ok` can still be true. A repeated label whose coerced value differs is `CONFLICTING_DUPLICATE` on `errors`. That blocks the patch: `ok` is false, `patch` is `{}`, and `previewPaste` reports the conflict with `blocking: true`. Coerced equality is numeric after the thousands-separator rule, trimmed text, the normalized date, or the coerced bool. `1500` and `1,500` are the same value. `1,5` never becomes a number, so it cannot be a duplicate of anything.

`previewPaste` is pure. One row per `matched` entry, in that order. `newValue` is the patched value. `oldValue` is read from `job` at `field`. Both stay raw. `kind` is `number`, `text`, `bool`, or `date`, taken from the new value when it is present and otherwise from the old value. `oldDisplay` and `newDisplay` are the strings the engine formats for that kind. The UI prints those strings and the separate `unit`. It does not format `oldValue` or `newValue`, and it does not put the unit inside the display string.

Number precision is per field: ppg and ppge use 0.1 (`12.25` displays `12.3`), inches use 0.001, feet (including md and tvd) use 1, psi uses 1, bbl and bbl/stk use 0.01, and gpm uses 1. The formatted number is `toFixed` at that step. It has no thousands separator. A bool displays `Yes` or `No`. A date displays ISO `YYYY-MM-DD`. Text is the stored string. A nested value (a casing interval, a survey station, or `stringSections`) is text and displays as JSON. Null displays as an empty string.

`errors` copies every `PasteError`, with `column` renamed to `col`. `blocking` is true for `BAD_NUMBER`, `CONFLICTING_DUPLICATE`, and the other blocking codes listed on `PastePreviewError`. It is false for `UNMAPPED_LABEL` and `NOT_A_2_0_INPUT`. `canApply` is false when any error is blocking. Ignored `DUPLICATE` and `CALCULATED` rows are not preview rows and are not preview errors.

`applyPaste` returns a new `Job`. It writes exactly `preview.rows` and nothing else: each `newValue` is set at `field`, and every field that is not in `rows` stays as it was, including `mode`. It then sets `meta` to `{ modified: true, isExample: false }`. `meta` is optional on `Job` and is absent on a preset. `inputHash` excludes `meta` the same way it excludes `savedAt`, so the flags do not move a preset baseline. `applyPaste` does not write `presetBaseline`, does not call the store, and does not change `baselineHash`. If the cloned job still carries a `presetBaseline` from a saved record, that property is dropped on the returned job only. The job passed in is not mutated. It does not write localStorage and does not fill `calcJob`. It throws when `canApply` is false and returns no job, and the thrown call does not set `meta`. After a successful apply, `simulate` is called with that returned job.

### Planned paste apply test

Planned, not implemented in this spec. Build a `Job`, parse a sheet whose `previewPaste` result has `canApply: true`, and call `applyPaste(job, preview)`. The returned job deep-equals a copy of `job` on which each preview row's `newValue` has been set at `field`, plus `meta: { modified: true, isExample: false }`. No other field differs. `inputHash` of the returned job equals `inputHash` of that same job with `meta` removed. A job that also carries `presetBaseline` keeps that property on the input, and the returned job does not have it. A second call whose preview has `canApply: false` throws, and the job passed in is unchanged, including `meta`. A display check: current MW `12.25` ppg has `kind: "number"`, `newValue` `12.25`, and `newDisplay` `"12.3"`. A depth of `10000` ft displays `"10000"`. A well name displays as the text itself.

Same delimiters as 1.0: tab and newline, HTML table when `<table` or `<tr` is present. A comma never separates cells. The decimal mark is `.`. Dates stay month-day-year and Excel serial, written to a well-date string on the side, not to `job.savedAt`. Units are checked, not converted. A unit outside the set expected for that field is `UNIT_MISMATCH` and the value is not stored.

A comma inside a number is a thousands separator only when exactly three digits follow it and the character after those three digits is the end of the cell, a decimal point, or another comma. Each such group is removed and the number is then parsed. `1,500` is 1500. `1,234.5` is 1234.5. `1,234,567` is 1234567. Any other comma is `BAD_NUMBER`. The comma is not stripped and the cell is not given a fallback value. `1,5` is `BAD_NUMBER`, not 15 and not 1.5. `1,50` and `1,2345` are `BAD_NUMBER`.

Mapping onto the 2.0 `Job` at `feat/tapered-strings`:

| 1.0 field | 2.0 |
|---|---|
| `wellName` | `name` |
| `currentDepthMd` | `well.bitMd_ft`. Also `well.mdTd_ft` when `tdDepth` was not pasted |
| `tdDepth` | `well.mdTd_ft` |
| `anchorMd` / `anchorTvd` | `well.anchorMd_ft` / `well.anchorTvd_ft` |
| `casingMd` / `casingTvd` | `well.shoeMd_ft` / `well.shoeTvd_ft`, and one `well.casing` interval ending at the shoe |
| `idCasing` | that interval's `id_in` |
| `openHoleDia` | `well.openHoleId_in` |
| `spotMd` | bottom MD of the pill segment in `column`. Simulator start pipe MD. Not a separate well field |
| `spotTvd` | one `well.survey` station `{ md_ft: spotMd, tvd_ft: spotTvd }` |
| casing and anchor MD/TVD pairs | two more `well.survey` stations. 1.0 built the same three stations in `surveyFromWell` and never pasted a survey grid |
| `odDp` / `idDp` | `well.stringOd_in` / `well.stringId_in` |
| DP1 length + OD + ID and DP2 OD + ID | `well.stringSections`: `[{ length_ft, od_in, id_in }, { length_ft, od_in, id_in }]`. DP2 length is bit MD minus DP1 length when both OD and ID are present. A single OD/ID with no DP1/DP2 leaves `stringSections` unset so the legacy one-section path stays |
| larger casing, liner hanger, liner shoe, liner ID | `well.casing` intervals. Not string sections |
| `currentMw` / `kmw` | two `fluids` entries, and the `column` / `pipeColumn` segment fluid ids that already point at them |
| `pumpDisp` | `pump.bblPerStk` |
| `sbpConnection` | `trip.sbpConn_psi` |
| `fit` | `well.fit_ppg` |
| `initialFlowRate` | `trip.flow_gpm` |
| `client`, `producedBy`, `date`, `sectionType`, `maxFlowRate`, `desiredResolution`, `overbalanceSlug`, `topSlugBbl`, cement fields | `NOT_A_2_0_INPUT`. They are not stored. `desiredResolution` is the 1.0 schedule bbl step; 2.0 stage bbl comes from `strokesSchedule` |
| `safevisionNoSlug` | `NOT_A_2_0_INPUT`. Message: ECD is computed by `emwProfile`, not pasted from a SafeVision cell |

`taperedOn` alone does not invent sections. Sections appear only when DP1 and DP2 diameters were pasted.

---

## 4. Single input state

### 2.0 rule

There is one input record: the app `Job`. Paste and the simulator both read it and, when the user edits, both write it.

- `parseWellPaste(text)` returns `PasteResult` and does not take a job. `previewPaste(job, result)` is the diff. `applyPaste(job, preview)` writes that diff onto the job when `canApply` is true. The app does not keep a pasted copy beside the job.
- `simulate(job, opts)` takes that same `Job`. `opts` is the pipe-MD range for this call (start, end, step). It is not a second well.
- A step may call `emwProfile`, `chaseVolume`, `kmwInString`, and `columnDisplacedByPipe` with `bitMd_ft` set to that step's pipe MD. That argument is dropped when the call returns. It is not saved, and it is not a simulator-owned job.
- The `kpi` and `pump` fields on `SimulateResult` are outputs of this job. They are not inputs and they are not stored on the simulator.
- This feature does not add a `SimControls` store, a draft pill, a `dirty` flag, or a `calcJob`-style snapshot of its own. Screens that already snapshot `calcJob` for Calculate are outside this contract. Paste and `simulate` do not read or write that snapshot.

### How 1.0.x duplicated Simulator and Procedure

Procedure and the rest of the calculator share `useAppStore.inputs` (`src/lib/store.ts` lines 18–22), a `WellInputs` persisted as `pillview.v1`. `calculate(inputs)` is called at render and passed down as `results`. The procedure document, the schedule, and print all use that pair.

The simulator does not. `useSimulator` (`src/lib/pill/store.ts` lines 25–46 and 215–235) keeps its own pipe depth, reference pipe depth, pill top, pill bottom, pill volume, pill weight, string KMW, string chase, backfill required, equalized bit, and a draft top / bottom / volume / weight used by the place-pill form. `placeFromProcedure` and `syncFromCalc` (lines 317–365) copy `pillFromProcedure(inputs, results)` into that store. `wellFromStores` (lines 372–385) then builds a third object, `WellState`: geometry is read from `inputs`, and the pill and pipe numbers come from the simulator store.

Those copies diverge on purpose. `applyPipeMove` sets `dirty: true` (line 211). While `dirty` is set and the well name is unchanged, `syncFromCalc` updates `lastSyncKey` and leaves the simulator copy in place (lines 344–353). `wellFromStores` then takes pill weight from `sim.pillMw` instead of `inputs.kmw` (line 380). The procedure and the print path never see that copy. The chip in `src/components/app-shell.tsx` lines 273–278 says the schematic is off the field sheet and that print still uses the procedure. **From procedure** calls `placeFromProcedure` and clears `dirty` (lines 317–327).

Saved scenarios are a further copy: `scenarios[].inputs` (`src/lib/store.ts` lines 13–17 and 55–71), up to 24 wells, separate from the live inputs.

### Flags on that split

There is no field named `changed` anywhere in the 1.0.7.1 tree.

The flag that means "the simulator has moved off the procedure" is `dirty` (`src/lib/pill/store.ts` line 42). The chip, `syncFromCalc`, and `wellFromStores` all read it.

Two flags next to that split are unused:

- `geometryErr` (`store.ts` line 41) is set when `placePill` fails geometry (`lines 292–294`) and cleared on success (line 311). No screen reads it.
- `StatsStrip` declares `equalized` (`src/components/stats-strip.tsx` lines 8 and 32). `SimulatorView` passes `sim.equalized` (line 97). The component never reads the prop. The as-pumped / equalized switch itself is used; only this argument is dead.

`hydrated` on the app store (`src/lib/store.ts` lines 24, 45, and 107) is set after rehydrate and never read. It is not the simulator/procedure split.

## 5. Proposed 2.0 simulator contract

Pure function of the canonical `Job`. The UI holds an index into `steps` for scrub, play, and pause. Speed is how fast the index advances. It is not an input to the physics. There is no `engine-nodp` call and no SafeVision table.

1.0 stepped the pipe by 50 ft on the slider, 100 ft on the arrow keys, and 500 ft on the coarse buttons, each click as one shot (`floatDrainOnMove` uses the whole delta). 2.0 keeps pipe MD as the axis. Default `stepMd_ft` is 100. The minimum is 10. A step below 10, or a non-finite step, is `INVALID_STEP` on `stepMd_ft`. The value is not raised to 10. Pass 50 or 500 to match the other 1.0 controls; both are at least 10. The sequence includes `fromMd_ft` and `toMd_ft`. When the span is not a multiple of the step, the last interval is the remainder, so the end depth is exact.

The walk is capped at 1000 steps, inclusive. A generated walk or an explicit `mds` list longer than 1000 returns `STEP_LIMIT` on `stepMd_ft` and no `steps`. The step is not coarsened to fit. `meta.stepsLength` equals `steps.length`. `meta.stepFt` is the resolved step, which stays 100 when `mds` is set and `stepMd_ft` is omitted. A step below 10 is still `INVALID_STEP` when `mds` is set. `stepMd_ft` on the result equals `meta.stepFt`.

The default range is unchanged: omit `opts` and the walk still starts at `well.bitMd_ft` and ends at 0 ft, step 100 ft. On a 10480 ft bit that is 10480, 10380, …, 80, then 0. The main run is RIH from 0 to the bit, same step: `fromMd_ft: 0`, `toMd_ft: well.bitMd_ft`. On that 10480 ft bit the steps are 0, 100, …, 10400, then 10480.

Each step is recomputed from the original job at that bit depth. 1.0 carried `pipeKmwVolume`, `pipeChaseVolume`, `pillVolume`, and `equalized` from the previous click. 2.0 does not port that inventory. `columnDisplacedByPipe` already returns the annular column for a bit depth, and on a tapered string it removes `stringVolumeBbl(well, 0, bit, "closed")` (`column.ts` on this branch).

```ts
export interface SimulateOptions {
  /** Start pipe MD, ft. Default `job.well.bitMd_ft`. Still the trip-tank origin when `mds` is set. */
  fromMd_ft?: number;
  /** End pipe MD, ft. Default 0. Ignored for the step list when `mds` is set. */
  toMd_ft?: number;
  /** Pipe-MD step, ft. Default 100. Minimum 10, including when `mds` is set. */
  stepMd_ft?: number;
  /**
   * Explicit pipe MDs, ft, in this order. When set, `steps` are these depths and nothing else.
   * A single-point evaluation is a one-element list. `fromMd_ft` still anchors `tripTank_bbl` and `pipeDelta_ft`.
   * Longer than 1000 is `STEP_LIMIT`.
   */
  mds?: number[];
}

export interface SimulateDepth {
  md_ft: number | null;
  tvd_ft: number | null;
}

/** One labeled station, with EMW for a single pill state. */
export interface SimulateEmwStation {
  label: EmwStationLabel;
  md_ft: number;
  tvd_ft: number;
  emw: EmwStationEmw;
}

/** One pill state's lines, stations, and shoe check, plus the string at that pipe MD. */
export interface SimulateFluidProfile {
  label: string;
  lines: EmwLines;
  stations: SimulateEmwStation[];
  shoeCheck: EmwShoeCheck[];
  sections: EmwStringSection[];
  crossovers: EmwCrossover[];
}

export type SimulateFluidResult =
  | ({ ok: true; notes: EmwNote[] } & SimulateFluidProfile)
  | { ok: false; notes: EmwNote[]; error: EmwError };

export interface SimulateStep {
  index: number;
  pipeMd_ft: number;
  pipeTvd_ft: number | null;
  /** `pipeMd_ft - fromMd_ft`. Negative while pulling. */
  pipeDelta_ft: number;
  /** Pill top at this pipe MD. Both depths come from `pillPlacement` and `tvdAt`. */
  pillTop: SimulateDepth;
  /** Pill bottom at this pipe MD. */
  pillBottom: SimulateDepth;
  /** `chaseVolume` at this pipe MD. */
  chase_bbl: number | null;
  /** Surface-to-bit string capacity at this pipe MD. Not the pill-interval term. */
  stringCapacity_bbl: number | null;
  kmwInString_bbl: number | null;
  /**
   * Closed-pipe displacement, bbl, cumulative from `fromMd_ft` to `pipeMd_ft`.
   * Positive when this MD is deeper than `fromMd_ft`, negative when it is shallower, 0 at `fromMd_ft`.
   * Each section contributes OD² / 1029.4 × the feet of that section inside the interval.
   */
  tripTank_bbl: number;
  /**
   * Spotted EMW at this pipe MD. `spottedColumn` uses `columnDisplacedByPipe(job, pipeMd)`.
   * Stations carry only the spotted EMW. `shoeCheck` is the spotted rows.
   * `sections` and `crossovers` are the string at this pipe MD.
   * At pipe MD 0 this is the pipe-out copy of the in-place profile.
   */
  spotted: SimulateFluidResult;
}

export interface SimulateMeta {
  /** Equal to `steps.length`. */
  stepsLength: number;
  /** Resolved step, ft. Default 100. Minimum 10. */
  stepFt: number;
}

export interface SimulateError {
  code: "INVALID_STEP" | "INVALID_DEPTH" | "MISSING_BIT" | "STEP_LIMIT";
  field: "stepMd_ft" | "fromMd_ft" | "toMd_ft" | "well.bitMd_ft";
  message: string;
}

export type SimulateResult =
  | {
      ok: true;
      stepMd_ft: number;
      fromMd_ft: number;
      toMd_ft: number;
      /** `stepsLength` equals `steps.length`. `stepFt` equals `stepMd_ft`. */
      meta: SimulateMeta;
      /**
       * In-place EMW of the job passed in, computed once.
       * Not recomputed per step. Stations and shoe check are the in-place side only.
       */
      inPlace: SimulateFluidResult;
      /** `kpiVolumes(job)` for the job passed in. Output only. */
      kpi: KpiVolumesResult;
      /** One row per displacement stage. Not the pipe-step axis. */
      pump: StrokesScheduleResult;
      steps: SimulateStep[];
    }
  | { ok: false; error: SimulateError };

export function simulate(job: Job, opts?: SimulateOptions): SimulateResult;
```

Work per call:

1. Reject a non-finite `stepMd_ft`, or a step below 10 ft, with `INVALID_STEP`, including when `mds` is set. Do not raise it to 10. Reject a from/to MD outside `0…well.mdTd_ft`, or any explicit MD that is non-finite or outside that span, with `INVALID_DEPTH`. Do not clip the way 1.0 `clamp` did and then continue silently. Count the steps before building them. More than 1000 is `STEP_LIMIT` and the call returns no `steps`. Do not coarsen the step. When `mds` is set and the list is within the cap, `steps.length` equals `mds.length` and `steps[i].pipeMd_ft` equals `mds[i]`. `meta.stepsLength` equals that length and `meta.stepFt` is the resolved step.
2. `kpi = kpiVolumes(job)` once, on the job passed in. That supplies MASP, KMW, chase at the procedure bit, `pillVolume_bbl` (`stringCapOverPillInterval_bbl + chase_bbl`), the breakdown, backfill, and POOH fill. Stand length still belongs to `poohFill` inside that result. A `STAND_LENGTH` error stays on `poohFill` and does not drop the steps.
3. `pump = strokesSchedule(job, calculate(job))` once, on that same job. Stage bbl, strokes, and minutes are that function's rows. SPM blank leaves minutes null. This replaces the 1.0 `desiredResolution` ladder. The pipe steps do not walk these rows.
4. For each pipe MD, call the existing functions with `bitMd_ft` set to that MD and discard the argument afterward.
   - `placed = columnDisplacedByPipe` at that MD.
   - Pill top and bottom from `pillPlacement(placed)`, each as `{ md_ft, tvd_ft }` with TVD from `tvdAt`.
   - `chaseVolume` and `kmwInString` for the bbl fields. Tapered capacity stays inside those functions.
   - `tripTank_bbl` is the signed closed-pipe displacement from `fromMd_ft` to this MD. Closed-pipe displacement is each section's own OD: OD² / 1029.4 bbl/ft, the same quantity as `stringVolumeBbl(well, lo, hi, "closed")`. The first step is 0. A later step equals the previous step plus the signed increment between those two MDs.
   - An increment that contains a string crossover is split at that crossover. The rate above the boundary is the upper section's OD. The rate below it is the lower section's OD. The two pieces are summed. They are not replaced by one rate times the whole increment. On EXAMPLE D the boundary is 8480 ft MD (5.5 in OD above, 4.0 in OD below). A step from 8400 to 8600 ft is `(5.5² / 1029.4) × 80 + (4² / 1029.4) × 120` bbl, and the reverse step is the negative of that.
   - `spotted` is the spotted side of `emwProfile` at that MD: label, lines, stations (spotted EMW only), shoe check filtered to `spotted`, and `sections` and `crossovers` for the string at that pipe MD. The UI plots `spotted.lines`. It does not sample a second hydrostatic. `inPlace` is computed once, on the job passed in, and is not recomputed per step.

Play, pause, and scrub are the index into `steps`. They are not arguments of `simulate`. A playback speed of one step per tick moves `stepMd_ft` per tick. Choosing 50, 100, or 500 is the 1.0 slider, arrow key, and coarse button.

`simulate` does not import `src/lib/calc/engine-nodp.ts`, `src/lib/calc/tables.ts`, or `src/lib/pill/physics.ts`.

### Invariant test

Planned, not implemented in this spec. On EXAMPLE B, EXAMPLE C, and EXAMPLE D, with default options, `steps[0]` is the pipe at `well.bitMd_ft` and must match `kpiVolumes(job)` and `emwProfile(job)` for that same job. D is checked against D. B is not compared to C or D.

```ts
const sim = simulate(job);
const kpi = kpiVolumes(job);
const emw = emwProfile(job);
const step = sim.steps[0];
```

All three results are `ok: true`. `step.pipeMd_ft` equals `job.well.bitMd_ft` exactly. `step.index` is 0.

| `steps[0]` | Same-job output | Tolerance |
|---|---|---|
| `chase_bbl` | `kpi.chase.chase_bbl` | 1e-6 bbl |
| `stringCapacity_bbl` | `kpi.chase.stringCapacity_bbl` | 1e-6 bbl |
| `kmwInString_bbl` | `kpi.kmwInString.bbl` | 1e-6 bbl |
| `spotted.stations[].emw.{static,staticSbp,ecd}` | `emw.stations[].emw.spotted` | 1e-6 ppg |
| `inPlace.stations[].emw.{static,staticSbp,ecd}` | `emw.stations[].emw.inPlace` | 1e-6 ppg |
| `spotted.shoeCheck` and `inPlace.shoeCheck`, `emw_ppg` and `margin_ppg` | the shoe rows of that pill state | 1e-6 ppg |
| those shoe rows, `margin_psi` | the same rows | 1e-4 psi |
| `spotted.lines` and `inPlace.lines` at shoe MD and bit MD, `emw_ppg` | the same points on that pill state | 1e-6 ppg |
| `spotted.sections`, `spotted.crossovers`, and the same fields on `inPlace` | `emw.sections` and `emw.crossovers` | exact (`md_ft`, `tvd_ft`, `id_in`, `od_in`, labels) |
| `spotted.label` and `inPlace.label` | the same labels on `emw` | exact string |
| `pillTop.md_ft`, `pillBottom.md_ft` | `pillPlacement` of the spotted column `emwProfile` builds with `columnDisplacedByPipe(job, job.well.bitMd_ft)` | 1e-4 ft |
| `pillTop.tvd_ft`, `pillBottom.tvd_ft` | `tvdAt` of those measured depths | 1e-4 ft |

`pillTop` is that spotted column. It is not required to equal `kpi.kmwInString.pillTopMd_ft`, which is the pill on the stored column. `inPlace` is the reference profile for the job passed in. `steps[0].spotted` is the spotted side at the procedure bit.

`simulate(job).kpi` matches `kpiVolumes(job)` on `pillVolume_bbl`, `pillVolumeBreakdown.stringCapOverPillInterval_bbl`, and `pillVolumeBreakdown.chase_bbl` to 1e-6 bbl. That `kpi` value is an output of the same job. `pillVolumeBreakdown.chase_bbl` also matches `steps[0].chase_bbl` to 1e-6 bbl. `steps[0].tripTank_bbl` is 0, because that step is `fromMd_ft`.

### Pipe-out invariant

Planned, not implemented in this spec. On EXAMPLE B, C, and D, take the step whose `pipeMd_ft` is 0 (the last step of the default walk, and the first step of the RIH run). On that step `spotted` equals the result's `inPlace` to 1e-6 ppg:

- `spotted.lines.{static,staticSbp,ecd}` and `inPlace.lines` at each shared MD, `emw_ppg`
- `spotted.stations[].emw.{static,staticSbp,ecd}` and `inPlace.stations[].emw`
- shoe rows with the same `line`, `emw_ppg` and `margin_ppg`. `pillState` stays `spotted` on the step and `inPlace` on the reference, so it is not part of the equality

Pipe MD 0 removes no closed-pipe volume, so `columnDisplacedByPipe` leaves the pipe-out column. `emwProfile` rejects a non-positive bit, so the step copies the original job's in-place lines, station EMW, and shoe numbers onto `spotted` and keeps the contract labels. `inPlace` is that same original profile, computed once. This comparison is ppg only.

### Direction test

Planned, not implemented in this spec. On EXAMPLE B, C, and D both directions are compared on one shared grid. A RIH walk at 100 ft and a POOH walk at 100 ft meet only at 0 and the bit, so this test does not intersect those two walks.

`step` is 80 ft. That divides 8480 and the 10480 ft bit. The RIH grid is `0, step, 2 * step, …` for every term at or above 0 and at or below `bitMd_ft`. `mdGrid` is the union of that grid and `bitMd_ft`. On these wells that is 0, 80, …, 10480 (132 depths).

Guard, before the comparisons: `mdGrid.length` is at least 10, and on D the grid includes the crossover at 8480 ft MD.

Every grid MD is evaluated on its own, once in each direction, with an explicit one-point `mds` list:

- RIH: `simulate(job, { mds: [md], fromMd_ft: 0 })`
- POOH: `simulate(job, { mds: [md], fromMd_ft: job.well.bitMd_ft })`

Each result has one step, and that step's `pipeMd_ft` is `md`. These fields match at every grid MD, to the tolerances in the table above: `chase_bbl`, `stringCapacity_bbl`, `kmwInString_bbl`, `pillTop.md_ft`, `pillTop.tvd_ft`, `pillBottom.md_ft`, `pillBottom.tvd_ft`, and `spotted` lines, stations, shoe check, sections, and crossovers. `inPlace` is the same reference on both calls because it does not depend on pipe MD. `tripTank_bbl` and `pipeDelta_ft` are cumulative from `fromMd_ft`, so they differ between the two calls and are not part of this equality. The single-point call at the bit with `fromMd_ft: 0`, and the single-point call at 0 with `fromMd_ft` at the bit, each have `|tripTank_bbl|` equal to the closed-pipe displacement from 0 to the bit, to 1e-6 bbl.

On D, also run 8400 ft to 8600 ft and the reverse, `stepMd_ft: 200`. Both land on 8400 and 8600. The per-MD fields match at those two depths. The trip-tank increment between them equals `(5.5² / 1029.4) × 80 + (4² / 1029.4) × 120` bbl to 1e-6 bbl, positive on the way in and negative on the way out.

This match is path-independent only for closed pipe with no fluid exchange. The step column is `columnDisplacedByPipe` at that MD, which removes closed-pipe volume for the pipe that is in the hole and does not depend on the previous step. Open-end pipe, or a float that drains KMW as the pipe moves, would require revisiting this test.
