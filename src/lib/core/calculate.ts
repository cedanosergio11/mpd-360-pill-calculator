import { esdAtMd, pillPlacement } from "./column";
import { demandSupported, taperedCalcRefusal, type TaperedStringRefusal } from "./job-support";
import { buildDisplacement, pumpsOffSbpPsi, shoeEmwPpg } from "./displacement";
import { staticColumnJob } from "./equalize";
import { inputHash } from "./hash";
import { ecdPpg, emwFromParts, frictionPsi } from "./hydraulics";
import { fannBlocked, hasStructureError, issue, type Issue } from "./issues";
import type { Job } from "./job.schema";
import {
  CALC_VERSION,
  type DepthKey,
  type DepthResult,
  type DisplacementStage,
  type Result,
} from "./result";
import { buildTripSchedule } from "./trip-schedule";
import { resolvedAnchorTvd, tvdAt } from "./tvd";
import { validate } from "./validate";

function depthShell(job: Job, key: DepthKey, md: number, tvd: number | null): DepthResult {
  return {
    md_ft: md,
    tvd_ft: tvd,
    esd_ppg: null,
    ecd_ppg: null,
    fit_ppg: key === "shoe" ? job.well.fit_ppg : null,
    pore_ppg: key === "td" ? (job.well.porePressure_ppg ?? null) : null,
    targetEmw_ppg: job.well.targetEmw_ppg ?? null,
    surge: [],
    swab: [],
  };
}

function emptyDepths(job: Job): Result["depths"] {
  const well = job.well;
  return {
    shoe: depthShell(job, "shoe", well.shoeMd_ft, tvdAt(well, well.shoeMd_ft)),
    anchor: depthShell(job, "anchor", well.anchorMd_ft, resolvedAnchorTvd(well)),
    td: depthShell(job, "td", well.mdTd_ft, tvdAt(well, well.mdTd_ft)),
  };
}

function blankResult(job: Job, issues: Result["issues"]): Result {
  return {
    calcVersion: CALC_VERSION,
    inputHash: inputHash(job),
    depths: emptyDepths(job),
    displacement: {
      pillVolume_bbl: null,
      pillTopMd_ft: null,
      pillBottomMd_ft: null,
      pillTopTvd_ft: null,
      pillBottomTvd_ft: null,
      stages: [],
      minStagesRih: null,
    },
    tripSchedule: [],
    issues,
  };
}

/**
 * Job paths that set shoe ESD. Interval depths are the pill-volume input.
 * Pipe and hole sizes are not listed.
 */
function shoeFitJobFields(job: Job): string[] {
  const fields = ["well.shoeMd_ft", "well.shoeTvd_ft", "trip.sbpConn_psi"];
  const used = new Set<string>();
  const intervals = (key: "column" | "pipeColumn", segments: Job["column"]) => {
    segments.forEach((segment, index) => {
      fields.push(`${key}[${index}].topMd_ft`, `${key}[${index}].bottomMd_ft`);
      used.add(segment.fluidId);
    });
  };
  intervals("column", job.column);
  intervals("pipeColumn", job.pipeColumn);
  job.fluids.forEach((fluid, index) => {
    if (used.has(fluid.id)) fields.push(`fluids[${index}].density_ppg`);
  });
  return fields;
}

function formatPpg(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function stageList(stages: number[]): string {
  const sorted = [...stages].sort((a, b) => a - b);
  if (sorted.length === 1) return `stage ${sorted[0]}`;
  const contiguous = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  if (contiguous) return `stages ${sorted[0]}–${sorted[sorted.length - 1]}`;
  return `stages ${sorted.join(", ")}`;
}

interface ShoeFitHit {
  stage: number | null;
  emw: number;
  depthFt: number;
}

function flagShoeAtFit(
  job: Job,
  depths: Result["depths"],
  stages: DisplacementStage[],
  issues: Issue[],
) {
  const fit = job.well.fit_ppg;
  if (!Number.isFinite(fit)) return;
  const shoe = depths.shoe;
  const anchor = depths.anchor;
  const hits: ShoeFitHit[] = [];
  const staticEmw = shoeEmwPpg(shoe.esd_ppg, shoe.tvd_ft, pumpsOffSbpPsi(job, anchor.esd_ppg));
  if (staticEmw != null && staticEmw >= fit - 1e-9) {
    hits.push({ stage: null, emw: staticEmw, depthFt: shoe.md_ft });
  }
  for (const stage of stages) {
    const stageEmw = stage.shoeEmw_ppg;
    if (stageEmw == null || stageEmw < fit - 1e-9) continue;
    hits.push({ stage: stage.n, emw: stageEmw, depthFt: shoe.md_ft });
  }
  if (!hits.length) return;

  const stageNums = hits.flatMap((hit) => (hit.stage == null ? [] : [hit.stage]));
  const worst = hits.reduce((best, hit) => {
    if (hit.emw > best.emw + 1e-9) return hit;
    if (best.emw > hit.emw + 1e-9) return best;
    if (best.stage == null && hit.stage != null) return hit;
    return best;
  });
  const where = stageNums.length ? `in ${stageList(stageNums)}, ` : "";
  const at =
    worst.stage != null ? `at stage ${worst.stage}` : `at shoe ${formatPpg(worst.depthFt)} ft`;
  const depth = worst.stage != null ? `, shoe ${formatPpg(worst.depthFt)} ft` : "";
  const item = issue(
    "error",
    "SHOE_ESD_AT_FIT",
    `Shoe ESD at or above FIT ${where}worst ${formatPpg(worst.emw)} ppg ${at} vs FIT ${formatPpg(fit)}${depth}. Not issuable on SDS-FRM-087.`,
    "depths.shoe.esd_ppg",
    shoeFitJobFields(job),
  );
  item.stages = stageNums;
  issues.push(item);
}

/**
 * PillView calculation core.
 *
 * Validates first. Hydrostatic ESD comes from the annulus column. withDP
 * replaces that column with the float U-tube balance when `pipeColumn` holds
 * pill. ECD and swab/surge adapt API RP 13D. Friction stops at the bit.
 *
 * Shoe ESD (1.0.7.1): only pill fluid standing above the shoe counts. A pill
 * that never reaches the shoe adds nothing, and shoe ESD does not fall below
 * mud weight. Pore is the entered value, reported at TD only.
 * Missing inputs stay null or empty, never 0.
 */
export function calculate(job: Job): Result | TaperedStringRefusal {
  const refused = taperedCalcRefusal(job);
  if (refused) return refused;

  const issues = validate(job);
  if (hasStructureError(issues)) return blankResult(job, issues);

  const hydro = staticColumnJob(job);
  const depths = emptyDepths(job);
  const points: { key: DepthKey; md: number }[] = [
    { key: "shoe", md: job.well.shoeMd_ft },
    { key: "anchor", md: job.well.anchorMd_ft },
    { key: "td", md: job.well.mdTd_ft },
  ];
  for (const point of points) {
    depths[point.key].esd_ppg = esdAtMd(hydro, point.md);
  }

  const blocked = fannBlocked(issues);
  const speeds = [...new Set(job.trip.speeds_ftmin.filter((speed) => speed > 0))].sort(
    (a, b) => a - b,
  );
  let geometryMiss = false;
  const bit = job.well.bitMd_ft;

  for (const point of points) {
    const depth = depths[point.key];
    const tvd = depth.tvd_ft;
    if (!blocked && job.trip.flow_gpm > 0) {
      const friction = frictionPsi(hydro, point.md, bit, { kind: "flow" });
      if (friction == null) geometryMiss = true;
      else depth.ecd_ppg = ecdPpg(depth.esd_ppg, friction, tvd, job.trip.sbpCirc_psi);
    } else if (!(job.trip.flow_gpm > 0)) {
      depth.ecd_ppg = ecdPpg(depth.esd_ppg, 0, tvd, job.trip.sbpCirc_psi);
    }

    if (blocked) continue;
    for (const speed of speeds) {
      const pair = emwFromParts(hydro, point.md, bit, speed, job.trip.sbpConn_psi);
      if (!pair) {
        geometryMiss = true;
        continue;
      }
      depth.surge.push({ speed_ftmin: speed, emw_ppg: pair.surge_ppg });
      depth.swab.push({ speed_ftmin: speed, emw_ppg: pair.swab_ppg });
    }
  }

  if (geometryMiss && !issues.some((item) => item.code === "GEOMETRY")) {
    issues.push(
      issue(
        "error",
        "GEOMETRY",
        "Hydraulics need a hole ID larger than the string OD along the annulus to the bit.",
        "well.casing",
      ),
    );
  }

  const place = pillPlacement(job);
  const displacement = demandSupported(buildDisplacement(job, issues));
  const tripSchedule = demandSupported(buildTripSchedule(
    hydro,
    place?.pill?.topMd ?? null,
    place?.pill?.bottomMd ?? null,
    displacement.stages,
    issues,
  ));
  flagShoeAtFit(job, depths, displacement.stages, issues);

  return {
    calcVersion: CALC_VERSION,
    inputHash: inputHash(job),
    depths,
    displacement,
    tripSchedule,
    issues,
  };
}
