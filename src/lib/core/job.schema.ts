/**
 * PillView job contract, schema version 1.
 * Pure data — no React. Field names are the wire format.
 */

export const SCHEMA_VERSION = 1 as const;

export type SchemaVersion = typeof SCHEMA_VERSION;

export type PillMode = "withDP" | "noDP";

export type PipeEnd = "closed" | "open";

/** Fann dial readings, lbf/100 ft². HB uses 600/300/6/3; 200/100 are stored for the contract. */
export interface FannReading {
  r600: number;
  r300: number;
  r200: number;
  r100: number;
  r6: number;
  r3: number;
}

export interface Fluid {
  id: string;
  label: string;
  density_ppg: number;
  fann?: FannReading;
  /** 10-minute gel, lbf/100 ft². Not used by the step-1 hydraulics. */
  gel10m_lbf100ft2?: number;
}

/** One interval of the single fluid column, measured depth, shallow top to deep bottom. */
export interface ColumnSegment {
  fluidId: string;
  topMd_ft: number;
  bottomMd_ft: number;
}

export interface CasingInterval {
  topMd_ft: number;
  bottomMd_ft: number;
  id_in: number;
  /** Set when this interval is a liner rather than a full string. */
  liner?: boolean;
}

export interface SurveyStation {
  md_ft: number;
  tvd_ft: number;
}

export interface Well {
  mdTd_ft: number;
  tvdTd_ft: number;
  /**
   * Bit depth. Separate from TD: surge, swab, ECD and pill equalization
   * are taken at the bit, not at TD, when the bit is off bottom.
   */
  bitMd_ft: number;
  shoeMd_ft: number;
  shoeTvd_ft: number;
  anchorMd_ft: number;
  /** Omitted → derive from the survey, or linear MD→TVD when there is no survey. */
  anchorTvd_ft?: number;
  fit_ppg: number;
  porePressure_ppg?: number;
  targetEmw_ppg: number;
  casing: CasingInterval[];
  openHoleId_in: number;
  stringOd_in: number;
  stringId_in: number;
  survey?: SurveyStation[];
}

export interface TripInputs {
  speeds_ftmin: number[];
  pipeEnd: PipeEnd;
  /** Clinging factor, API RP 13D Eq 100/101. Dimensionless, typically 0.45. */
  clinging: number;
  /** Eccentricity ratio 0–1. 0 is concentric. */
  eccentricity: number;
  /** Connection (pumps-off) surface backpressure, psi. Applied to swab/surge EMW. */
  sbpConn_psi: number;
  /** Circulating surface backpressure, psi. Applied to ECD. */
  sbpCirc_psi: number;
  flow_gpm: number;
}

export interface Job {
  schemaVersion: SchemaVersion;
  name: string;
  /** ISO-8601 timestamp. Excluded from `inputHash`. */
  savedAt: string;
  well: Well;
  /**
   * Shoe ESD differs by mode (1.0.7.1).
   * `noDP`: hydrostatic of the fluid column only.
   * `withDP`: same column, plus equalize pressure only for pill fluid that
   * stands above the shoe. Step 1 does not invent that equalize term — see
   * EQUALIZE_PENDING. A pill that never reaches the shoe adds nothing.
   */
  mode: PillMode;
  fluids: Fluid[];
  /** Single fluid column from surface to TD. Contiguous, no gaps or overlaps. */
  column: ColumnSegment[];
  trip: TripInputs;
}
