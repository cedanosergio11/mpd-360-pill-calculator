import type { Issue } from "./issues";

/** Step-1 calculation core. Independent of the app's user-facing version. */
export const CALC_VERSION = "0.1.0";

export const PSI_PER_PPG_FT = 0.052;

export type DepthKey = "shoe" | "anchor" | "td";

export type TripPointKey = "shoe" | "anchor" | "bit";

export type TripDirection = "POOH" | "RIH";

/** Why a faster trip speed was rejected. `none` means the fastest grid speed passed. */
export type TripLimit = "FIT" | "targetEmw" | "pore" | "none";

export interface SpeedEmw {
  speed_ftmin: number;
  emw_ppg: number;
}

export interface DepthResult {
  md_ft: number;
  tvd_ft: number | null;
  esd_ppg: number | null;
  ecd_ppg: number | null;
  /** Present at the shoe only. Null at anchor and TD. */
  fit_ppg: number | null;
  /** Entered pore, copied to each depth. Not a gradient. */
  pore_ppg: number | null;
  targetEmw_ppg: number;
  surge: SpeedEmw[];
  swab: SpeedEmw[];
}

export interface DisplacementStage {
  /** 1-based. `tripSchedule[].stage` points at this value. */
  n: number;
  bitMd_ft: number;
  /** Release blocker. Null until circulated volume per stage exists — never a placeholder 0. */
  pumped_bbl: number | null;
  sbp_psi: number | null;
  shoeEsd_ppg: number | null;
  anchorEsd_ppg: number | null;
  tdEsd_ppg: number | null;
}

export interface Displacement {
  pillVolume_bbl: number | null;
  slugVolume_bbl?: number;
  pillTopMd_ft: number | null;
  pillBottomMd_ft: number | null;
  pillTopTvd_ft: number | null;
  pillBottomTvd_ft: number | null;
  stages: DisplacementStage[];
  minStagesRih: number | null;
}

export interface TripEmw {
  surge_ppg: number | null;
  swab_ppg: number | null;
}

/**
 * One bit-depth step, in trip order (POOH from the bit to surface, then RIH back).
 * `emwAt` is at `maxSpeed`, pumps off, with `sbpRequired_psi` applied.
 * `maxSpeed` is null when no grid speed passes — never 0.
 */
export interface TripScheduleRow {
  direction: TripDirection;
  fromBitMd_ft: number;
  toBitMd_ft: number;
  maxSpeed_ftmin: number | null;
  emwAt: Record<TripPointKey, TripEmw>;
  /** Pumps off, no friction: SBP that holds anchor ESD at target EMW. */
  sbpStatic_psi: number | null;
  /** At maxSpeed: SBP that keeps anchor swab at or above target EMW (and swab at or above pore). */
  sbpRequired_psi: number | null;
  limitedBy: TripLimit;
  /** Links to `displacement.stages[].n` when this RIH step ends on a stage bit. */
  stage?: number;
}

export interface Result {
  calcVersion: string;
  /** Stable hash of the job JSON excluding `savedAt`. */
  inputHash: string;
  depths: Record<DepthKey, DepthResult>;
  displacement: Displacement;
  tripSchedule: TripScheduleRow[];
  issues: Issue[];
}
