/**
 * API RP 13D (7th ed., 2017, reaffirmed 2023) Herschel-Bulkley hydraulics.
 * Isolated from the 1.0.7.1 sheet. USC units: Q gpm, d in, V ft/min, rho ppg,
 * Fann dial lbf/100 ft², L ft, P psi.
 * Steady-state, isothermal, concentric unless eccentricity > 0, non-rotating,
 * no tool joints, uniform string OD. No BHA or collar inputs.
 * Eqs from §7.4, §7.9, §8.
 */

export interface Rheology {
  r600: number;
  r300: number;
  r200: number;
  r100: number;
  r6: number;
  r3: number;
}

export interface HbParams {
  /** Yield stress τy, lbf/100 ft² (Eq 25, LSYP). */
  ty: number;
  /** HB flow index n (Eq 23). */
  n: number;
  /** HB consistency k, lbf·sⁿ/100 ft² (Eq 24). */
  k: number;
  /** Power-law index from R600/R300, used only in the turbulent constants (Eqs 81-82). */
  np: number;
}

export const DEFAULT_TRIP_SPEEDS = [40, 80, 100, 150, 200, 250, 300];
export const DEFAULT_CLINGING = 0.45;

export type DepthKey = "anchor" | "shoe" | "bit";

/** Six Fann readings plus the geometry this module is allowed to see. Pipe is closed unless `pipeEnd` is `"open"`. */
export interface Rp13dInputs {
  fann600: number;
  fann300: number;
  fann200: number;
  fann100: number;
  fann6: number;
  fann3: number;
  /** Mud weight, ppg. */
  mw: number;
  /** Circulation rate, gpm. */
  flowGpm: number;
  /** Circulating surface backpressure, psi. Defaults to 0. */
  circSbp?: number;
  /** Connection backpressure used on the swab/surge EMW, psi. Defaults to 0. */
  sbpConnection?: number;
  /** Defaults to closed. */
  pipeEnd?: "closed" | "open";
  clinging?: number;
  eccentricity?: number;
  pipeOd: number;
  pipeId: number;
  casingId: number;
  casingMd: number;
  casingTvd: number;
  openHoleDia: number;
  anchorMd: number;
  anchorTvd: number;
  bitMd: number;
  bitTvd: number;
  tripSpeeds?: number[];
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Fann 35 shear rate, s⁻¹. 300 rpm is 511 s⁻¹, the same base Eq 24 uses. */
const SHEAR_RATE: Record<keyof Rheology, number> = {
  r600: 1022,
  r300: 511,
  r200: (511 * 200) / 300,
  r100: (511 * 100) / 300,
  r6: (511 * 6) / 300,
  r3: (511 * 3) / 300,
};

/** Yield stress from the 6 and 3 rpm readings (low-shear yield point). */
export function yieldStress(rh: Pick<Rheology, "r6" | "r3">): number {
  return Math.max(0, 2 * rh.r3 - rh.r6);
}

/**
 * Herschel-Bulkley fit of all six dial readings.
 * τy comes from 6 and 3 rpm. n and K are the least-squares line of
 * log(τ − τy) against log(shear rate) through every reading.
 */
export function hbParams(rh: Rheology): HbParams {
  const ty = yieldStress(rh);
  let count = 0;
  let xSum = 0;
  let ySum = 0;
  let xx = 0;
  let xy = 0;
  for (const key of Object.keys(SHEAR_RATE) as (keyof Rheology)[]) {
    const excess = rh[key] - ty;
    const gamma = SHEAR_RATE[key];
    if (!(excess > 0) || !(gamma > 0)) continue;
    const x = Math.log(gamma);
    const y = Math.log(excess);
    count += 1;
    xSum += x;
    ySum += y;
    xx += x * x;
    xy += x * y;
  }
  const denom = count * xx - xSum * xSum;
  const n = count >= 2 && denom !== 0 ? (count * xy - xSum * ySum) / denom : Number.NaN;
  const k = count >= 2 && Number.isFinite(n) ? Math.exp((ySum - n * xSum) / count) : Number.NaN;
  const np = 3.32 * Math.log10(rh.r600 / rh.r300);
  return { ty, n, k, np };
}

const FANN_ORDER = ["fann600", "fann300", "fann200", "fann100", "fann6", "fann3"] as const;

/** 600 ≥ 300 ≥ 200 ≥ 100 ≥ 6 ≥ 3. Missing numbers are not in order. */
export function fannInOrder(inputs: Pick<Rp13dInputs, (typeof FANN_ORDER)[number]>): boolean {
  const dials = FANN_ORDER.map((key) => inputs[key]);
  if (!dials.every(finite)) return false;
  for (let i = 1; i < dials.length; i++) {
    if (!(dials[i - 1] >= dials[i])) return false;
  }
  return true;
}

/** All six dial readings, in decreasing order, each above τy so the curve fit uses it. */
export function rheologyFrom(inputs: Pick<Rp13dInputs, "fann600" | "fann300" | "fann200" | "fann100" | "fann6" | "fann3">): Rheology | null {
  const r: Rheology = {
    r600: inputs.fann600,
    r300: inputs.fann300,
    r200: inputs.fann200,
    r100: inputs.fann100,
    r6: inputs.fann6,
    r3: inputs.fann3,
  };
  if (!fannInOrder(inputs)) return null;
  const ty = yieldStress(r);
  if (![r.r600, r.r300, r.r200, r.r100, r.r6, r.r3].every((tau) => tau > ty)) return null;
  const fit = hbParams(r);
  if (![fit.n, fit.k].every(finite)) return null;
  return r;
}

/** Eccentricity ratio, Eqs 87 (laminar) / 88 (turbulent). */
export function eccentricityRatio(e: number, n: number, r: number, laminar: boolean): number {
  if (!(e > 0)) return 1;
  const sn = Math.sqrt(n);
  return laminar
    ? 1 - 0.072 * (e / n) * r ** 0.8454 - 1.5 * e * e * sn * r ** 0.1852 + 0.96 * e ** 3 * sn * r ** 0.2527
    : 1 - 0.048 * (e / n) * r ** 0.8454 - (2 / 3) * e * e * sn * r ** 0.1852 + 0.285 * e ** 3 * sn * r ** 0.2527;
}

export interface SegmentResult {
  p: number;
  f: number;
  nRe: number;
  ncRe: number;
  laminar: boolean;
  tw: number;
}

/** Frictional ΔP for one pipe (annulus=false, dh = ID) or annulus segment. Eqs 60-86. */
export function segmentDp(
  rho: number,
  v: number,
  dh: number,
  dp: number,
  length: number,
  hb: HbParams,
  annulus: boolean,
  e = 0,
): SegmentResult {
  const { ty, n, k, np } = hb;
  const zero = { p: 0, f: 0, nRe: 0, ncRe: 3470 - 1370 * n, laminar: true, tw: 0 };
  if (!(v > 0) || !(length > 0)) return zero;
  const a = annulus ? 1 : 0;
  const dhyd = annulus ? dh - dp : dh; // Eq 60/61
  const ba = (((3 - a) * n + 1) / ((4 - a) * n)) * (1 + a / 2); // Eq 63, Gf≈Ba
  const gw = (1.6 * ba * v) / dhyd; // Eq 66
  const tw = 1.067 * (((4 - a) / (3 - a)) ** n * ty + k * gw ** n); // Eq 67/68
  const nRe = (rho * v * v) / (19.36 * tw); // Eq 69
  const ncRe = 3470 - 1370 * n; // Eq 70
  const fLam = 16 / nRe; // Eq 78
  const fTrans = (16 * nRe) / (ncRe * ncRe); // Eq 79
  const A = (Math.log10(np) + 3.93) / 50; // Eq 81 (power-law np)
  const B = (1.75 - Math.log10(np)) / 7; // Eq 82
  const fTurb = A / nRe ** B; // Eq 80
  const fInt = (fTrans ** -8 + fTurb ** -8) ** (-1 / 8); // Eq 84
  const f = (fInt ** 12 + fLam ** 12) ** (1 / 12); // Eq 83
  const laminar = nRe < ncRe;
  let p = (1.076 * rho * v * v * f * length) / (1e5 * dhyd); // Eq 85/86
  if (annulus) p *= eccentricityRatio(e, n, dp / dh, laminar);
  return { p, f, nRe, ncRe, laminar, tw };
}

export const vel = (q: number, dh: number, dp = 0) => (24.51 * q) / (dh * dh - dp * dp); // Eq 58/59
export const ecd = (esd: number, pa: number, tvd: number, sbp = 0, pcl = 0) =>
  esd + (pa + pcl + sbp) / (0.052 * tvd); // Eq 98
export const veffClosed = (vds: number, dh: number, dp: number, cg = DEFAULT_CLINGING) =>
  (cg + (dp * dp) / (dh * dh - dp * dp)) * vds; // Eq 100
export const veffOpen = (vds: number, dh: number, dp: number, di: number, cg = DEFAULT_CLINGING) =>
  (cg + (dp * dp - di * di) / (dh * dh - dp * dp + di * di)) * vds; // Eq 101

export interface AnnulusSection {
  topMd: number;
  botMd: number;
  /** Hole / casing ID, in. */
  dh: number;
  /** String OD, in. Uniform. No collar or BHA. */
  dp: number;
  /** String ID, in. */
  di: number;
}

/** Casing ID above the shoe, open hole below it, one string OD. */
export function annulusSections(inputs: Rp13dInputs, bitMd: number): AnnulusSection[] {
  const dp = inputs.pipeOd;
  const di = inputs.pipeId;
  const oh = inputs.openHoleDia;
  const shoe = inputs.casingMd;
  const csg = inputs.casingId;
  if (![dp, di, oh, shoe, csg, bitMd].every(finite) || bitMd <= 0) return [];
  const cuts = [
    { top: 0, bot: shoe, dh: csg },
    { top: shoe, bot: Number.POSITIVE_INFINITY, dh: oh },
  ];
  return cuts
    .map((c) => ({ topMd: c.top, botMd: Math.min(c.bot, bitMd), dh: c.dh, dp, di }))
    .filter((s) => s.botMd > s.topMd && s.dh > s.dp);
}

/** Annular ΔP from surface down to `poiMd`, each section at its own velocity. */
export function annularFrictionTo(
  sections: AnnulusSection[],
  poiMd: number,
  rho: number,
  rh: Rheology,
  velocity: (s: AnnulusSection) => number,
  e = 0,
): { p: number; sections: (AnnulusSection & SegmentResult & { v: number })[] } {
  const hb = hbParams(rh);
  let p = 0;
  const out: (AnnulusSection & SegmentResult & { v: number })[] = [];
  for (const s of sections) {
    const bot = Math.min(s.botMd, poiMd);
    if (bot <= s.topMd) continue;
    const v = velocity(s);
    const r = segmentDp(rho, Math.abs(v), s.dh, s.dp, bot - s.topMd, hb, true, e);
    p += r.p;
    out.push({ ...s, botMd: bot, ...r, v });
  }
  return { p, sections: out };
}

export interface Poi {
  depth: DepthKey;
  label: string;
  md: number;
  tvd: number;
}

export const BIT_TVD_NOT_IN_SHEET = "bit TVD not in sheet paste";

export interface EcdPoint extends Poi {
  pa: number;
  esd: number;
  ecd: number;
  laminar: boolean;
  /** Set when this depth cannot be calculated. The bit uses `BIT_TVD_NOT_IN_SHEET`. */
  reason?: string | null;
}

export interface TripPoint extends Poi {
  swabPsi: number;
  surgePsi: number;
  swabEmw: number;
  surgeEmw: number;
}

export interface TripRow {
  speed: number;
  points: TripPoint[];
}

export interface Rp13dResult {
  available: boolean;
  reason: string | null;
  hb: HbParams | null;
  flowRate: number;
  circSbp: number;
  pipeEnd: "closed" | "open";
  clinging: number;
  eccentricity: number;
  pois: Poi[];
  ecd: EcdPoint[];
  pipeFriction: number;
  trips: TripRow[];
}

export function tripSpeeds(inputs: Rp13dInputs): number[] {
  const speeds = (inputs.tripSpeeds ?? []).filter((v) => finite(v) && v > 0);
  return speeds.length ? speeds : DEFAULT_TRIP_SPEEDS;
}

export function tripOptions(inputs: Rp13dInputs) {
  const cg = inputs.clinging;
  const e = inputs.eccentricity;
  return {
    pipeEnd: inputs.pipeEnd === "open" ? ("open" as const) : ("closed" as const),
    clinging: finite(cg) && cg >= 0 && cg <= 1 ? cg : DEFAULT_CLINGING,
    eccentricity: finite(e) && e > 0 && e <= 1 ? e : 0,
  };
}

/** Swab / surge ΔP (psi) from surface to `poiMd` at pipe speed `speed` (§8, pumps off). */
export function tripDp(inputs: Rp13dInputs, rh: Rheology, poiMd: number, speed: number, bitMd = poiMd): number {
  const { pipeEnd, clinging, eccentricity } = tripOptions(inputs);
  const secs = annulusSections(inputs, Math.max(bitMd, poiMd));
  const veff = (s: AnnulusSection) =>
    pipeEnd === "open" ? veffOpen(speed, s.dh, s.dp, s.di, clinging) : veffClosed(speed, s.dh, s.dp, clinging);
  return annularFrictionTo(secs, Math.min(poiMd, bitMd), inputs.mw, rh, veff, eccentricity).p;
}

export function pointsOfInterest(inputs: Rp13dInputs): Poi[] {
  const pois: Poi[] = [];
  const add = (depth: DepthKey, label: string, md: number, tvd: number) => {
    if (finite(md) && finite(tvd) && md > 0 && tvd > 0) pois.push({ depth, label, md, tvd });
  };
  add("anchor", "Anchor", inputs.anchorMd, inputs.anchorTvd);
  add("shoe", "Shoe", inputs.casingMd, inputs.casingTvd);
  add("bit", "Bit", inputs.bitMd, inputs.bitTvd);
  return pois;
}

export function calcRp13d(inputs: Rp13dInputs): Rp13dResult {
  return withMissingBitTvd(inputs, calcRp13dBody(inputs));
}

function withMissingBitTvd(inputs: Rp13dInputs, result: Rp13dResult): Rp13dResult {
  if (finite(inputs.bitTvd) && inputs.bitTvd > 0) return result;
  if (!finite(inputs.bitMd) || !(inputs.bitMd > 0)) return result;
  if (result.ecd.some((point) => point.depth === "bit" && point.reason === BIT_TVD_NOT_IN_SHEET)) return result;
  const bit: EcdPoint = {
    depth: "bit",
    label: "Bit",
    md: inputs.bitMd,
    tvd: Number.NaN,
    pa: Number.NaN,
    esd: Number.NaN,
    ecd: Number.NaN,
    laminar: false,
    reason: BIT_TVD_NOT_IN_SHEET,
  };
  return { ...result, ecd: [...result.ecd.filter((point) => point.depth !== "bit"), bit] };
}

function calcRp13dBody(inputs: Rp13dInputs): Rp13dResult {
  const rh = rheologyFrom(inputs);
  const rho = inputs.mw;
  const q = inputs.flowGpm;
  const sbp = finite(inputs.circSbp) ? inputs.circSbp : 0;
  const conn = finite(inputs.sbpConnection) ? inputs.sbpConnection : 0;
  const opts = tripOptions(inputs);
  const pois = pointsOfInterest(inputs);
  const base: Rp13dResult = {
    available: false,
    reason: null,
    hb: rh ? hbParams(rh) : null,
    flowRate: q,
    circSbp: sbp,
    ...opts,
    pois,
    ecd: [],
    pipeFriction: Number.NaN,
    trips: [],
  };
  if (!rh) {
    const dials = FANN_ORDER.map((key) => inputs[key]);
    if (!dials.every(finite)) {
      return {
        ...base,
        reason:
          "Enter all six Fann readings (600, 300, 200, 100, 6, 3). Each dial reading has to sit above the 6-and-3-rpm yield stress.",
      };
    }
    if (!fannInOrder(inputs)) {
      return { ...base, reason: "Fann readings must satisfy 600 ≥ 300 ≥ 200 ≥ 100 ≥ 6 ≥ 3." };
    }
    return {
      ...base,
      reason: "Each dial reading has to sit above the 6-and-3-rpm yield stress.",
    };
  }
  if (!finite(rho)) return { ...base, reason: "Enter mud weight." };
  const bit = finite(inputs.bitMd) && inputs.bitMd > 0 ? inputs.bitMd : Math.max(0, ...pois.map((p) => p.md));
  const secs = annulusSections(inputs, bit);
  if (!secs.length) return { ...base, reason: "Geometry incomplete (pipe OD/ID, casing ID and shoe, open hole, bit)." };

  const e = opts.eccentricity;
  const ecdPts: EcdPoint[] =
    finite(q) && q > 0
      ? pois.map((poi) => {
          const r = annularFrictionTo(secs, poi.md, rho, rh, (s) => vel(q, s.dh, s.dp), e);
          return {
            ...poi,
            pa: r.p,
            esd: rho,
            ecd: ecd(rho, r.p, poi.tvd, sbp),
            laminar: r.sections.every((s) => s.laminar),
          };
        })
      : [];
  const di = inputs.pipeId;
  const pipeFriction =
    finite(q) && q > 0 && di > 0 && base.hb ? segmentDp(rho, vel(q, di), di, 0, bit, base.hb, false).p : Number.NaN;

  const trips: TripRow[] = tripSpeeds(inputs).map((speed) => ({
    speed,
    points: pois.map((poi) => {
      const dP = tripDp(inputs, rh, poi.md, speed, bit);
      const g = 0.052 * poi.tvd;
      return {
        ...poi,
        swabPsi: dP,
        surgePsi: dP,
        swabEmw: rho + (conn - dP) / g,
        surgeEmw: rho + (conn + dP) / g,
      };
    }),
  }));
  return { ...base, available: true, ecd: ecdPts, pipeFriction, trips };
}
