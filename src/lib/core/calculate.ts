import { esdAtMd, pillPlacement } from "./column";
import { buildDisplacement } from "./displacement";
import { inputHash } from "./hash";
import { ecdPpg, emwFromParts, frictionPsi } from "./hydraulics";
import { fannBlocked, hasStructureError, issue } from "./issues";
import type { Job } from "./job.schema";
import { CALC_VERSION, type DepthKey, type DepthResult, type Result } from "./result";
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
    pore_ppg: job.well.porePressure_ppg ?? null,
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

/**
 * Step-1 PillView core.
 *
 * Validates first. Hydrostatic ESD comes from the single fluid column.
 * ECD and swab/surge adapt API RP 13D (`segmentDp`, Eq 98, Eq 100/101) with
 * each column slice at its own density and Fann readings. Friction stops at
 * the bit, which is separate from TD.
 *
 * Shoe ESD (1.0.7.1): only pill fluid standing above the shoe counts. A pill
 * whose top is below the shoe leaves shoe ESD at mud weight, in both modes.
 * withDP does not add float-equalize psi — job v1 has no pipe-side column
 * (TODO EQUALIZE_PENDING). Missing inputs stay null or empty, never 0.
 *
 * TODO(MPGenie): full single-column migration (pipe inventory, equalize dump,
 * circulated stage volume, pill movement along the trip schedule).
 */
export function calculate(job: Job): Result {
  const issues = validate(job);
  if (hasStructureError(issues)) return blankResult(job, issues);

  const depths = emptyDepths(job);
  const points: { key: DepthKey; md: number }[] = [
    { key: "shoe", md: job.well.shoeMd_ft },
    { key: "anchor", md: job.well.anchorMd_ft },
    { key: "td", md: job.well.mdTd_ft },
  ];
  for (const point of points) {
    depths[point.key].esd_ppg = esdAtMd(job, point.md);
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
      const friction = frictionPsi(job, point.md, bit, { kind: "flow" });
      if (friction == null) geometryMiss = true;
      else depth.ecd_ppg = ecdPpg(depth.esd_ppg, friction, tvd, job.trip.sbpCirc_psi);
    } else if (!(job.trip.flow_gpm > 0)) {
      depth.ecd_ppg = ecdPpg(depth.esd_ppg, 0, tvd, job.trip.sbpCirc_psi);
    }

    if (blocked) continue;
    for (const speed of speeds) {
      const pair = emwFromParts(job, point.md, bit, speed, job.trip.sbpConn_psi);
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
    job,
    place?.pill?.topMd ?? null,
    place?.pill?.bottomMd ?? null,
    displacement.stages,
    issues,
  );

  return {
    calcVersion: CALC_VERSION,
    inputHash: inputHash(job),
    depths,
    displacement,
    tripSchedule,
    issues,
  };
}
