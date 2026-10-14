import { columnWithRaisedPill, esdAtMd, pillPlacement, type Span } from "./column";
import { intervalVolume } from "./geometry";
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

function staticStage(job: Job, pill: Span): DisplacementStage[] {
  return [stageFromColumn(job, job, 1, pill.bottomMd)];
}

/**
 * Closed-end RIH from the pill top toward the pill base. Shoe ESD at each
 * stop is the fluid column with the pill raised around the pipe — KMW counts
 * only where it stands above the shoe, so a pill that stays below the shoe
 * leaves shoe ESD at mud weight.
 */
function stagesRaised(job: Job, pill: Span, volume: number, issues: Issue[]): DisplacementStage[] {
  const base = pill.bottomMd;
  const fit = job.well.fit_ppg;
  let cursor = pill.topMd;
  const stages: DisplacementStage[] = [];

  const columnAt = (bit: number): Job | null => {
    const top = raisedPillTop(job, pill, bit, volume);
    if (top == null) return null;
    return columnWithRaisedPill(job, pill, top);
  };
  const shoeAt = (bit: number): number | null => {
    const column = columnAt(bit);
    return column ? esdAtMd(column, job.well.shoeMd_ft) : null;
  };

  for (let n = 1; n <= 8; n++) {
    const atBase = shoeAt(base);
    if (atBase == null) {
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
    let stop = base;
    if (atBase >= fit && cursor < base - 0.5) {
      let lo = cursor;
      let hi = base;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const esd = shoeAt(mid);
        if (esd == null || esd >= fit) hi = mid;
        else lo = mid;
      }
      stop = hi;
    }
    const column = columnAt(stop);
    if (!column) break;
    stages.push(stageFromColumn(job, column, n, stop));
    if (atBase < fit || stop >= base - 0.5 || stop <= cursor + 1) break;
    cursor = stop;
  }
  return stages;
}

function pillReachesShoe(job: Job, pill: Span, volume: number, canShift: boolean): boolean {
  if (pill.topMd < job.well.shoeMd_ft - 0.05) return true;
  if (!canShift) return false;
  const top = raisedPillTop(job, pill, pill.bottomMd, volume);
  return top != null && top < job.well.shoeMd_ft - 0.05;
}

/**
 * Displacement from the single fluid column.
 *
 * TODO(MPGenie): the full single-column model (pipe-side inventory, float
 * U-tube equalize psi, and circulated barrels per stage) is not in job v1.
 * `pumped_bbl` stays null. withDP shoe ESD uses the raised fluid column only;
 * no equalize psi is added when the pill never reaches the shoe.
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
  if (job.mode === "withDP" && !canShift) {
    issues.push(
      issue(
        "warn",
        "COLUMN_SHIFT_PENDING",
        "TODO(MPGenie): shifting a multi-fluid or slug column while running in is not implemented. Stages use the column as given.",
        "column",
      ),
    );
  }

  // noDP: pipe-out column, pill does not climb. withDP: closed-end steel raises the pill.
  const stages =
    job.mode === "withDP" && canShift
      ? stagesRaised(job, pill, volume, issues)
      : staticStage(job, pill);
  displacement.stages = stages;
  displacement.minStagesRih = stages.length > 0 ? stages.length : null;
  if (stages.length > 0) {
    issues.push(
      issue(
        "warn",
        "STAGE_VOLUME_PENDING",
        "TODO(MPGenie): circulated volume per RIH stage is not in the v1 single-column model. pumped_bbl is null.",
      ),
    );
  }

  if (job.mode === "withDP" && pillReachesShoe(job, pill, volume, canShift)) {
    issues.push(
      issue(
        "warn",
        "EQUALIZE_PENDING",
        "TODO(MPGenie): withDP float equalize psi needs a pipe-side column, which job v1 does not carry. Shoe ESD includes only pill fluid standing above the shoe. No equalized pill pressure is added when the pill never reaches the shoe.",
        "mode",
      ),
    );
  }
  return displacement;
}
