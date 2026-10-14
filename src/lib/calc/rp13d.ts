/**
 * API RP 13D (7th ed., 2017, reaffirmed 2023) Herschel-Bulkley hydraulics, ECD and swab/surge.
 * USC units: Q gpm, d in, V ft/min, rho ppg, tau / Fann dial lbf/100 ft², L ft, P psi.
 * Steady-state, isothermal (surface rheology and density), concentric unless e > 0,
 * non-rotating, no tool joints, uniform string OD (no BHA). See §7.4, §7.9, §8.
 */
import { asNum, isNum } from "@/lib/utils";
import type { WellInputs } from "./types";

export interface Rheology {
  r600: number;
  r300: number;
  r6: number;
  r3: number;
  r200?: number;
  r100?: number;
  gel10?: number;
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

export function rheologyFrom(inputs: WellInputs): Rheology | null {
  const r = {
    r600: asNum(inputs.fann600),
    r300: asNum(inputs.fann300),
    r6: asNum(inputs.fann6),
    r3: asNum(inputs.fann3),
  };
  if (![r.r600, r.r300, r.r6, r.r3].every(isNum)) return null;
  if (!(r.r600 > r.r300 && r.r300 > 0 && r.r6 >= r.r3 && r.r3 >= 0)) return null;
  const ty = Math.max(0, 2 * r.r3 - r.r6);
  if (ty >= r.r300) return null;
  return {
    ...r,
    r200: isNum(asNum(inputs.fann200)) ? asNum(inputs.fann200) : undefined,
    r100: isNum(asNum(inputs.fann100)) ? asNum(inputs.fann100) : undefined,
    gel10: isNum(asNum(inputs.gel10)) ? asNum(inputs.gel10) : undefined,
  };
}

export function hbParams(rh: Rheology): HbParams {
  const ty = Math.max(0, 2 * rh.r3 - rh.r6); // Eq 25
  const n = 3.32 * Math.log10((rh.r600 - ty) / (rh.r300 - ty)); // Eq 23
  const k = (rh.r300 - ty) / Math.pow(511, n); // Eq 24
  const np = 3.32 * Math.log10(rh.r600 / rh.r300);
  return { ty, n, k, np };
}

/** Eccentricity ratio, Eqs 87 (laminar) / 88 (turbulent); verified against RP p.37. */
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
  rh: Rheology,
  annulus: boolean,
  e = 0,
): SegmentResult {
  const { ty, n, k, np } = hbParams(rh);
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
  /** String OD, in. */
  dp: number;
  /** String ID, in. */
  di: number;
}

/** Annulus sections from surface to `bitMd` using the existing PillView geometry (uniform string OD). */
export function annulusSections(inputs: WellInputs, bitMd: number): AnnulusSection[] {
  const dp = asNum(inputs.odDp);
  const di = asNum(inputs.idDp);
  const oh = asNum(inputs.openHoleDia);
  const shoe = asNum(inputs.casingMd);
  const csg = asNum(inputs.idCasing);
  if (![dp, di, oh, shoe, csg, bitMd].every(isNum) || bitMd <= 0) return [];
  const cuts: { top: number; bot: number; dh: number }[] = [];
  const hanger = asNum(inputs.linerHangerMd);
  const linerShoe = asNum(inputs.linerShoeMd);
  const linerId = asNum(inputs.linerId);
  if (inputs.taperedOn && [hanger, linerShoe, linerId].every(isNum) && linerShoe > hanger) {
    const upper = isNum(asNum(inputs.casingIdLarger)) ? asNum(inputs.casingIdLarger) : csg;
    cuts.push({ top: 0, bot: hanger, dh: upper }, { top: hanger, bot: linerShoe, dh: linerId });
    cuts.push({ top: linerShoe, bot: Infinity, dh: oh });
  } else {
    cuts.push({ top: 0, bot: shoe, dh: csg }, { top: shoe, bot: Infinity, dh: oh });
  }
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
  let p = 0;
  const out: (AnnulusSection & SegmentResult & { v: number })[] = [];
  for (const s of sections) {
    const bot = Math.min(s.botMd, poiMd);
    if (bot <= s.topMd) continue;
    const v = velocity(s);
    const r = segmentDp(rho, Math.abs(v), s.dh, s.dp, bot - s.topMd, rh, true, e);
    p += r.p;
    out.push({ ...s, botMd: bot, ...r, v });
  }
  return { p, sections: out };
}

export type PoiKey = "anchor" | "shoe" | "td";
export interface Poi {
  key: PoiKey;
  label: string;
  md: number;
  tvd: number;
}

export interface EcdPoint extends Poi {
  pa: number;
  esd: number;
  ecd: number;
  laminar: boolean;
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

export interface Rp13dResults {
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

export function tripSpeeds(inputs: WellInputs): number[] {
  const s = (inputs.tripSpeeds ?? []).filter((v) => isNum(v) && v > 0);
  return s.length ? s : DEFAULT_TRIP_SPEEDS;
}

export function tripOptions(inputs: WellInputs) {
  const cg = asNum(inputs.clingingFactor);
  const e = asNum(inputs.eccentricity);
  return {
    pipeEnd: inputs.pipeEnd === "open" ? ("open" as const) : ("closed" as const),
    clinging: isNum(cg) && cg >= 0 && cg <= 1 ? cg : DEFAULT_CLINGING,
    eccentricity: isNum(e) && e > 0 && e <= 1 ? e : 0,
  };
}

/** Swab / surge ΔP (psi) from surface to `poiMd` at max pipe speed `speed` (§8, pumps off). */
export function tripDp(inputs: WellInputs, rh: Rheology, poiMd: number, speed: number, bitMd = poiMd): number {
  const rho = asNum(inputs.currentMw);
  const { pipeEnd, clinging, eccentricity } = tripOptions(inputs);
  const secs = annulusSections(inputs, Math.max(bitMd, poiMd));
  const veff = (s: AnnulusSection) =>
    pipeEnd === "open" ? veffOpen(speed, s.dh, s.dp, s.di, clinging) : veffClosed(speed, s.dh, s.dp, clinging);
  return annularFrictionTo(secs, Math.min(poiMd, bitMd), rho, rh, veff, eccentricity).p;
}

export function pointsOfInterest(inputs: WellInputs): Poi[] {
  const pois: Poi[] = [];
  const add = (key: PoiKey, label: string, md: number, tvd: number) => {
    if (isNum(md) && isNum(tvd) && md > 0 && tvd > 0) pois.push({ key, label, md, tvd });
  };
  add("shoe", "Shoe", asNum(inputs.casingMd), asNum(inputs.casingTvd));
  add("anchor", "Anchor", asNum(inputs.anchorMd), asNum(inputs.anchorTvd));
  add("td", "Bit / TD", asNum(inputs.currentDepthMd), asNum(inputs.currentDepthTvd));
  return pois;
}

export function calcRp13d(inputs: WellInputs): Rp13dResults {
  const rh = rheologyFrom(inputs);
  const rho = asNum(inputs.currentMw);
  const q = asNum(inputs.maxFlowRate);
  const sbp = isNum(asNum(inputs.circSbp)) ? asNum(inputs.circSbp) : 0;
  const conn = isNum(asNum(inputs.sbpConnection)) ? asNum(inputs.sbpConnection) : 0;
  const opts = tripOptions(inputs);
  const pois = pointsOfInterest(inputs);
  const base: Rp13dResults = {
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
  if (!rh) return { ...base, reason: "Enter Fann 600/300/6/3 readings (600 > 300, 6 ≥ 3) for API RP 13D swab/surge and ECD." };
  if (!isNum(rho)) return { ...base, reason: "Enter current MW." };
  const bit = Math.max(asNum(inputs.currentDepthMd) || 0, ...pois.map((p) => p.md));
  const secs = annulusSections(inputs, bit);
  if (!secs.length) return { ...base, reason: "Geometry incomplete (OD/ID DP, casing ID/MD, open hole)." };

  const e = opts.eccentricity;
  const ecdPts: EcdPoint[] = isNum(q) && q > 0
    ? pois.map((poi) => {
        const r = annularFrictionTo(secs, poi.md, rho, rh, (s) => vel(q, s.dh, s.dp), e);
        return { ...poi, pa: r.p, esd: rho, ecd: ecd(rho, r.p, poi.tvd, sbp), laminar: r.sections.every((s) => s.laminar) };
      })
    : [];
  const di = asNum(inputs.idDp);
  const pipeFriction = isNum(q) && q > 0 && di > 0 ? segmentDp(rho, vel(q, di), di, 0, bit, rh, false).p : Number.NaN;

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
