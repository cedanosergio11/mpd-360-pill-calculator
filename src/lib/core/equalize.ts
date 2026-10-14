import { capBblFt } from "@/lib/utils";
import { columnWithRaisedPill, esdAtMd, pillPlacement, type Span } from "./column";
import { intervalVolume } from "./geometry";
import type { Job } from "./job.schema";
import { PSI_PER_PPG_FT } from "./result";
import { tvdAt } from "./tvd";

export interface FloatBalance {
  dumpBbl: number;
  pillTopMd_ft: number;
  pillTopTvd_ft: number;
  /** Gauge pressure at the bit after balance, psi. Atmospheric cancels on both sides. */
  bitPsi: number;
  shoeEsd_ppg: number;
  columnJob: Job;
}

/** Barrel of `fluidId` inside the string. */
export function pipePillBbl(job: Job, fluidId: string): number {
  const bore = capBblFt(job.well.stringId_in);
  if (!(bore > 0)) return 0;
  let volume = 0;
  for (const segment of job.pipeColumn ?? []) {
    if (segment.fluidId !== fluidId) continue;
    const length = segment.bottomMd_ft - segment.topMd_ft;
    if (length > 0) volume += bore * length;
  }
  return volume;
}

function chaseBbl(job: Job, mudId: string, pillFluidId: string): number {
  const bore = capBblFt(job.well.stringId_in);
  if (!(bore > 0)) return 0;
  let pillTop = Number.POSITIVE_INFINITY;
  for (const segment of job.pipeColumn ?? []) {
    if (segment.fluidId === pillFluidId) pillTop = Math.min(pillTop, segment.topMd_ft);
  }
  let volume = 0;
  for (const segment of job.pipeColumn ?? []) {
    if (segment.fluidId !== mudId) continue;
    if (!(segment.bottomMd_ft <= pillTop + 0.2)) continue;
    const length = segment.bottomMd_ft - segment.topMd_ft;
    if (length > 0) volume += bore * length;
  }
  return volume;
}

/** Shallowest MD whose annular capacity down to `bottom` holds `volume` bbl. */
export function annularTopForVolume(job: Job, bottom: number, volume: number): number | null {
  if (!(bottom > 0) || !(volume >= 0)) return null;
  const held = (top: number) => intervalVolume(job.well, top, bottom, "annular");
  const toSurface = held(0);
  if (toSurface == null) return null;
  if (toSurface <= volume + 1e-4) return 0;
  let lo = 0;
  let hi = bottom;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const got = held(mid);
    if (got == null) return null;
    if (got > volume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function tvdExt(job: Job, md: number): number | null {
  if (md >= 0) return tvdAt(job.well, md);
  const ref = tvdAt(job.well, 100);
  if (ref == null) return null;
  return (md / 100) * ref;
}

function pipeGauge(
  job: Job,
  bitMd: number,
  kmwVol: number,
  chaseVol: number,
  kmw: number,
  mw: number,
): number | null {
  const bore = capBblFt(job.well.stringId_in);
  if (!(bore > 0)) return null;
  const kmwTop = bitMd - Math.max(0, kmwVol) / bore;
  const chaseTop = kmwTop - Math.max(0, chaseVol) / bore;
  const bitTvd = tvdAt(job.well, bitMd);
  const kmwTopTvd = tvdExt(job, kmwTop);
  const chaseTopTvd = tvdExt(job, chaseTop);
  if (bitTvd == null || kmwTopTvd == null || chaseTopTvd == null) return null;
  return (
    mw * PSI_PER_PPG_FT * (kmwTopTvd - chaseTopTvd) + kmw * PSI_PER_PPG_FT * (bitTvd - kmwTopTvd)
  );
}

function annulusGauge(
  job: Job,
  bitMd: number,
  topMd: number,
  kmw: number,
  mw: number,
): number | null {
  const bitTvd = tvdAt(job.well, bitMd);
  const topTvd = tvdAt(job.well, topMd);
  if (bitTvd == null || topTvd == null) return null;
  return mw * PSI_PER_PPG_FT * topTvd + kmw * PSI_PER_PPG_FT * (bitTvd - topTvd);
}

/**
 * Float U-tube. Pipe-side pill and the mud chase above it balance against the
 * annular pill. Dumped pill lengthens the annulus; an air cap is whatever
 * pipe capacity that dump leaves at atmospheric pressure.
 * Returns null when the pipe holds no pill or the geometry cannot be placed.
 */
export function balanceFloat(job: Job): FloatBalance | null {
  const place = pillPlacement(job);
  if (!place?.pill) return null;
  const pill: Span = place.pill;
  const mud = place.surface.fluid;
  const pillFluid = job.fluids.find((fluid) => fluid.id === pill.fluidId);
  if (!pillFluid) return null;
  const kmwVol = pipePillBbl(job, pill.fluidId);
  if (!(kmwVol > 0.05)) return null;
  const chaseVol = chaseBbl(job, mud.id, pill.fluidId);
  const annularVol = intervalVolume(job.well, pill.topMd, pill.bottomMd, "annular");
  if (annularVol == null) return null;
  const bitMd = pill.bottomMd;
  const kmw = pillFluid.density_ppg;
  const mw = mud.density_ppg;

  const pressures = (dump: number) => {
    const top = annularTopForVolume(job, bitMd, annularVol + dump);
    if (top == null) return null;
    const pipe = pipeGauge(job, bitMd, kmwVol - dump, chaseVol, kmw, mw);
    const annulus = annulusGauge(job, bitMd, top, kmw, mw);
    if (pipe == null || annulus == null) return null;
    return { top, pipe, annulus };
  };

  let lo = 0;
  let hi = kmwVol;
  for (let i = 0; i < 60; i++) {
    const dump = (lo + hi) / 2;
    const state = pressures(dump);
    if (!state) return null;
    if (state.pipe > state.annulus) lo = dump;
    else hi = dump;
  }
  const dumpBbl = (lo + hi) / 2;
  const state = pressures(dumpBbl);
  if (!state) return null;
  const columnJob = columnWithRaisedPill(job, pill, state.top);
  const shoeEsd = esdAtMd(columnJob, job.well.shoeMd_ft);
  const topTvd = tvdAt(job.well, state.top);
  if (shoeEsd == null || topTvd == null) return null;
  return {
    dumpBbl,
    pillTopMd_ft: state.top,
    pillTopTvd_ft: topTvd,
    bitPsi: state.annulus,
    shoeEsd_ppg: shoeEsd,
    columnJob,
  };
}

/** Column used for static ESD. withDP uses the balanced annulus when the pipe holds pill. */
export function staticColumnJob(job: Job): Job {
  if (job.mode !== "withDP") return job;
  return balanceFloat(job)?.columnJob ?? job;
}
