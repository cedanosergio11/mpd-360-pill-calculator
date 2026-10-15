/**
 * Display strings only. These functions do not round, write, or replace engine values.
 * KMW uses the same ceiling as `ceilingMath(ppg, 0.1)` in the KPI result's `rounded_ppg`.
 */

import { ceilingMath } from "@/lib/utils";

const EM_DASH = "\u2014";
const EN_DASH = "\u2013";

function finite(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

function grouped(value: number): string {
  const normalized = value === 0 ? 0 : value;
  const sign = normalized < 0 ? "-" : "";
  const body = String(Math.abs(Math.trunc(normalized))).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return sign + body;
}

function fixed(value: number, digits: number): string {
  const text = value.toFixed(digits);
  return Number(text) === 0 ? (0).toFixed(digits) : text;
}

function roundTo(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  return rounded === 0 ? 0 : rounded;
}

/** Whole feet, thousands separator, with the unit. Nearest foot. */
export function fmtDepth(ft: number | null | undefined): string {
  if (!finite(ft)) return EM_DASH;
  return `${grouped(Math.round(ft))} ft`;
}

/**
 * Floor the start and ceil the end so the displayed span covers the interval.
 * An exact integer is unchanged. One unit at the end.
 */
export function fmtDepthRange(startFt: number | null | undefined, endFt: number | null | undefined): string {
  if (!finite(startFt) || !finite(endFt)) return EM_DASH;
  return `${grouped(Math.floor(startFt))}${EN_DASH}${grouped(Math.ceil(endFt))} ft`;
}

/** EMW to the nearest 0.01 ppg. */
export function fmtEmw(ppg: number | null | undefined): string {
  if (!finite(ppg)) return EM_DASH;
  return fixed(roundTo(ppg, 0.01), 2);
}

/** KMW ceiled to the next 0.1 ppg. An exact tenth stays put. */
export function fmtKmw(ppg: number | null | undefined): string {
  if (!finite(ppg)) return EM_DASH;
  return fixed(ceilingMath(ppg, 0.1), 1);
}

/** Pressure to the nearest whole psi. */
export function fmtPsi(psi: number | null | undefined): string {
  if (!finite(psi)) return EM_DASH;
  return grouped(Math.round(psi));
}

/** Volume to the nearest 0.1 bbl. */
export function fmtBbl(bbl: number | null | undefined): string {
  if (!finite(bbl)) return EM_DASH;
  return fixed(roundTo(bbl, 0.1), 1);
}

/** Whole strokes, thousands separator, with the unit. */
export function fmtStrokes(strokes: number | null | undefined): string {
  if (!finite(strokes)) return EM_DASH;
  return `${grouped(Math.round(strokes))} stk`;
}

/** Minutes to the nearest 0.1. */
export function fmtMin(min: number | null | undefined): string {
  if (!finite(min)) return EM_DASH;
  return `${fixed(roundTo(min, 0.1), 1)} min`;
}

/** Pump output to 4 decimals. */
export function fmtBblPerStk(bblPerStk: number | null | undefined): string {
  if (!finite(bblPerStk)) return EM_DASH;
  return `${fixed(roundTo(bblPerStk, 0.0001), 4)} bbl/stk`;
}

/** Diameter to 3 decimals. */
export function fmtIn(inches: number | null | undefined): string {
  if (!finite(inches)) return EM_DASH;
  return `${fixed(roundTo(inches, 0.001), 3)} in`;
}
