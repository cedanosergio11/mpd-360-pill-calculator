/**
 * Number-only display wrappers over `@/lib/calc/format`. The rounding rule is
 * format.ts's; these only drop the unit suffix where the UI prints the unit itself.
 * Display only. Engine values stay full precision.
 */
import {
  fmtBbl,
  fmtBblPerStand,
  fmtBblPerStk,
  fmtDepth,
  fmtDepthRange,
  fmtEmw,
  fmtIn,
  fmtKmw,
  fmtMin,
  fmtPsi,
  fmtStrokes,
} from "@/lib/calc/format";

const strip = (text: string, unit: string) => (text.endsWith(` ${unit}`) ? text.slice(0, -(unit.length + 1)) : text);
type N = number | null | undefined;
const n = (v: unknown): N => (typeof v === "number" ? v : null);

export const dFt = (v: unknown) => strip(fmtDepth(n(v)), "ft");
export const dRange = (a: unknown, b: unknown) => strip(fmtDepthRange(n(a), n(b)), "ft");
export const dEmw = (v: unknown) => fmtEmw(n(v));
export const dKmw = (v: unknown) => fmtKmw(n(v));
export const dPsi = (v: unknown) => fmtPsi(n(v));
export const dBbl = (v: unknown) => fmtBbl(n(v));
export const dStk = (v: unknown) => strip(fmtStrokes(n(v)), "stk");
export const dMin = (v: unknown) => strip(fmtMin(n(v)), "min");
export const dBblStk = (v: unknown) => strip(fmtBblPerStk(n(v)), "bbl/stk");
export const dIn = (v: unknown) => strip(fmtIn(n(v)), "in");
export const dBblStand = (v: unknown) => fmtBblPerStand(n(v));

/**
 * Simulator panels: same format.ts rounding, with the unit suffix.
 * EMW to 0.01 ppg. Replaces `@/lib/pill/format` in the screens. Display only.
 */
export const ft = (v: unknown) => fmtDepth(n(v));
export const signedFt = (v: unknown) => {
  const x = n(v);
  const text = fmtDepth(x);
  return x != null && Math.round(x) > 0 ? `+${text}` : text;
};
export const bbl = (v: unknown) => `${fmtBbl(n(v))} bbl`;
export const ppg = (v: unknown) => `${fmtEmw(n(v))} ppg`;
export const ppg2 = ppg;
export const psi = (v: unknown) => `${fmtPsi(n(v))} psi`;
export const bblFt = (v: unknown) => {
  const x = n(v);
  return x != null && Number.isFinite(x) ? `${(Math.round(x * 10000) / 10000).toFixed(4)} bbl/ft` : "\u2014";
};
/** Axis tick labels only (chart scale, not results). */
export const tick0 = (v: number) => fmtPsi(v);
export const tick1 = (v: number) => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toFixed(1) : "\u2014");
