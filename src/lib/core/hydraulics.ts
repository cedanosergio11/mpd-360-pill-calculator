import { segmentDp, veffClosed, veffOpen, vel, type Rheology } from "@/lib/calc/rp13d";
import { esdAtMd, fluidAt } from "./column";
import { holeIdAt, uniqueSorted } from "./geometry";
import type { Job } from "./job.schema";
import { PSI_PER_PPG_FT } from "./result";
import { placedStringSections, stringSectionAt, usesTaperedString } from "./string";
import { tvdAt } from "./tvd";

export interface EmwPair {
  surge_ppg: number;
  swab_ppg: number;
}

/** One annular piece: hole interval over one string section, split again on fluid. */
export interface AnnularFrictionSegment {
  topMd_ft: number;
  bottomMd_ft: number;
  length_ft: number;
  holeId_in: number;
  pipeOd_in: number;
  pipeId_in: number;
  fluidId: string;
  density_ppg: number;
  velocity_ftmin: number;
  laminar: boolean;
  friction_psi: number;
}

function rheologyOf(job: Job, md: number): Rheology | null {
  const ref = fluidAt(job, md);
  const fann = ref?.fluid.fann;
  if (!ref || !fann) return null;
  const rh: Rheology = {
    r600: fann.r600,
    r300: fann.r300,
    r6: fann.r6,
    r3: fann.r3,
    r200: fann.r200,
    r100: fann.r100,
  };
  if (ref.fluid.gel10m_lbf100ft2 != null) rh.gel10 = ref.fluid.gel10m_lbf100ft2;
  if (!(rh.r600 > rh.r300 && rh.r300 > 0 && rh.r6 >= rh.r3 && rh.r3 >= 0)) return null;
  const ty = Math.max(0, 2 * rh.r3 - rh.r6);
  if (ty >= rh.r300) return null;
  return rh;
}

function sliceMarks(job: Job, limit: number): number[] {
  const marks = [0, limit, job.well.shoeMd_ft];
  for (const interval of job.well.casing) marks.push(interval.topMd_ft, interval.bottomMd_ft);
  for (const segment of job.column) marks.push(segment.topMd_ft, segment.bottomMd_ft);
  if (usesTaperedString(job.well)) {
    for (const section of placedStringSections(job.well) ?? []) {
      marks.push(section.topMd_ft, section.bottomMd_ft);
    }
  }
  return uniqueSorted(
    marks.filter((mark) => mark >= -1e-6 && mark <= limit + 1e-6),
    1e-3,
  );
}

/**
 * Annular friction, psi, from surface down to min(poiMd, bitMd).
 * Circulation uses RP 13D Eq 58/59. A trip uses closed Eq 100 or open Eq 101.
 * Each column slice keeps its own density and Fann readings.
 * Null when geometry or rheology is missing — never a fabricated loss.
 */
/**
 * Annular friction pieces from surface down to min(poiMd, bitMd).
 * A tapered string splits the hole intervals on each section crossover.
 * Each piece uses that annulus's velocity and its own laminar check.
 */
export function annularFrictionSegments(
  job: Job,
  poiMd: number,
  bitMd: number,
  motion: { kind: "flow" } | { kind: "trip"; speed_ftmin: number },
): AnnularFrictionSegment[] | null {
  const limit = Math.min(poiMd, bitMd);
  if (!Number.isFinite(limit) || limit <= 0) return [];
  if (motion.kind === "flow" && !(job.trip.flow_gpm > 0)) return [];
  if (motion.kind === "trip" && !(motion.speed_ftmin > 0)) return null;

  const pts = sliceMarks(job, limit);
  const tapered = usesTaperedString(job.well);
  const segments: AnnularFrictionSegment[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const length = pts[i + 1] - pts[i];
    if (length <= 1e-6) continue;
    const mid = (pts[i] + pts[i + 1]) / 2;
    const dh = holeIdAt(job.well, mid);
    let dp = job.well.stringOd_in;
    let di = job.well.stringId_in;
    if (tapered) {
      const section = stringSectionAt(job.well, mid);
      if (!section) return null;
      dp = section.od_in;
      di = section.id_in;
    }
    const fluid = fluidAt(job, mid);
    const rh = rheologyOf(job, mid);
    if (dh == null || !(dh > dp) || !fluid || !rh) return null;
    const velocity =
      motion.kind === "flow"
        ? vel(job.trip.flow_gpm, dh, dp)
        : job.trip.pipeEnd === "open"
          ? veffOpen(motion.speed_ftmin, dh, dp, di, job.trip.clinging)
          : veffClosed(motion.speed_ftmin, dh, dp, job.trip.clinging);
    if (!Number.isFinite(velocity) || velocity < 0) return null;
    const loss = segmentDp(
      fluid.fluid.density_ppg,
      velocity,
      dh,
      dp,
      length,
      rh,
      true,
      job.trip.eccentricity,
    );
    if (!Number.isFinite(loss.p)) return null;
    segments.push({
      topMd_ft: pts[i],
      bottomMd_ft: pts[i + 1],
      length_ft: length,
      holeId_in: dh,
      pipeOd_in: dp,
      pipeId_in: di,
      fluidId: fluid.fluid.id,
      density_ppg: fluid.fluid.density_ppg,
      velocity_ftmin: velocity,
      laminar: loss.laminar,
      friction_psi: loss.p,
    });
  }
  return segments;
}

export function frictionPsi(
  job: Job,
  poiMd: number,
  bitMd: number,
  motion: { kind: "flow" } | { kind: "trip"; speed_ftmin: number },
): number | null {
  const limit = Math.min(poiMd, bitMd);
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  if (motion.kind === "flow" && !(job.trip.flow_gpm > 0)) return 0;
  if (motion.kind === "trip" && !(motion.speed_ftmin > 0)) return null;
  const segments = annularFrictionSegments(job, poiMd, bitMd, motion);
  if (segments == null) return null;
  let psi = 0;
  for (const segment of segments) psi += segment.friction_psi;
  return psi;
}

/** ECD = ESD + (annular friction + circulating SBP) / (0.052 · TVD). RP 13D Eq 98. */
export function ecdPpg(
  esd: number | null,
  friction: number | null,
  tvd: number | null,
  sbpPsi: number,
): number | null {
  if (esd == null || friction == null || tvd == null || !(tvd > 0) || !Number.isFinite(sbpPsi))
    return null;
  return esd + (friction + sbpPsi) / (PSI_PER_PPG_FT * tvd);
}

/**
 * Swab / surge EMW at `md` with `sbpPsi` applied, pumps off.
 * Friction stops at the bit. ESD is the fluid column to `md`.
 */
export function emwFromParts(
  job: Job,
  md: number,
  bitMd: number,
  speed: number,
  sbpPsi: number,
): EmwPair | null {
  if (!(md > 0) || !Number.isFinite(sbpPsi)) return null;
  const esd = esdAtMd(job, md);
  const tvd = tvdAt(job.well, md);
  const dP = frictionPsi(job, md, bitMd, { kind: "trip", speed_ftmin: speed });
  if (esd == null || tvd == null || !(tvd > 0) || dP == null) return null;
  const perPsi = 1 / (PSI_PER_PPG_FT * tvd);
  return {
    surge_ppg: esd + (sbpPsi + dP) * perPsi,
    swab_ppg: esd + (sbpPsi - dP) * perPsi,
  };
}

/** Friction psi at `md` for a trip speed, or null when it cannot be computed. */
export function tripFrictionPsi(job: Job, md: number, bitMd: number, speed: number): number | null {
  return frictionPsi(job, md, bitMd, { kind: "trip", speed_ftmin: speed });
}
