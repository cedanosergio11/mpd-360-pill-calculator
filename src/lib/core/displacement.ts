import { capBblFt } from "@/lib/utils";
import { columnDisplacedByPipe, esdAtMd, pillPlacement, type Span } from "./column";
import { balanceFloat, pipePillBbl } from "./equalize";
import { intervalVolume, uniqueSorted } from "./geometry";
import { stringVolumeBbl, usesTaperedString } from "./string";
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
 * Pumps-off SBP, psi. Matches trip `sbpStatic`.
 * Anchor target present: max(0, (target − anchor ESD) × 0.052 × anchor TVD).
 * No target: the entered connection SBP.
 */
export function pumpsOffSbpPsi(job: Job, anchorEsd: number | null): number | null {
  const target = job.well.targetEmw_ppg;
  if (target == null || !Number.isFinite(target)) {
    return Number.isFinite(job.trip.sbpConn_psi) ? job.trip.sbpConn_psi : null;
  }
  const anchorTvd = resolvedAnchorTvd(job.well);
  if (anchorEsd == null || anchorTvd == null || !(anchorTvd > 0)) return null;
  return Math.max(0, (target - anchorEsd) * PSI_PER_PPG_FT * anchorTvd);
}

/** Shoe EMW, ppg: hydrostatic shoe ESD plus SBP. */
export function shoeEmwPpg(
  shoeEsd: number | null,
  shoeTvd: number | null,
  sbp: number | null,
): number | null {
  if (shoeEsd == null || shoeTvd == null || !(shoeTvd > 0) || sbp == null) return null;
  return shoeEsd + sbp / (PSI_PER_PPG_FT * shoeTvd);
}

/**
 * Pill volume pumped by the time the bit reaches `bitMd`.
 * Pill length covered (deepest pill fluid only) times pipe capacity.
 * 0 when the bit has not entered that fluid — a computed zero, not a placeholder.
 */
export function pumpedPillBbl(job: Job, pill: Span, bitMd: number): number | null {
  const own = job.column.filter(
    (segment) =>
      segment.fluidId === pill.fluidId &&
      segment.bottomMd_ft > pill.topMd - 0.1 &&
      segment.topMd_ft < pill.bottomMd + 0.1,
  );
  const top = own.length ? Math.min(...own.map((segment) => segment.topMd_ft)) : pill.topMd;
  const bottom = own.length
    ? Math.max(...own.map((segment) => segment.bottomMd_ft))
    : pill.bottomMd;
  const covered = Math.max(0, Math.min(bitMd, bottom) - top);
  if (!usesTaperedString(job.well)) {
    const cap = capBblFt(job.well.stringId_in);
    if (!Number.isFinite(cap) || cap <= 0) return null;
    return covered * cap;
  }
  if (covered <= 0) return 0;
  return stringVolumeBbl(job.well, top, Math.min(bitMd, bottom), "capacity");
}

function stageFromColumn(
  job: Job,
  columnJob: Job,
  n: number,
  bitMd: number,
  pill: Span,
): DisplacementStage {
  const anchorEsd = esdAtMd(columnJob, job.well.anchorMd_ft);
  const shoeEsd = esdAtMd(columnJob, job.well.shoeMd_ft);
  const sbp = pumpsOffSbpPsi(job, anchorEsd);
  return {
    n,
    bitMd_ft: bitMd,
    pumped_bbl: pumpedPillBbl(job, pill, bitMd),
    sbp_psi: sbp,
    shoeEsd_ppg: shoeEsd,
    shoeEmw_ppg: shoeEmwPpg(shoeEsd, tvdAt(job.well, job.well.shoeMd_ft), sbp),
    anchorEsd_ppg: anchorEsd,
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
function stagesFor(job: Job, pill: Span, issues: Issue[]): DisplacementStage[] {
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
    } else {
      columnJob = columnDisplacedByPipe(job, bit);
      if (!columnJob) {
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
    }
    stages.push(stageFromColumn(job, columnJob, stages.length, bit, pill));
  }
  return stages;
}

/**
 * Displacement from the annulus column.
 * `pumped_bbl` is pill length covered times pipe capacity.
 * RIH steel displacement shifts every fluid interface, including a slug.
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

  const stages = stagesFor(job, pill, issues);
  displacement.stages = stages;
  displacement.minStagesRih = stages.length > 0 ? stages.length : null;

  if (job.mode === "withDP" && pipePillBbl(job, pill.fluidId) > 0.05) {
    const balance = balanceFloat(job);
    if (balance) {
      displacement.pillTopMd_ft = balance.pillTopMd_ft;
      displacement.pillTopTvd_ft = balance.pillTopTvd_ft;
    }
  }
  return displacement;
}
