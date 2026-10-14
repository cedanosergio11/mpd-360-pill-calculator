import type { ColumnSegment, Fluid, Job } from "./job.schema";
import { PSI_PER_PPG_FT } from "./result";
import { tvdAt } from "./tvd";

export interface FluidRef {
  fluid: Fluid;
  index: number;
}

export interface Span {
  topMd: number;
  bottomMd: number;
  fluidId: string;
}

export interface PillPlacement {
  surface: FluidRef;
  pill: Span | null;
  slug: Span | null;
  /** Deepest non-mud run contains more than one fluid id. */
  multiFluidPill: boolean;
  /** More than a slug plus a pill sit in the column. */
  extraRuns: boolean;
}

export function fluidById(job: Job, id: string): FluidRef | null {
  const index = job.fluids.findIndex((fluid) => fluid.id === id);
  if (index < 0) return null;
  return { fluid: job.fluids[index], index };
}

/** Fluid covering `md`. A shared boundary belongs to the deeper segment. */
export function fluidAt(job: Job, md: number): FluidRef | null {
  const segments = [...job.column].sort(
    (a, b) => a.topMd_ft - b.topMd_ft || a.bottomMd_ft - b.bottomMd_ft,
  );
  if (!segments.length) return null;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const last = i === segments.length - 1;
    const geTop = md >= segment.topMd_ft - 1e-6;
    const ltBottom = md < segment.bottomMd_ft - 1e-6;
    const onBottom = last && Math.abs(md - segment.bottomMd_ft) <= 1e-4;
    if (geTop && (ltBottom || onBottom)) return fluidById(job, segment.fluidId);
  }
  return null;
}

export function surfaceFluid(job: Job): FluidRef | null {
  return fluidAt(job, 0);
}

/**
 * Contiguous runs whose fluid is not the surface fluid.
 * The deepest run is the pill; the run above it, if any, is the slug.
 */
export function pillPlacement(job: Job): PillPlacement | null {
  const surface = surfaceFluid(job);
  if (!surface) return null;
  const segments = [...job.column].sort((a, b) => a.topMd_ft - b.topMd_ft);
  const runs: { top: number; bottom: number; ids: string[] }[] = [];
  for (const segment of segments) {
    if (segment.fluidId === surface.fluid.id) continue;
    const last = runs[runs.length - 1];
    if (last && segment.topMd_ft <= last.bottom + 0.1) {
      last.bottom = Math.max(last.bottom, segment.bottomMd_ft);
      if (!last.ids.includes(segment.fluidId)) last.ids.push(segment.fluidId);
    } else {
      runs.push({ top: segment.topMd_ft, bottom: segment.bottomMd_ft, ids: [segment.fluidId] });
    }
  }
  if (!runs.length) {
    return { surface, pill: null, slug: null, multiFluidPill: false, extraRuns: false };
  }
  const pillRun = runs[runs.length - 1];
  const slugRun = runs.length >= 2 ? runs[runs.length - 2] : null;
  return {
    surface,
    pill: {
      topMd: pillRun.top,
      bottomMd: pillRun.bottom,
      fluidId: pillRun.ids[pillRun.ids.length - 1],
    },
    slug: slugRun
      ? { topMd: slugRun.top, bottomMd: slugRun.bottom, fluidId: slugRun.ids[0] }
      : null,
    multiFluidPill: pillRun.ids.length > 1,
    extraRuns: runs.length > 2,
  };
}

/** Hydrostatic pressure from surface to `toMd`, psi gauge (no atmospheric). Null if the column has a hole. */
export function hydrostaticPsi(job: Job, toMd: number): number | null {
  if (!Number.isFinite(toMd) || toMd <= 0) return 0;
  const marks = [0, toMd];
  for (const segment of job.column) {
    if (segment.topMd_ft > 0 && segment.topMd_ft < toMd) marks.push(segment.topMd_ft);
    if (segment.bottomMd_ft > 0 && segment.bottomMd_ft < toMd) marks.push(segment.bottomMd_ft);
  }
  const pts = [...marks]
    .sort((a, b) => a - b)
    .filter((value, index, all) => index === 0 || value - all[index - 1] > 1e-4);
  let psi = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const fluid = fluidAt(job, (pts[i] + pts[i + 1]) / 2);
    if (!fluid || !Number.isFinite(fluid.fluid.density_ppg)) return null;
    const tvdA = tvdAt(job.well, pts[i]);
    const tvdB = tvdAt(job.well, pts[i + 1]);
    if (tvdA == null || tvdB == null) return null;
    if (tvdB < tvdA - 0.05) return null;
    psi += fluid.fluid.density_ppg * PSI_PER_PPG_FT * (tvdB - tvdA);
  }
  return psi;
}

/** ESD, ppg, of the fluid column at `md`. Null when TVD or the column cannot support it — never a fabricated 0. */
export function esdAtMd(job: Job, md: number): number | null {
  if (!(md > 0)) return null;
  const tvd = tvdAt(job.well, md);
  if (tvd == null || !(tvd > 0)) return null;
  const psi = hydrostaticPsi(job, md);
  if (psi == null) return null;
  return psi / (PSI_PER_PPG_FT * tvd);
}

/**
 * Pipe-out column with the pill top moved to `newTop` (RIH steel displacement).
 * Fluids below the pill base are kept. A slug above the pill is not shifted —
 * callers must not use this when a slug or a multi-fluid pill is present.
 */
export function columnWithRaisedPill(job: Job, pill: Span, newTop: number): Job {
  const surface = surfaceFluid(job);
  if (!surface) return job;
  const top = Math.max(0, Math.min(newTop, pill.bottomMd));
  const segs: ColumnSegment[] = [];
  if (top > 0.05) {
    segs.push({ fluidId: surface.fluid.id, topMd_ft: 0, bottomMd_ft: top });
  }
  segs.push({
    fluidId: pill.fluidId,
    topMd_ft: top > 0.05 ? top : 0,
    bottomMd_ft: pill.bottomMd,
  });
  let cursor = pill.bottomMd;
  const below = [...job.column]
    .filter((segment) => segment.bottomMd_ft > cursor + 1e-3)
    .sort((a, b) => a.topMd_ft - b.topMd_ft);
  for (const segment of below) {
    const segTop = Math.max(segment.topMd_ft, cursor);
    if (segment.bottomMd_ft > segTop + 1e-6) {
      segs.push({ fluidId: segment.fluidId, topMd_ft: segTop, bottomMd_ft: segment.bottomMd_ft });
      cursor = segment.bottomMd_ft;
    }
  }
  if (cursor < job.well.mdTd_ft - 0.05) {
    segs.push({ fluidId: surface.fluid.id, topMd_ft: cursor, bottomMd_ft: job.well.mdTd_ft });
  }
  return { ...job, column: segs };
}
