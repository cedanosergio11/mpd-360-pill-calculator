import { annularBblFt, capBblFt } from "@/lib/utils";
import type { Well } from "./job.schema";

/** Collapse near-duplicate measured depths, preserving order. */
export function uniqueSorted(values: number[], eps = 1e-3): number[] {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const out: number[] = [];
  for (const value of sorted) {
    if (!out.length || value - out[out.length - 1] > eps) out.push(value);
  }
  return out;
}

/**
 * Hole ID at a measured depth. Overlapping casing / liner intervals use the
 * innermost (smallest) ID. Below the shoe, open hole.
 */
export function holeIdAt(well: Well, md: number): number | null {
  let id: number | null = null;
  for (const interval of well.casing) {
    if (md >= interval.topMd_ft - 1e-6 && md <= interval.bottomMd_ft + 1e-6) {
      id = id == null ? interval.id_in : Math.min(id, interval.id_in);
    }
  }
  if (id != null && id > 0) return id;
  const deepest = well.casing.reduce(
    (max, interval) => Math.max(max, interval.bottomMd_ft),
    well.shoeMd_ft,
  );
  if (md >= deepest - 1e-6 && well.openHoleId_in > 0) return well.openHoleId_in;
  return null;
}

function breaksBetween(well: Well, from: number, to: number): number[] {
  const marks = [from, to, well.shoeMd_ft];
  for (const interval of well.casing) {
    marks.push(interval.topMd_ft, interval.bottomMd_ft);
  }
  return uniqueSorted(
    marks.filter((mark) => mark > from + 1e-6 && mark < to - 1e-6).concat([from, to]),
    1e-4,
  );
}

/** Barrel capacity of an MD interval. `full` is pipe-out; `annular` is around the string. */
export function intervalVolume(
  well: Well,
  from: number,
  to: number,
  kind: "full" | "annular",
): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (to <= from + 1e-6) return 0;
  const pts = breaksBetween(well, from, to);
  let volume = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const mid = (pts[i] + pts[i + 1]) / 2;
    const id = holeIdAt(well, mid);
    if (id == null) return null;
    const cap = kind === "full" ? capBblFt(id) : annularBblFt(id, well.stringOd_in);
    if (!Number.isFinite(cap) || cap <= 0) return null;
    volume += cap * (pts[i + 1] - pts[i]);
  }
  return volume;
}
