import { columnWithRaisedPill, esdAtMd, pillPlacement, type Span } from "./column";
import { balanceFloat, pipePillBbl } from "./equalize";
import { intervalVolume, uniqueSorted } from "./geometry";
import { issue, type Issue } from "./issues";
import type { Job } from "./job.schema";
import type { Displacement, DisplacementStage } from "./result";
import { PSI_PER_PPG_FT } from "./result";
import { resolvedAnchorTvd, tvdAt } from "./tvd";

function blankDisplacement(): Displacement {
  return {
    pillVolume_bbl: null,
    pillTopMd_ft: null,
    pillBottomMd_ft: null,
    pillTopTvd_ft: null,
    pillBottomTvd_ft: null,
    stages: [],
    minStagesRih: null,
  };
}

/**
 * Pill top after closed-end pipe is run to `bitMd`, conserving pipe-out pill volume.
 * Below the bit the pill sits in the open hole; around the pipe it sits in the annulus.
 * Base stays at the spotted pill bottom (RIH stops do not push the pill deeper than spot).
 */
export function raisedPillTop(
  job: Job,
  pill: Span,
  bitMd: number,
  pipeOutVolume: number,
): number | null {
  if (bitMd <= pill.topMd + 1e-3) return pill.topMd;
  const bit = Math.min(bitMd, pill.bottomMd);
  const volumeAt = (top: number): number | null => {
    const aroundPipe = intervalVolume(job.well, top, bit, "annular");
    const belowBit = intervalVolume(job.well, bit, pill.bottomMd, "full");
    if (aroundPipe == null || belowBit == null) return null;
    return aroundPipe + belowBit;
  };
  const atSpot = volumeAt(pill.topMd);
  const atSurface = volumeAt(0);
  if (atSpot == null || atSurface == null) return null;
  if (atSpot >= pipeOutVolume - 1e-3) return pill.topMd;
  if (atSurface < pipeOutVolume - 1e-3) return 0;
  let lo = 0;
  let hi = pill.topMd;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const volume = volumeAt(mid);
    if (volume == null) return null;
    if (volume > pipeOutVolume) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function sbpHold(job: Job, columnJob: Job): number | null {
  const anchorTvd = resolvedAnchorTvd(job.well);
  const esd = esdAtMd(columnJob, job.well.anchorMd_ft);
  if (esd == null || anchorTvd == null || !(anchorTvd > 0)) return null;
  return Math.max(0, (job.well.targetEmw_ppg - esd) * PSI_PER_PPG_FT * anchorTvd);
}

function stageFromColumn(job: Job, columnJob: Job, n: number, bitMd: number): DisplacementStage {
  return {
    n,
    bitMd_ft: bitMd,
    pumped_bbl: null,
    sbp_psi: sbpHold(job, columnJob),
    shoeEsd_ppg: esdAtMd(columnJob, job.well.shoeMd_ft),
    anchorEsd_ppg: esdAtMd(columnJob, job.well.anchorMd_ft),
    tdEsd_ppg: esdAtMd(columnJob, job.well.mdTd_ft),
  };
}

/** Surface, the bit at the pill top, and the bit at the pill base. */
function stageBits(pill: Span, bitMd: number): number[] {
  const end = Math.min(Math.max(bitMd, 0), pill.bottomMd);
  const top = Math.min(Math.max(pill.topMd, 0), end);
  return uniqueSorted([0, top, end], 0.5);
}

/**
 * RIH shoe ESD.
 * Dry pipe (noDP, or withDP with no pill in the string): closed pipe displaces
 * the pipe-out pill upward. withDP with pill in `pipeColumn`: the spot stage
 * is the float balance, not that dry-pipe displacement.
 */
function stagesFor(
  job: Job,
  pill: Span,
  volume: number,
  canShift: boolean,
  issues: Issue[],
): DisplacementStage[] {
  const bits = stageBits(pill, job.well.bitMd_ft);
  const utube = job.mode === "withDP" && pipePillBbl(job, pill.fluidId) > 0.05;
  const balance = utube ? balanceFloat(job) : null;
  if (utube && !balance) {
    issues.push(
      issue(
        "error",
        "EQUALIZE_PENDING",
        "withDP float U-tube could not be balanced from pipeColumn. Shoe ESD does not include pipe-side pill weight.",
        "pipeColumn",
      ),
    );
  }
  const stages: DisplacementStage[] = [];
  for (const bit of bits) {
    let columnJob: Job | null = null;
    if (utube) {
      columnJob = balance && bit >= pill.bottomMd - 0.5 ? balance.columnJob : job;
    } else if (!canShift) {
      columnJob = job;
    } else {
      const top = raisedPillTop(job, pill, bit, volume);
      if (top == null) {
        issues.push(
          issue(
            "error",
            "GEOMETRY",
            "Could not place the pill around the pipe for shoe ESD.",
            "well.stringOd_in",
          ),
        );
        break;
      }
      columnJob = columnWithRaisedPill(job, pill, top);
    }
    stages.push(stageFromColumn(job, columnJob, stages.length + 1, bit));
  }
  return stages;
}

/**
 * Displacement from the annulus column.
 * `pumped_bbl` and slug movement are release blockers: the barrels stay null
 * and a slug column is not shifted.
 */
export function buildDisplacement(job: Job, issues: Issue[]): Displacement {
  const place = pillPlacement(job);
  if (!place?.pill) {
    issues.push(
      issue(
        "warn",
        "NO_PILL",
        "No pill interval in the fluid column (every segment is the surface fluid).",
        "column",
      ),
    );
    return blankDisplacement();
  }

  const pill = place.pill;
  const volume = intervalVolume(job.well, pill.topMd, pill.bottomMd, "full");
  const displacement: Displacement = {
    pillVolume_bbl: volume,
    pillTopMd_ft: pill.topMd,
    pillBottomMd_ft: pill.bottomMd,
    pillTopTvd_ft: tvdAt(job.well, pill.topMd),
    pillBottomTvd_ft: tvdAt(job.well, pill.bottomMd),
    stages: [],
    minStagesRih: null,
  };
  if (place.slug) {
    const slugVolume = intervalVolume(job.well, place.slug.topMd, place.slug.bottomMd, "full");
    if (slugVolume != null) displacement.slugVolume_bbl = slugVolume;
  }
  if (volume == null) {
    issues.push(
      issue(
        "error",
        "GEOMETRY",
        "Pill volume needs a hole ID larger than the string along the pill.",
        "well.casing",
      ),
    );
    return displacement;
  }

  const canShift = !place.multiFluidPill && !place.slug && !place.extraRuns;
  if (!canShift) {
    issues.push(
      issue(
        "error",
        "RELEASE_BLOCKER",
        "Release blocker: slug column shift is not implemented. A slug or multi-fluid column is not moved when the pipe is run in.",
        "column",
      ),
    );
  }

  const stages = stagesFor(job, pill, volume, canShift, issues);
  displacement.stages = stages;
  displacement.minStagesRih = stages.length > 0 ? stages.length : null;
  if (stages.length > 0) {
    issues.push(
      issue(
        "error",
        "RELEASE_BLOCKER",
        "Release blocker: pumped_bbl is not implemented. Circulated volume per RIH stage stays null.",
        "displacement.stages",
      ),
    );
  }

  if (job.mode === "withDP" && pipePillBbl(job, pill.fluidId) > 0.05) {
    const balance = balanceFloat(job);
    if (balance) {
      displacement.pillTopMd_ft = balance.pillTopMd_ft;
      displacement.pillTopTvd_ft = balance.pillTopTvd_ft;
    }
  }
  return displacement;
}
