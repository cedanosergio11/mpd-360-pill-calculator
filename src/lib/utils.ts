import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function asNum(value: unknown): number {
  if (value === "" || value === null || value === undefined) return Number.NaN;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function safeDiv(a: number, b: number): number {
  return isNum(a) && isNum(b) && Math.abs(b) > 1e-12 ? a / b : Number.NaN;
}

export function round(value: number, digits = 0): number {
  if (!isNum(value)) return Number.NaN;
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Excel ROUNDUP for non-negative numbers. */
export function roundUp(value: number, digits = 0): number {
  if (!isNum(value)) return Number.NaN;
  const f = 10 ** digits;
  return Math.ceil(value * f - 1e-12) / f;
}

/** Excel CEILING.MATH(number, significance) for positive numbers. */
export function ceilingMath(value: number, significance = 1): number {
  if (!isNum(value) || !significance) return Number.NaN;
  return Math.ceil(value / significance - 1e-12) * significance;
}

export function floorTo(value: number, step: number): number {
  if (!isNum(value) || !step) return Number.NaN;
  return Math.floor(value / step + 1e-12) * step;
}

export function nonNegative(value: number): number {
  return isNum(value) ? Math.max(0, value) : Number.NaN;
}

export function capBblFt(idIn: number): number {
  return safeDiv(idIn ** 2, 1029.4);
}

export function annularBblFt(outerId: number, innerOd: number): number {
  return safeDiv(outerId ** 2 - innerOd ** 2, 1029.4);
}

export function formatNumber(value: number, digits = 1): string {
  if (!isNum(value)) return "—";
  const d = Math.abs(value) >= 100 && digits > 0 ? Math.min(digits, 1) : digits;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: d,
  });
}

export function formatExact(value: number, digits = 2): string {
  if (!isNum(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
