import { annularBblFt, capBblFt, ceilingMath } from "@/lib/utils";
import { demandSupported, taperedCalcRefusal, type TaperedStringRefusal } from "./job-support";
import { pillPlacement, surfaceFluid } from "./column";
import { pipePillBbl } from "./equalize";
import { holeIdAt, intervalVolume, uniqueSorted } from "./geometry";
import type { Job, Well } from "./job.schema";
import { PSI_PER_PPG_FT } from "./result";

/**
 * KPI pressures and volumes.
 * Pressures use TVD. Volumes use MD. Capacities are diameter² / 1029.4 bbl/ft.
 * POOH stand length is `job.trip.standLength_ft`. Blank or ≤ 0 is STAND_LENGTH. It is not defaulted.
 */

export interface KpiError {
  code:
    | "MISSING_FIT"
    | "MISSING_SHOE_TVD"
    | "MISSING_ANCHOR_TVD"
    | "MISSING_ACTIVE_MW"
    | "INVALID_SBP"
    | "STAND_LENGTH"
    | "INVALID_SURFACE_LINE"
    | "MISSING_PILL"
    | "INVALID_GEOMETRY";
  field: string;
  message: string;
}

export interface MaspValue {
  fitEmw_ppg: number;
  activeMw_ppg: number;
  /** Surface-fluid id used as active mud weight. */
  activeMwFluidId: string;
  shoeTvd_ft: number;
  /** FIT EMW − active MW, ppg. */
  deltaEmw_ppg: number;
  /** 0.052 × shoe TVD, psi/ppg. */
  psiPerPpg: number;
  /** (FIT EMW − active MW) × 0.052 × shoe TVD. */
  masp_psi: number;
  /** Entered planned SBP, psi. Echoed, not derived. */
  plannedSbp_psi: number;
  /** MASP − planned SBP, psi. */
  margin_psi: number;
  /** `OK, SBP <value> < MASP` when planned SBP is below MASP. */
  sbpFlag: string;
  /** True when planned SBP is greater than MASP. */
  sbpExceedsMasp: boolean;
}

export interface KmwValue {
  activeMw_ppg: number;
  sbp_psi: number;
  anchorTvd_ft: number;
  /** 0.052 × anchor TVD, psi/ppg. */
  psiPerPpg: number;
  /** SBP / (0.052 × anchor TVD), ppg. */
  sbp_ppg: number;
  /** active MW + sbp_ppg, before rounding. */
  raw_ppg: number;
  /** `raw_ppg` rounded up to the next 0.1 ppg. An exact tenth stays put. */
  rounded_ppg: number;
}

export interface AnnularSection {
  topMd_ft: number;
  bottomMd_ft: number;
  length_ft: number;
  /** From `holeIdAt` at the section midpoint. */
  holeId_in: number;
  stringOd_in: number;
  /** (holeId² − stringOd²) / 1029.4. */
  annularCap_bblFt: number;
  /** `intervalVolume` of this MD slice. */
  volume_bbl: number;
}

export interface ChaseValue {
  stringId_in: number;
  /** stringId² / 1029.4. */
  stringCap_bblFt: number;
  bitMd_ft: number;
  /** Surface to bit, ft MD. */
  stringLength_ft: number;
  /** String capacity from surface to the bit, bbl. */
  stringCapacity_bbl: number;
  pillBottomTargetMd_ft: number;
  /** Absolute MD span from the bit to the pill-bottom target. */
  annularLength_ft: number;
  /** Annular volume over that span. 0 when the target is the bit. */
  annularVolume_bbl: number;
  annularSections: AnnularSection[];
  pillFluidId: string | null;
  /** Pill already inside the string, bbl. Subtracted. */
  pillInString_bbl: number;
  /**
   * string capacity surface→bit + annular volume bit→pill-bottom target
   * − pill volume already in the string.
   * Surface-line volume is not included.
   */
  chase_bbl: number;
  /** Reported on its own. Default 0. Not added into `chase_bbl`. */
  surfaceLine_bbl: number;
}

export interface KmwInStringValue {
  pillTopMd_ft: number;
  /** Pipe pill top when the string holds the pill; otherwise the annulus pill top. */
  pillTopSource: "pipe" | "annulus";
  stringId_in: number;
  stringCap_bblFt: number;
  /**
   * When the pill is only in the annulus, this is the whole string, surface to bit.
   * When the pill is inside the string, this is that pipe-pill column only.
   */
  height_ft: number;
  /** `stringCap_bblFt × height_ft`. Not combined with the annular pill volume. */
  bbl: number;
  bitMd_ft: number;
  /**
   * String capacity over the annulus pill's MD interval.
   * Kept separate from `bbl` and from the annular pill volume.
   */
  belowPillTop_ft: number;
  belowPillTop_bbl: number;
}

export interface KmwBackfillValue {
  pillTopMd_ft: number;
  /** Pill top to surface, ft MD. */
  length_ft: number;
  stringOd_in: number;
  /** Annular volume from the pill top to surface. From `intervalVolume`. */
  volume_bbl: number;
  sections: AnnularSection[];
}

export interface PoohFillStand {
  /** 1-based. The last stand is shorter when the bit is not on a stand multiple. */
  n: number;
  length_ft: number;
  bbl: number;
  runningTotal_bbl: number;
}

/** One pipe-end POOH table. Closed and open are both returned from a single call. */
export interface PoohFillEnd {
  displacement_bblFt: number;
  /** One full stand. The last row may be the partial. */
  perStand_bbl: number;
  stands: PoohFillStand[];
  total_bbl: number;
}

export interface PoohFillValue {
  stringOd_in: number;
  stringId_in: number;
  standLength_ft: number;
  /** Surface to bit, ft MD. */
  tripLength_ft: number;
  fullStandCount: number;
  /** Leftover footage after the full stands. 0 when the bit lands on a stand. */
  partialStand_ft: number;
  /** Closed pipe: OD² / 1029.4. No swab allowance. */
  closed: PoohFillEnd;
  /** Open pipe: (OD² − ID²) / 1029.4. No swab allowance. */
  open: PoohFillEnd;
}

export type MaspResult = ({ ok: true } & MaspValue) | { ok: false; error: KpiError };
export type KmwResult = ({ ok: true } & KmwValue) | { ok: false; error: KpiError };
export type ChaseResult = ({ ok: true } & ChaseValue) | { ok: false; error: KpiError };
export type KmwInStringResult = ({ ok: true } & KmwInStringValue) | { ok: false; error: KpiError };
export type KmwBackfillResult = ({ ok: true } & KmwBackfillValue) | { ok: false; error: KpiError };
export type PoohFillResult = ({ ok: true } & PoohFillValue) | { ok: false; error: KpiError };

export interface KpiVolumesInput {
  /** Default 0. Reported separately from chase. */
  surfaceLine_bbl?: number | null;
  /**
   * MD of the pill bottom after the spot. Omitted → the annulus pill bottom.
   * EXAMPLE B's pill bottom is the bit, so the annular chase leg is 0.
   */
  pillBottomTargetMd_ft?: number | null;
  /**
   * Planned SBP, psi. Omitted → `trip.sbpConn_psi` as entered.
   * Not derived from target EMW, and not defaulted when that field is blank.
   */
  plannedSbp_psi?: number | null;
}

/**
 * Pill volume parts. The string term is capacity over the pill length only,
 * not the surface-to-bit string capacity.
 */
export interface PillVolumeBreakdown {
  /** String-ID capacity × pill length. Same value as `stringCapOverPillInterval_bbl`. */
  stringCapOverPillInterval_bbl: number;
  /** Existing chase volume, `chase.chase_bbl`. */
  chase_bbl: number;
}

export type KpiVolumesResult =
  | {
      ok: true;
      masp: MaspValue;
      kmw: KmwValue;
      chase: ChaseValue;
      kmwInString: KmwInStringValue;
      kmwBackfill: KmwBackfillValue;
      /**
       * Closed and open POOH tables, or `{ ok: false, error }` when stand length is blank or ≤ 0.
       * A STAND_LENGTH error does not blank the other KPI fields.
       */
      poohFill: PoohFillResult;
      /** Annular volume of the pill interval. Not added to the string-capacity check. */
      pillAnnularVolume_bbl: number;
      /** String capacity over the same pill MD interval. Not added to the annular volume. */
      stringCapOverPillInterval_bbl: number;
      /** `stringCapOverPillInterval_bbl + chase.chase_bbl`. */
      pillVolume_bbl: number;
      pillVolumeBreakdown: PillVolumeBreakdown;
    }
  | { ok: false; error: KpiError };

function fail(
  code: KpiError["code"],
  field: string,
  message: string,
): { ok: false; error: KpiError } {
  return { ok: false, error: { code, field, message } };
}

function missingOrBad(
  value: number | null | undefined,
  code: KpiError["code"],
  field: string,
  blank: string,
  invalid: string,
  allowZero: boolean,
): { ok: true; value: number } | { ok: false; error: KpiError } {
  if (value == null) return fail(code, field, blank);
  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    return fail(code, field, invalid);
  }
  return { ok: true, value };
}

export function masp(input: {
  fitEmw_ppg?: number | null;
  activeMw_ppg?: number | null;
  activeMwFluidId?: string | null;
  shoeTvd_ft?: number | null;
  plannedSbp_psi?: number | null;
}): MaspResult {
  const fit =
    input.fitEmw_ppg == null
      ? fail("MISSING_FIT", "well.fit_ppg", "FIT is missing.")
      : Number.isFinite(input.fitEmw_ppg)
        ? { ok: true as const, value: input.fitEmw_ppg }
        : fail("MISSING_FIT", "well.fit_ppg", "FIT is missing.");
  if (!fit.ok) return fit;
  const shoe = missingOrBad(
    input.shoeTvd_ft,
    "MISSING_SHOE_TVD",
    "well.shoeTvd_ft",
    "Shoe TVD is missing.",
    "Shoe TVD must be a finite number greater than 0.",
    false,
  );
  if (!shoe.ok) return shoe;
  const mw =
    input.activeMw_ppg == null || !Number.isFinite(input.activeMw_ppg)
      ? fail("MISSING_ACTIVE_MW", "activeMw_ppg", "Active mud weight is missing.")
      : { ok: true as const, value: input.activeMw_ppg };
  if (!mw.ok) return mw;
  const sbp =
    input.plannedSbp_psi == null
      ? fail("INVALID_SBP", "plannedSbp_psi", "Planned SBP is missing.")
      : Number.isFinite(input.plannedSbp_psi)
        ? { ok: true as const, value: input.plannedSbp_psi }
        : fail("INVALID_SBP", "plannedSbp_psi", "Planned SBP must be a finite number.");
  if (!sbp.ok) return sbp;

  const deltaEmw_ppg = fit.value - mw.value;
  const psiPerPpg = PSI_PER_PPG_FT * shoe.value;
  const masp_psi = deltaEmw_ppg * psiPerPpg;
  const margin_psi = masp_psi - sbp.value;
  if (!Number.isFinite(masp_psi) || !Number.isFinite(psiPerPpg) || !Number.isFinite(margin_psi)) {
    return fail("INVALID_GEOMETRY", "well.shoeTvd_ft", "MASP is not a finite pressure.");
  }
  const sbpText = Number.isInteger(sbp.value) ? String(sbp.value) : String(sbp.value);
  return {
    ok: true,
    fitEmw_ppg: fit.value,
    activeMw_ppg: mw.value,
    activeMwFluidId: input.activeMwFluidId ?? "",
    shoeTvd_ft: shoe.value,
    deltaEmw_ppg,
    psiPerPpg,
    masp_psi,
    plannedSbp_psi: sbp.value,
    margin_psi,
    sbpFlag: sbp.value < masp_psi ? `OK, SBP ${sbpText} < MASP` : "SBP >= MASP",
    sbpExceedsMasp: sbp.value > masp_psi,
  };
}

export function kmw(input: {
  activeMw_ppg?: number | null;
  sbp_psi?: number | null;
  anchorTvd_ft?: number | null;
}): KmwResult {
  const mw =
    input.activeMw_ppg == null || !Number.isFinite(input.activeMw_ppg)
      ? fail("MISSING_ACTIVE_MW", "activeMw_ppg", "Active mud weight is missing.")
      : { ok: true as const, value: input.activeMw_ppg };
  if (!mw.ok) return mw;
  const anchor =
    input.anchorTvd_ft == null
      ? fail("MISSING_ANCHOR_TVD", "well.anchorTvd_ft", "Anchor TVD is missing.")
      : !Number.isFinite(input.anchorTvd_ft) || input.anchorTvd_ft <= 0
        ? fail(
            "MISSING_ANCHOR_TVD",
            "well.anchorTvd_ft",
            "Anchor TVD must be a finite number greater than 0.",
          )
        : { ok: true as const, value: input.anchorTvd_ft };
  if (!anchor.ok) return anchor;
  const sbp =
    input.sbp_psi == null
      ? fail("INVALID_SBP", "plannedSbp_psi", "Planned SBP is missing.")
      : Number.isFinite(input.sbp_psi)
        ? { ok: true as const, value: input.sbp_psi }
        : fail("INVALID_SBP", "plannedSbp_psi", "Planned SBP must be a finite number.");
  if (!sbp.ok) return sbp;

  const psiPerPpg = PSI_PER_PPG_FT * anchor.value;
  const sbp_ppg = sbp.value / psiPerPpg;
  const raw_ppg = mw.value + sbp_ppg;
  const rounded_ppg = ceilingMath(raw_ppg, 0.1);
  if (!Number.isFinite(raw_ppg) || !Number.isFinite(rounded_ppg)) {
    return fail("MISSING_ANCHOR_TVD", "well.anchorTvd_ft", "KMW is not a finite mud weight.");
  }
  return {
    ok: true,
    activeMw_ppg: mw.value,
    sbp_psi: sbp.value,
    anchorTvd_ft: anchor.value,
    psiPerPpg,
    sbp_ppg,
    raw_ppg,
    rounded_ppg,
  };
}

function stringCapacity(well: Well): { ok: true; cap: number } | { ok: false; error: KpiError } {
  const cap = capBblFt(well.stringId_in);
  if (!Number.isFinite(cap) || cap <= 0) {
    return fail("INVALID_GEOMETRY", "well.stringId_in", "String capacity is not a finite bbl/ft.");
  }
  return { ok: true, cap };
}

function annularBreakdown(
  well: Well,
  fromMd: number,
  toMd: number,
): { ok: true; sections: AnnularSection[] } | { ok: false; error: KpiError } {
  const from = Math.min(fromMd, toMd);
  const to = Math.max(fromMd, toMd);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return fail("INVALID_GEOMETRY", "column", "Annular interval depths are not finite.");
  }
  if (to <= from + 1e-6) return { ok: true, sections: [] };
  const marks = [from, to, well.shoeMd_ft];
  for (const interval of well.casing) marks.push(interval.topMd_ft, interval.bottomMd_ft);
  const pts = uniqueSorted(
    marks.filter((mark) => mark >= from - 1e-6 && mark <= to + 1e-6),
    1e-4,
  );
  const sections: AnnularSection[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const topMd_ft = pts[i];
    const bottomMd_ft = pts[i + 1];
    const length_ft = bottomMd_ft - topMd_ft;
    if (length_ft <= 1e-6) continue;
    const holeId_in = holeIdAt(well, (topMd_ft + bottomMd_ft) / 2);
    const volume_bbl = intervalVolume(well, topMd_ft, bottomMd_ft, "annular");
    const annularCap_bblFt =
      holeId_in == null ? Number.NaN : annularBblFt(holeId_in, well.stringOd_in);
    if (
      holeId_in == null ||
      volume_bbl == null ||
      !Number.isFinite(volume_bbl) ||
      !Number.isFinite(annularCap_bblFt) ||
      annularCap_bblFt <= 0
    ) {
      return fail(
        "INVALID_GEOMETRY",
        "well.casing",
        "Annular volume is not a finite barrel count.",
      );
    }
    sections.push({
      topMd_ft,
      bottomMd_ft,
      length_ft,
      holeId_in,
      stringOd_in: well.stringOd_in,
      annularCap_bblFt,
      volume_bbl,
    });
  }
  return { ok: true, sections };
}

function spottedPill(
  job: Job,
): { topMd: number; bottomMd: number; fluidId: string; source: "pipe" | "annulus" } | null {
  const placed = pillPlacement(job);
  const fluidId = placed?.pill?.fluidId;
  if (!fluidId) return null;
  let pipeTop = Number.POSITIVE_INFINITY;
  let pipeBottom = Number.NEGATIVE_INFINITY;
  for (const segment of job.pipeColumn ?? []) {
    if (segment.fluidId !== fluidId) continue;
    pipeTop = Math.min(pipeTop, segment.topMd_ft);
    pipeBottom = Math.max(pipeBottom, segment.bottomMd_ft);
  }
  if (Number.isFinite(pipeTop) && Number.isFinite(pipeBottom)) {
    return { topMd: pipeTop, bottomMd: pipeBottom, fluidId, source: "pipe" };
  }
  if (!placed?.pill) return null;
  return {
    topMd: placed.pill.topMd,
    bottomMd: placed.pill.bottomMd,
    fluidId,
    source: "annulus",
  };
}

function surfaceLine(
  value: number | null | undefined,
): { ok: true; bbl: number } | { ok: false; error: KpiError } {
  if (value == null) return { ok: true, bbl: 0 };
  if (!Number.isFinite(value) || value < 0) {
    return fail(
      "INVALID_SURFACE_LINE",
      "surfaceLine_bbl",
      "Surface line volume must be a finite number greater than or equal to 0.",
    );
  }
  return { ok: true, bbl: value };
}

export function chaseVolume(
  job: Job,
  input: { surfaceLine_bbl?: number | null; pillBottomTargetMd_ft?: number | null } = {},
): ChaseResult | TaperedStringRefusal {
  const refused = taperedCalcRefusal(job);
  if (refused) return refused;

  const line = surfaceLine(input.surfaceLine_bbl);
  if (!line.ok) return line;
  const bore = stringCapacity(job.well);
  if (!bore.ok) return bore;
  if (!Number.isFinite(job.well.bitMd_ft) || job.well.bitMd_ft < 0) {
    return fail(
      "INVALID_GEOMETRY",
      "well.bitMd_ft",
      "Bit depth must be a finite number greater than or equal to 0.",
    );
  }
  const pill = spottedPill(job);
  const target = input.pillBottomTargetMd_ft == null ? pill?.bottomMd : input.pillBottomTargetMd_ft;
  if (target == null || !Number.isFinite(target)) {
    return fail("MISSING_PILL", "column", "Pill bottom target is missing.");
  }
  const annular = annularBreakdown(job.well, job.well.bitMd_ft, target);
  if (!annular.ok) return annular;
  const annularVolume_bbl = annular.sections.reduce((sum, section) => sum + section.volume_bbl, 0);
  const full = intervalVolume(
    job.well,
    Math.min(job.well.bitMd_ft, target),
    Math.max(job.well.bitMd_ft, target),
    "annular",
  );
  if (full == null || !Number.isFinite(full)) {
    return fail("INVALID_GEOMETRY", "well.casing", "Annular volume is not a finite barrel count.");
  }
  const pillInString_bbl = pill ? pipePillBbl(job, pill.fluidId) : 0;
  if (!Number.isFinite(pillInString_bbl)) {
    return fail("INVALID_GEOMETRY", "pipeColumn", "Pill volume in the string is not finite.");
  }
  const stringLength_ft = job.well.bitMd_ft;
  const stringCapacity_bbl = bore.cap * stringLength_ft;
  const chase_bbl = stringCapacity_bbl + full - pillInString_bbl;
  if (!Number.isFinite(stringCapacity_bbl) || !Number.isFinite(chase_bbl)) {
    return fail("INVALID_GEOMETRY", "well.stringId_in", "Chase volume is not finite.");
  }
  return {
    ok: true,
    stringId_in: job.well.stringId_in,
    stringCap_bblFt: bore.cap,
    bitMd_ft: job.well.bitMd_ft,
    stringLength_ft,
    stringCapacity_bbl,
    pillBottomTargetMd_ft: target,
    annularLength_ft: Math.abs(target - job.well.bitMd_ft),
    annularVolume_bbl: full,
    annularSections: annular.sections,
    pillFluidId: pill?.fluidId ?? null,
    pillInString_bbl,
    chase_bbl,
    surfaceLine_bbl: line.bbl,
  };
}

export function kmwInString(job: Job): KmwInStringResult | TaperedStringRefusal {
  const refused = taperedCalcRefusal(job);
  if (refused) return refused;

  const pill = spottedPill(job);
  if (!pill) return fail("MISSING_PILL", "column", "Pill top is missing.");
  const bore = stringCapacity(job.well);
  if (!bore.ok) return bore;
  if (!Number.isFinite(job.well.bitMd_ft) || job.well.bitMd_ft < 0) {
    return fail(
      "INVALID_GEOMETRY",
      "well.bitMd_ft",
      "Bit depth must be a finite number greater than or equal to 0.",
    );
  }
  const belowPillTop_ft = Math.max(0, job.well.bitMd_ft - pill.topMd);
  const belowPillTop_bbl = bore.cap * belowPillTop_ft;
  // Pill wholly in the annulus: the string figure is the whole string.
  // Pill inside the string: only that pipe column, never the annular pill volume.
  const height_ft = pill.source === "pipe" ? belowPillTop_ft : job.well.bitMd_ft;
  const bbl = bore.cap * height_ft;
  if (!Number.isFinite(bbl) || !Number.isFinite(belowPillTop_bbl)) {
    return fail("INVALID_GEOMETRY", "well.stringId_in", "String volume is not finite.");
  }
  return {
    ok: true,
    pillTopMd_ft: pill.topMd,
    pillTopSource: pill.source,
    stringId_in: job.well.stringId_in,
    stringCap_bblFt: bore.cap,
    height_ft,
    bbl,
    bitMd_ft: job.well.bitMd_ft,
    belowPillTop_ft,
    belowPillTop_bbl,
  };
}

export function kmwBackfill(job: Job): KmwBackfillResult | TaperedStringRefusal {
  const refused = taperedCalcRefusal(job);
  if (refused) return refused;

  const pill = spottedPill(job);
  if (!pill) return fail("MISSING_PILL", "column", "Pill top is missing.");
  if (!Number.isFinite(pill.topMd) || pill.topMd < 0) {
    return fail("MISSING_PILL", "column", "Pill top is missing.");
  }
  const annular = annularBreakdown(job.well, 0, pill.topMd);
  if (!annular.ok) return annular;
  const full = intervalVolume(job.well, 0, pill.topMd, "annular");
  if (full == null || !Number.isFinite(full)) {
    return fail("INVALID_GEOMETRY", "well.casing", "KMW backfill volume is not finite.");
  }
  return {
    ok: true,
    pillTopMd_ft: pill.topMd,
    length_ft: pill.topMd,
    stringOd_in: job.well.stringOd_in,
    volume_bbl: full,
    sections: annular.sections,
  };
}

function standRows(
  displacement_bblFt: number,
  standLength_ft: number,
  tripLength_ft: number,
): { ok: true; end: PoohFillEnd } | { ok: false; error: KpiError } {
  const stands: PoohFillStand[] = [];
  let runningTotal_bbl = 0;
  let remaining = tripLength_ft;
  let n = 0;
  while (remaining > 1e-6) {
    n += 1;
    const length_ft = Math.min(standLength_ft, remaining);
    const bbl = displacement_bblFt * length_ft;
    runningTotal_bbl += bbl;
    if (!Number.isFinite(bbl) || !Number.isFinite(runningTotal_bbl)) {
      return fail("INVALID_GEOMETRY", "well.stringOd_in", "POOH fill is not finite.");
    }
    stands.push({ n, length_ft, bbl, runningTotal_bbl });
    remaining -= length_ft;
  }
  return {
    ok: true,
    end: {
      displacement_bblFt,
      perStand_bbl: displacement_bblFt * standLength_ft,
      stands,
      total_bbl: displacement_bblFt * tripLength_ft,
    },
  };
}

/** Closed and open POOH tables from `job.trip.standLength_ft`. No stand length is assumed. */
export function poohFill(job: Job): PoohFillResult | TaperedStringRefusal {
  const refused = taperedCalcRefusal(job);
  if (refused) return refused;

  const entered = job.trip.standLength_ft;
  const stand = missingOrBad(
    entered != null && Number.isNaN(entered) ? null : entered,
    "STAND_LENGTH",
    "trip.standLength_ft",
    "Stand length is blank.",
    "Stand length must be a finite number greater than 0.",
    false,
  );
  if (!stand.ok) return stand;
  if (!Number.isFinite(job.well.bitMd_ft) || job.well.bitMd_ft < 0) {
    return fail(
      "INVALID_GEOMETRY",
      "well.bitMd_ft",
      "Bit depth must be a finite number greater than or equal to 0.",
    );
  }
  const closedDisplacement_bblFt = capBblFt(job.well.stringOd_in);
  const openDisplacement_bblFt = annularBblFt(job.well.stringOd_in, job.well.stringId_in);
  if (!Number.isFinite(closedDisplacement_bblFt) || closedDisplacement_bblFt <= 0) {
    return fail(
      "INVALID_GEOMETRY",
      "well.stringOd_in",
      "Closed-pipe displacement is not a finite bbl/ft.",
    );
  }
  if (!Number.isFinite(openDisplacement_bblFt) || openDisplacement_bblFt <= 0) {
    return fail(
      "INVALID_GEOMETRY",
      "well.stringId_in",
      "Open-pipe displacement is not a finite bbl/ft.",
    );
  }
  const tripLength_ft = job.well.bitMd_ft;
  const closed = standRows(closedDisplacement_bblFt, stand.value, tripLength_ft);
  if (!closed.ok) return closed;
  const open = standRows(openDisplacement_bblFt, stand.value, tripLength_ft);
  if (!open.ok) return open;
  const fullStandCount = Math.floor(tripLength_ft / stand.value + 1e-9);
  const partialStand_ft = tripLength_ft - fullStandCount * stand.value;
  return {
    ok: true,
    stringOd_in: job.well.stringOd_in,
    stringId_in: job.well.stringId_in,
    standLength_ft: stand.value,
    tripLength_ft,
    fullStandCount,
    partialStand_ft: partialStand_ft > 1e-6 ? partialStand_ft : 0,
    closed: closed.end,
    open: open.end,
  };
}

function activeMud(
  job: Job,
): { ok: true; ppg: number; fluidId: string } | { ok: false; error: KpiError } {
  const surface = surfaceFluid(job);
  if (!surface || !Number.isFinite(surface.fluid.density_ppg)) {
    return fail("MISSING_ACTIVE_MW", "activeMw_ppg", "Active mud weight is missing.");
  }
  return { ok: true, ppg: surface.fluid.density_ppg, fluidId: surface.fluid.id };
}

/**
 * MASP, KMW, chase, KMW left in the string, annular backfill, and POOH fill.
 * The annular pill volume and the string capacity over that same interval are returned
 * separately and are never added together.
 * Pill volume is string capacity over the pill interval plus chase.
 * It is that sum, not the surface-to-bit string capacity added again.
 * A missing FIT, shoe TVD, or anchor TVD stops the result. Anchor TVD is never taken from the survey.
 * A blank or non-positive stand length does not: the other fields are returned and `poohFill` carries STAND_LENGTH.
 */
export function kpiVolumes(job: Job, input: KpiVolumesInput = {}): KpiVolumesResult | TaperedStringRefusal {
  const refused = taperedCalcRefusal(job);
  if (refused) return refused;

  const mud = activeMud(job);
  if (!mud.ok) return mud;
  const planned = input.plannedSbp_psi == null ? job.trip.sbpConn_psi : input.plannedSbp_psi;
  const maspResult = masp({
    fitEmw_ppg: job.well.fit_ppg,
    activeMw_ppg: mud.ppg,
    activeMwFluidId: mud.fluidId,
    shoeTvd_ft: job.well.shoeTvd_ft,
    plannedSbp_psi: planned,
  });
  if (!maspResult.ok) return maspResult;
  const kmwResult = kmw({
    activeMw_ppg: mud.ppg,
    sbp_psi: planned,
    anchorTvd_ft: job.well.anchorTvd_ft,
  });
  if (!kmwResult.ok) return kmwResult;
  const chase = demandSupported(chaseVolume(job, input));
  if (!chase.ok) return chase;
  const inString = demandSupported(kmwInString(job));
  if (!inString.ok) return inString;
  const backfill = demandSupported(kmwBackfill(job));
  if (!backfill.ok) return backfill;
  const fill = demandSupported(poohFill(job));
  if (!fill.ok && fill.error.code !== "STAND_LENGTH") return fill;
  const checks = separatePillChecks(job);
  if (!checks.ok) return checks;
  const chaseValue = stripOk(chase);
  const pillVolumeBreakdown: PillVolumeBreakdown = {
    stringCapOverPillInterval_bbl: checks.stringCapOverPillInterval_bbl,
    chase_bbl: chaseValue.chase_bbl,
  };
  return {
    ok: true,
    masp: stripOk(maspResult),
    kmw: stripOk(kmwResult),
    chase: chaseValue,
    kmwInString: stripOk(inString),
    kmwBackfill: stripOk(backfill),
    poohFill: fill,
    pillAnnularVolume_bbl: checks.pillAnnularVolume_bbl,
    stringCapOverPillInterval_bbl: checks.stringCapOverPillInterval_bbl,
    pillVolumeBreakdown,
    pillVolume_bbl:
      pillVolumeBreakdown.stringCapOverPillInterval_bbl + pillVolumeBreakdown.chase_bbl,
  };
}

/** Annular pill volume and string capacity over that MD interval. Not summed. */
function separatePillChecks(
  job: Job,
):
  | { ok: true; pillAnnularVolume_bbl: number; stringCapOverPillInterval_bbl: number }
  | { ok: false; error: KpiError } {
  const pill = spottedPill(job);
  if (!pill) return fail("MISSING_PILL", "column", "Pill top is missing.");
  const length = pill.bottomMd - pill.topMd;
  if (!Number.isFinite(length) || length < 0) {
    return fail("MISSING_PILL", "column", "Pill top is missing.");
  }
  const bore = stringCapacity(job.well);
  if (!bore.ok) return bore;
  const annular = intervalVolume(job.well, pill.topMd, pill.bottomMd, "annular");
  const stringCapOverPillInterval_bbl = bore.cap * length;
  if (
    annular == null ||
    !Number.isFinite(annular) ||
    !Number.isFinite(stringCapOverPillInterval_bbl)
  ) {
    return fail("INVALID_GEOMETRY", "column", "Pill interval volume is not finite.");
  }
  return {
    ok: true,
    pillAnnularVolume_bbl: annular,
    stringCapOverPillInterval_bbl,
  };
}

function stripOk<T extends { ok: true }>(result: T): Omit<T, "ok"> {
  const { ok: _ok, ...value } = result;
  return value;
}
