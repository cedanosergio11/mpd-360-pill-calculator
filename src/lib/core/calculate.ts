import { esdAtMd, pillPlacement } from "./column";
import { buildDisplacement } from "./displacement";
import { staticColumnJob } from "./equalize";
import { inputHash } from "./hash";
import { ecdPpg, emwFromParts, frictionPsi } from "./hydraulics";
import { fannBlocked, hasStructureError, issue, type Issue } from "./issues";
import type { Job } from "./job.schema";
import {
  CALC_VERSION,
  PSI_PER_PPG_FT,
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
    targetEmw_ppg: job.well.targetEmw_ppg,
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

/** Job inputs that set static shoe EMW and the FIT it is checked against. */
const SHOE_FIT_JOB_FIELDS = [
  "well.shoeMd_ft",
  "well.shoeTvd_ft",
  "well.fit_ppg",
  "well.anchorMd_ft",
  "well.anchorTvd_ft",
  "well.targetEmw_ppg",
  "column",
  "fluids",
  "trip.sbpConn_psi",
];

/** Pumps-off SBP that holds anchor ESD at target EMW. */
function staticSbpPsi(job: Job, anchorEsd: number | null, anchorTvd: number | null): number | null {
  if (anchorEsd == null || anchorTvd == null || !(anchorTvd > 0)) return null;
  return Math.max(0, (job.well.targetEmw_ppg - anchorEsd) * PSI_PER_PPG_FT * anchorTvd);
}

/** Static shoe EMW: shoe ESD plus SBP, with no trip friction. */
function staticShoeEmw(esd: number | null, tvd: number | null, sbp: number | null): number | null {
  if (esd == null || tvd == null || !(tvd > 0) || sbp == null) return null;
  return esd + sbp / (PSI_PER_PPG_FT * tvd);
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
  const sbp = staticSbpPsi(job, anchor.esd_ppg, anchor.tvd_ft);
  const staticEmw = staticShoeEmw(shoe.esd_ppg, shoe.tvd_ft, sbp);
  if (staticEmw != null && staticEmw >= fit - 1e-9) {
    issues.push(
      issue(
        "error",
        "SHOE_ESD_AT_FIT",
        `Static shoe ESD plus SBP is ${staticEmw.toFixed(4)} ppg, at or above FIT ${fit} ppg. Not issuable on SDS-FRM-087.`,
        "depths.shoe.esd_ppg",
        SHOE_FIT_JOB_FIELDS,
      ),
    );
  }
  stages.forEach((stage, index) => {
    const stageEmw = staticShoeEmw(stage.shoeEsd_ppg, shoe.tvd_ft, stage.sbp_psi);
    if (stageEmw == null || stageEmw < fit - 1e-9) return;
    issues.push(
      issue(
        "error",
        "SHOE_ESD_AT_FIT",
        `Stage ${stage.n} static shoe ESD plus SBP is ${stageEmw.toFixed(4)} ppg, at or above FIT ${fit} ppg.`,
        `displacement.stages[${index}].shoeEsd_ppg`,
        SHOE_FIT_JOB_FIELDS,
      ),
    );
  });
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
export function calculate(job: Job): Result {
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
  const displacement = buildDisplacement(job, issues);
  const tripSchedule = buildTripSchedule(
    hydro,
    place?.pill?.topMd ?? null,
    place?.pill?.bottomMd ?? null,
    displacement.stages,
    issues,
  );
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
