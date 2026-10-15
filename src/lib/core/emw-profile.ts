import { columnDisplacedByPipe, esdAtMd, pillPlacement } from "./column";
import { balanceFloat, pipePillBbl } from "./equalize";
import { uniqueSorted } from "./geometry";
import { ecdPpg, frictionPsi } from "./hydraulics";
import type { Job } from "./job.schema";
import { PSI_PER_PPG_FT } from "./result";
import { tvdAt } from "./tvd";

/**
 * EMW versus TVD. Pressures use TVD and 0.052. Fluid columns stay in MD and
 * are converted with `tvdAt`. Static EMW is `esdAtMd` (the stacked column
 * above that depth). Connection SBP is `trip.sbpConn_psi`. ECD adds annular
 * RP 13D friction and circulating SBP.
 *
 * Pill in place is the entered annulus. Pill spotted is the 1.0.7.1 shoe-ESD
 * column at the bit: float balance when the pipe holds pill, otherwise closed
 * pipe displacement. A missing required input fails the whole profile.
 * Omitted pore is not defaulted: `limits.pore_ppg` is null and there is no pore line.
 */

const GRID_FT = 100;

export interface EmwError {
  code:
    | "MISSING_FIT"
    | "MISSING_SHOE_TVD"
    | "MISSING_SBP"
    | "INVALID_SBP"
    | "INVALID_FLOW"
    | "MISSING_PILL"
    | "MISSING_FANN"
    | "INVALID_GEOMETRY"
    | "MISSING_TVD";
  field: string;
  message: string;
}

export type EmwLineName = "static" | "staticSbp" | "ecd";

export type EmwPillState = "inPlace" | "spotted";

export type EmwStationLabel = "anchor" | "shoe" | "bit";

export interface EmwPoint {
  tvd_ft: number;
  md_ft: number;
  emw_ppg: number;
}

export interface EmwLines {
  static: EmwPoint[];
  staticSbp: EmwPoint[];
  ecd: EmwPoint[];
}

/** EMW, ppg, of one pill state at a labeled station. */
export interface EmwStationEmw {
  static: number;
  staticSbp: number;
  ecd: number;
}

export interface EmwStation {
  label: EmwStationLabel;
  tvd_ft: number;
  md_ft: number;
  emw: { inPlace: EmwStationEmw; spotted: EmwStationEmw };
}

export interface EmwLimits {
  /** Entered pore, ppg. Null when omitted. Not defaulted. No pore-versus-depth table. */
  pore_ppg: number | null;
  /** FIT EMW at the shoe, ppg. Vertical limit. */
  fit_ppg: number;
}

export interface EmwCrossing {
  tvd_ft: number;
  line: EmwLineName;
  pillState: EmwPillState;
  limit: "pore" | "fit";
}

export interface EmwProfileValue {
  inPlace: { lines: EmwLines };
  spotted: { lines: EmwLines };
  /** Shoe, then anchor, then bit. Anchor and bit stay separate when they share a depth. */
  stations: EmwStation[];
  limits: EmwLimits;
  crossings: EmwCrossing[];
}

export type EmwProfileResult = ({ ok: true } & EmwProfileValue) | { ok: false; error: EmwError };

interface GridPoint {
  md_ft: number;
  tvd_ft: number;
}

const STATION_LABELS: readonly EmwStationLabel[] = ["shoe", "anchor", "bit"];

function fail(
  code: EmwError["code"],
  field: string,
  message: string,
): { ok: false; error: EmwError } {
  return { ok: false, error: { code, field, message } };
}

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function mdFor(job: Job, label: EmwStationLabel): number {
  if (label === "shoe") return job.well.shoeMd_ft;
  if (label === "anchor") return job.well.anchorMd_ft;
  return job.well.bitMd_ft;
}

function depthStations(job: Job): { ok: true; grid: GridPoint[] } | { ok: false; error: EmwError } {
  const shoeTvd = job.well.shoeTvd_ft;
  if (!finite(shoeTvd) || !(shoeTvd > 0)) {
    return fail("MISSING_SHOE_TVD", "well.shoeTvd_ft", "Shoe TVD is missing.");
  }
  if (!finite(job.well.bitMd_ft) || !(job.well.bitMd_ft > 0)) {
    return fail(
      "INVALID_GEOMETRY",
      "well.bitMd_ft",
      "Bit depth must be a finite number greater than 0.",
    );
  }
  const end = Math.max(job.well.bitMd_ft, job.well.shoeMd_ft, job.well.anchorMd_ft);
  if (!finite(end) || !(end > 0)) {
    return fail("INVALID_GEOMETRY", "well.bitMd_ft", "Profile depth is not finite.");
  }
  const raw: number[] = [job.well.shoeMd_ft, job.well.anchorMd_ft, job.well.bitMd_ft];
  for (let md = GRID_FT; md < end - 1e-4; md += GRID_FT) raw.push(md);
  if (Math.abs(end % GRID_FT) > 1e-4) raw.push(end);
  const grid: GridPoint[] = [];
  for (const md of uniqueSorted(
    raw.filter((md) => md > 0.5),
    1e-3,
  )) {
    const tvd = tvdAt(job.well, md);
    if (tvd == null || !Number.isFinite(tvd)) {
      return fail("MISSING_TVD", "well.survey", "TVD cannot be resolved at a profile station.");
    }
    if (!(tvd > 0)) {
      return fail("MISSING_TVD", "well.survey", "A profile station has no positive TVD.");
    }
    grid.push({ md_ft: md, tvd_ft: tvd });
  }
  const present = STATION_LABELS.every((label) =>
    grid.some((point) => Math.abs(point.md_ft - mdFor(job, label)) <= 0.5),
  );
  if (!present) {
    return fail(
      "INVALID_GEOMETRY",
      "well.bitMd_ft",
      "Shoe, anchor, and bit are not on the profile.",
    );
  }
  return { ok: true, grid };
}

function columnFluidsLackFann(job: Job): boolean {
  if (!(job.trip.flow_gpm > 0)) return false;
  const seen = new Set<string>();
  for (const segment of job.column) {
    if (seen.has(segment.fluidId)) continue;
    seen.add(segment.fluidId);
    const fluid = job.fluids.find((item) => item.id === segment.fluidId);
    const fann = fluid?.fann;
    if (!fann) return true;
    const readings = [fann.r600, fann.r300, fann.r200, fann.r100, fann.r6, fann.r3];
    if (readings.some((reading) => !Number.isFinite(reading))) return true;
  }
  return false;
}

/** Annulus as entered. Pipe-out pill, or the withDP annulus before the float balance. */
function inPlaceColumn(job: Job): { ok: true; job: Job } | { ok: false; error: EmwError } {
  if (!pillPlacement(job)?.pill) {
    return fail("MISSING_PILL", "column", "Pill interval is missing.");
  }
  return { ok: true, job };
}

/**
 * Shoe-ESD column at the bit. withDP pipe pill uses the float balance.
 * Otherwise the closed pipe displaces the pipe-out pill.
 */
function spottedColumn(job: Job): { ok: true; job: Job } | { ok: false; error: EmwError } {
  const place = pillPlacement(job);
  if (!place?.pill) return fail("MISSING_PILL", "column", "Pill interval is missing.");
  if (job.mode === "withDP" && pipePillBbl(job, place.pill.fluidId) > 0.05) {
    const balance = balanceFloat(job);
    if (!balance) {
      return fail("INVALID_GEOMETRY", "pipeColumn", "Spotted pill column could not be balanced.");
    }
    return { ok: true, job: balance.columnJob };
  }
  const displaced = columnDisplacedByPipe(job, job.well.bitMd_ft);
  if (!displaced) {
    return fail(
      "INVALID_GEOMETRY",
      "well.stringOd_in",
      "Spotted pill column could not be placed around the pipe.",
    );
  }
  return { ok: true, job: displaced };
}

function pointAt(points: EmwPoint[], md: number): EmwPoint | undefined {
  return points.find((point) => Math.abs(point.md_ft - md) < 0.5);
}

function stationEmw(lines: EmwLines, md: number): EmwStationEmw | null {
  const staticPoint = pointAt(lines.static, md);
  const sbpPoint = pointAt(lines.staticSbp, md);
  const ecdPoint = pointAt(lines.ecd, md);
  if (!staticPoint || !sbpPoint || !ecdPoint) return null;
  return {
    static: staticPoint.emw_ppg,
    staticSbp: sbpPoint.emw_ppg,
    ecd: ecdPoint.emw_ppg,
  };
}

function labeledStations(
  job: Job,
  grid: GridPoint[],
  inPlace: EmwLines,
  spotted: EmwLines,
): EmwStation[] | null {
  const stations: EmwStation[] = [];
  for (const label of STATION_LABELS) {
    const md = mdFor(job, label);
    const gridPoint = grid.find((point) => Math.abs(point.md_ft - md) <= 0.5);
    const inPlaceEmw = stationEmw(inPlace, md);
    const spottedEmw = stationEmw(spotted, md);
    if (!gridPoint || !inPlaceEmw || !spottedEmw) return null;
    stations.push({
      label,
      tvd_ft: gridPoint.tvd_ft,
      md_ft: gridPoint.md_ft,
      emw: { inPlace: inPlaceEmw, spotted: spottedEmw },
    });
  }
  return stations;
}

function lineCrossings(
  pillState: EmwPillState,
  line: EmwLineName,
  points: EmwPoint[],
  fit: number,
  pore: number | null,
): EmwCrossing[] {
  const flags: EmwCrossing[] = [];
  const watch = (limit: "pore" | "fit", unsafe: (emw: number) => boolean) => {
    let was = unsafe(points[0].emw_ppg);
    if (was) flags.push({ tvd_ft: points[0].tvd_ft, line, pillState, limit });
    for (let i = 1; i < points.length; i++) {
      const now = unsafe(points[i].emw_ppg);
      if (now !== was) flags.push({ tvd_ft: points[i].tvd_ft, line, pillState, limit });
      was = now;
    }
  };
  watch("fit", (emw) => emw >= fit - 1e-9);
  if (pore != null) watch("pore", (emw) => emw <= pore + 1e-9);
  return flags;
}

function crossingsFor(
  pillState: EmwPillState,
  lines: EmwLines,
  fit: number,
  pore: number | null,
): EmwCrossing[] {
  return [
    ...lineCrossings(pillState, "static", lines.static, fit, pore),
    ...lineCrossings(pillState, "staticSbp", lines.staticSbp, fit, pore),
    ...lineCrossings(pillState, "ecd", lines.ecd, fit, pore),
  ];
}

function profileFor(
  column: Job,
  grid: GridPoint[],
  sbpConn: number,
  sbpCirc: number,
): { ok: true; lines: EmwLines } | { ok: false; error: EmwError } {
  const bit = column.well.bitMd_ft;
  const staticLine: EmwPoint[] = [];
  const staticSbp: EmwPoint[] = [];
  const ecd: EmwPoint[] = [];
  for (const station of grid) {
    const esd = esdAtMd(column, station.md_ft);
    if (esd == null || !Number.isFinite(esd)) {
      return fail("INVALID_GEOMETRY", "column", "Static EMW is not finite.");
    }
    const friction = frictionPsi(column, station.md_ft, bit, { kind: "flow" });
    const circulating = ecdPpg(esd, friction, station.tvd_ft, sbpCirc);
    if (friction == null || circulating == null || !Number.isFinite(circulating)) {
      return fail("INVALID_GEOMETRY", "well.casing", "ECD is not finite.");
    }
    const withSbp = esd + sbpConn / (PSI_PER_PPG_FT * station.tvd_ft);
    if (!Number.isFinite(withSbp)) {
      return fail("MISSING_SBP", "trip.sbpConn_psi", "Static EMW with SBP is not finite.");
    }
    staticLine.push({ tvd_ft: station.tvd_ft, md_ft: station.md_ft, emw_ppg: esd });
    staticSbp.push({ tvd_ft: station.tvd_ft, md_ft: station.md_ft, emw_ppg: withSbp });
    ecd.push({ tvd_ft: station.tvd_ft, md_ft: station.md_ft, emw_ppg: circulating });
  }
  return { ok: true, lines: { static: staticLine, staticSbp, ecd } };
}

/**
 * Static, static-plus-connection-SBP, and ECD profiles for the pill in place
 * and the pill spotted. FIT is the shoe EMW. Pore is the entered ppg when
 * present. A failure returns no stations and no lines.
 */
export function emwProfile(job: Job): EmwProfileResult {
  if (!finite(job.well.fit_ppg)) {
    return fail("MISSING_FIT", "well.fit_ppg", "FIT is missing.");
  }
  if (!finite(job.trip.sbpConn_psi)) {
    return fail("MISSING_SBP", "trip.sbpConn_psi", "Connection SBP is missing.");
  }
  if (!finite(job.trip.sbpCirc_psi)) {
    return fail("INVALID_SBP", "trip.sbpCirc_psi", "Circulating SBP is missing.");
  }
  if (!finite(job.trip.flow_gpm) || job.trip.flow_gpm < 0) {
    return fail(
      "INVALID_FLOW",
      "trip.flow_gpm",
      "Flow must be a finite number greater than or equal to 0.",
    );
  }
  const enteredPore = job.well.porePressure_ppg;
  if (enteredPore != null && !Number.isFinite(enteredPore)) {
    return fail("INVALID_GEOMETRY", "well.porePressure_ppg", "Pore pressure is not finite.");
  }
  if (columnFluidsLackFann(job)) {
    return fail("MISSING_FANN", "fluids", "Annular friction needs all six Fann readings.");
  }
  const stations = depthStations(job);
  if (!stations.ok) return stations;
  const inPlace = inPlaceColumn(job);
  if (!inPlace.ok) return inPlace;
  const spotted = spottedColumn(job);
  if (!spotted.ok) return spotted;
  const pore = enteredPore == null ? null : enteredPore;
  const placed = profileFor(inPlace.job, stations.grid, job.trip.sbpConn_psi, job.trip.sbpCirc_psi);
  if (!placed.ok) return placed;
  const spottedProfile = profileFor(
    spotted.job,
    stations.grid,
    job.trip.sbpConn_psi,
    job.trip.sbpCirc_psi,
  );
  if (!spottedProfile.ok) return spottedProfile;
  const labeled = labeledStations(job, stations.grid, placed.lines, spottedProfile.lines);
  if (!labeled) {
    return fail(
      "INVALID_GEOMETRY",
      "well.bitMd_ft",
      "Shoe, anchor, and bit are not on the profile.",
    );
  }
  return {
    ok: true,
    inPlace: { lines: placed.lines },
    spotted: { lines: spottedProfile.lines },
    stations: labeled,
    limits: { pore_ppg: pore, fit_ppg: job.well.fit_ppg },
    crossings: [
      ...crossingsFor("inPlace", placed.lines, job.well.fit_ppg, pore),
      ...crossingsFor("spotted", spottedProfile.lines, job.well.fit_ppg, pore),
    ],
  };
}
