import { issue, type Issue } from "./issues";
import type { ColumnSegment, FannReading, Job } from "./job.schema";
import { interpolationHow, onSurveyStation, resolvedAnchorTvd } from "./tvd";

const COLUMN_EPS = 0.1;

const FANN_KEYS = ["r600", "r300", "r200", "r100", "r6", "r3"] as const;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function checkStackedColumn(
  issues: Issue[],
  segments: ColumnSegment[] | undefined,
  path: string,
  noun: string,
  endMd: number | undefined,
  endLabel: string,
  fluidIds: Set<string>,
) {
  const column = segments ?? [];
  column.forEach((segment, index) => {
    if (!fluidIds.has(segment.fluidId)) {
      issues.push(
        issue(
          "error",
          "UNKNOWN_FLUID",
          `${noun} fluid "${segment.fluidId}" is not in fluids.`,
          `${path}[${index}].fluidId`,
        ),
      );
    }
    if (
      !finite(segment.topMd_ft) ||
      !finite(segment.bottomMd_ft) ||
      segment.bottomMd_ft <= segment.topMd_ft + 1e-6
    ) {
      issues.push(
        issue(
          "error",
          "COLUMN_ORDER",
          `${noun} segment bottom must be deeper than its top.`,
          `${path}[${index}].bottomMd_ft`,
        ),
      );
    }
  });

  const indexed = column
    .map((segment, index) => ({ segment, index }))
    .filter(
      ({ segment }) =>
        finite(segment.topMd_ft) &&
        finite(segment.bottomMd_ft) &&
        segment.bottomMd_ft > segment.topMd_ft,
    )
    .sort((a, b) => a.segment.topMd_ft - b.segment.topMd_ft || a.index - b.index);

  // A pipe that has not entered the hole (bit at surface) may be empty.
  if (!indexed.length) {
    if (path === "pipeColumn" && !(finite(endMd) && endMd > COLUMN_EPS)) return;
    issues.push(issue("error", "COLUMN_GAP", `${noun} is empty.`, path));
    return;
  }
  if (indexed[0].segment.topMd_ft > COLUMN_EPS) {
    issues.push(
      issue(
        "error",
        "COLUMN_GAP",
        `${noun} does not start at surface.`,
        `${path}[${indexed[0].index}].topMd_ft`,
      ),
    );
  }
  for (let i = 1; i < indexed.length; i++) {
    const prev = indexed[i - 1];
    const cur = indexed[i];
    const gap = cur.segment.topMd_ft - prev.segment.bottomMd_ft;
    if (gap > COLUMN_EPS) {
      issues.push(
        issue(
          "error",
          "COLUMN_GAP",
          `Gap in the ${noun.toLowerCase()} between ${prev.segment.bottomMd_ft} and ${cur.segment.topMd_ft} ft.`,
          `${path}[${cur.index}].topMd_ft`,
        ),
      );
    } else if (gap < -COLUMN_EPS) {
      issues.push(
        issue(
          "error",
          "COLUMN_OVERLAP",
          `${noun} overlaps at ${cur.segment.topMd_ft} ft.`,
          `${path}[${cur.index}].topMd_ft`,
        ),
      );
    }
  }
  const last = indexed[indexed.length - 1];
  if (finite(endMd) && last.segment.bottomMd_ft < endMd - COLUMN_EPS) {
    issues.push(
      issue(
        "error",
        "COLUMN_GAP",
        `${noun} does not reach ${endLabel}.`,
        `${path}[${last.index}].bottomMd_ft`,
      ),
    );
  } else if (finite(endMd) && last.segment.bottomMd_ft > endMd + COLUMN_EPS) {
    issues.push(
      issue(
        "error",
        "COLUMN_OVERLAP",
        `${noun} extends past ${endLabel}.`,
        `${path}[${last.index}].bottomMd_ft`,
      ),
    );
  }
}

function rheologyNeeded(job: Job): boolean {
  if (finite(job.trip?.flow_gpm) && job.trip.flow_gpm > 0) return true;
  return (job.trip?.speeds_ftmin ?? []).some((speed) => finite(speed) && speed > 0);
}

function fannUsable(fann: FannReading): boolean {
  const { r600, r300, r6, r3 } = fann;
  if (!(r600 > r300 && r300 > 0 && r6 >= r3 && r3 >= 0)) return false;
  const ty = Math.max(0, 2 * r3 - r6);
  return ty < r300;
}

function checkTvd(
  issues: Issue[],
  field: string,
  tvd: number | null | undefined,
  md: number | null | undefined,
) {
  if (!finite(tvd) || !finite(md)) return;
  if (tvd > md + 1e-4) {
    issues.push(issue("error", "TVD_GT_MD", `TVD ${tvd} ft is greater than MD ${md} ft.`, field));
  }
}

/**
 * Structural checks for a v1 job.
 * Errors: column gaps/overlaps, unknown fluidId, TVD > MD, missing or unusable
 * Fann where ECD or swab/surge needs it.
 * Warning TVD_INTERPOLATED names the anchor (`well.anchorMd_ft`) when its TVD
 * is interpolated. An entered shoe or anchor TVD does not warn.
 */
export function validate(job: Job): Issue[] {
  const issues: Issue[] = [];
  if (!job || job.schemaVersion !== 1) {
    issues.push(issue("error", "SCHEMA_VERSION", "Job schemaVersion must be 1.", "schemaVersion"));
    return issues;
  }

  const well = job.well;
  if (well) {
    checkTvd(issues, "well.tvdTd_ft", well.tvdTd_ft, well.mdTd_ft);
    checkTvd(issues, "well.shoeTvd_ft", well.shoeTvd_ft, well.shoeMd_ft);
    const anchorTvd = resolvedAnchorTvd(well);
    checkTvd(issues, "well.anchorTvd_ft", anchorTvd, well.anchorMd_ft);
    (well.survey ?? []).forEach((station, index) => {
      checkTvd(issues, `well.survey[${index}].tvd_ft`, station.tvd_ft, station.md_ft);
    });

    const how = interpolationHow(well);
    // An entered shoe or anchor TVD is the value used. It is not an
    // interpolation, including when the survey array is empty.
    if (
      (well.anchorTvd_ft == null || !finite(well.anchorTvd_ft)) &&
      !onSurveyStation(well, well.anchorMd_ft)
    ) {
      const tvd = resolvedAnchorTvd(well);
      const shown = tvd == null ? "unknown" : String(Math.round(tvd * 100) / 100);
      issues.push(
        issue(
          "warn",
          "TVD_INTERPOLATED",
          `Anchor TVD interpolated (${how}): ${shown} ft.`,
          "well.anchorMd_ft",
        ),
      );
    }
  }

  const fluids = job.fluids ?? [];
  const column = job.column ?? [];
  const fluidIds = new Set(fluids.map((fluid) => fluid.id));

  checkStackedColumn(issues, column, "column", "Fluid column", well?.mdTd_ft, "TD", fluidIds);
  checkStackedColumn(
    issues,
    job.pipeColumn,
    "pipeColumn",
    "Pipe column",
    well?.bitMd_ft,
    "the bit",
    fluidIds,
  );

  if (rheologyNeeded(job)) {
    const used = new Set([...column, ...(job.pipeColumn ?? [])].map((segment) => segment.fluidId));
    fluids.forEach((fluid, index) => {
      if (!used.has(fluid.id)) return;
      if (!fluid.fann) {
        issues.push(
          issue(
            "error",
            "MISSING_FANN",
            `Fluid "${fluid.label || fluid.id}" needs Fann readings for ECD or swab/surge.`,
            `fluids[${index}].fann`,
          ),
        );
        return;
      }
      let missing = false;
      for (const key of FANN_KEYS) {
        if (!finite(fluid.fann[key])) {
          missing = true;
          issues.push(
            issue(
              "error",
              "MISSING_FANN",
              `Fluid "${fluid.label || fluid.id}" is missing Fann ${key}.`,
              `fluids[${index}].fann.${key}`,
            ),
          );
        }
      }
      if (!missing && !fannUsable(fluid.fann)) {
        issues.push(
          issue(
            "error",
            "INVALID_FANN",
            `Fluid "${fluid.label || fluid.id}" Fann readings are not usable (need 600 > 300 > 0 and 6 ≥ 3, yield below R300).`,
            `fluids[${index}].fann.r300`,
          ),
        );
      }
    });
  }

  return issues;
}
