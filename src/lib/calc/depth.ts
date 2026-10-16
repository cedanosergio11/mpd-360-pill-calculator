import { tvdAt } from "@/lib/pill/hydrostatic";
import type { SurveyPoint } from "@/lib/pill/types";
import { asNum, isNum } from "@/lib/utils";
import { surveyFromInputs } from "./equalize";
import type { DepthField, WellInputs } from "./types";

/** A bit, pill, anchor, shoe, or survey depth is past TD, or the pill/anchor is past the bit. */
export const DEPTH_BEYOND_TD = "DEPTH_BEYOND_TD" as const;

/** An MD that needs a TVD is past the last survey station. TVD is not extrapolated. */
export const MD_BEYOND_SURVEY = "MD_BEYOND_SURVEY" as const;

const EPS = 1e-4;

export const MD_TVD_PAIRS = [
  { md: "anchorMd", tvd: "anchorTvd", mdLabel: "Anchor point MD", tvdLabel: "Anchor point TVD" },
  { md: "casingMd", tvd: "casingTvd", mdLabel: "Casing depth MD", tvdLabel: "Casing depth TVD" },
  { md: "spotMd", tvd: "spotTvd", mdLabel: "Spot depth MD", tvdLabel: "Spot depth TVD" },
] as const;

export type MdKey = (typeof MD_TVD_PAIRS)[number]["md"];
export type TvdKey = (typeof MD_TVD_PAIRS)[number]["tvd"];

function finite(value: unknown): number | null {
  const n = asNum(value);
  return isNum(n) ? n : null;
}

function past(
  fields: DepthField[],
  label: string,
  value: number | null,
  limit: number | null,
  limitLabel: string,
) {
  if (value == null || limit == null || !(value > limit + EPS)) return;
  fields.push({ label, value, limit, limitLabel });
}

/** Survey stations with MD > 0. The synthetic surface tie is not a station. */
export function realSurvey(inputs: WellInputs): SurveyPoint[] {
  return surveyFromInputs(inputs).filter((point) => point.md > EPS);
}

export function lastSurveyMd(inputs: WellInputs): number | null {
  const points = realSurvey(inputs);
  return points.length ? points[points.length - 1].md : null;
}

/**
 * TVD at `md` by the same piecewise-linear `tvdAt` the 1.0.7.1 sheet uses.
 * Null when `md` is past the last real station, or there is no station.
 * Does not extrapolate.
 */
export function surveyTvdAt(
  inputs: WellInputs,
  md: number,
  survey: SurveyPoint[] = surveyFromInputs(inputs),
): number | null {
  if (!Number.isFinite(md)) return null;
  if (!(md > 0)) return 0;
  const real = survey.filter((point) => point.md > EPS);
  if (!real.length) return null;
  const last = real[real.length - 1].md;
  if (md > last + EPS) return null;
  return tvdAt(survey, md);
}

/** Bit TVD from the survey. Null when the bit MD is past the last station. */
export function bitTvd(inputs: WellInputs): number | null {
  const bit = finite(inputs.currentDepthMd);
  if (bit == null) return null;
  return surveyTvdAt(inputs, bit);
}

/**
 * Anchor, shoe, and spot MDs that are past the last survey station.
 * A stored MD/TVD tie is itself a station, so a loaded well is not blocked
 * for being the deepest tie. The bit MD is not checked: the sheet uses it
 * for volumes, and a missing bit TVD stays null.
 */
export function mdBeyondSurveyFields(inputs: WellInputs): DepthField[] {
  const fields: DepthField[] = [];
  const stations = realSurvey(inputs);
  const last = stations.at(-1)?.md ?? 0;
  for (const pair of MD_TVD_PAIRS) {
    const md = finite(inputs[pair.md]);
    if (md == null) continue;
    const tied = stations.some((point) => Math.abs(point.md - md) <= EPS);
    if (tied || !(md > last + EPS)) continue;
    fields.push({
      label: pair.mdLabel,
      value: md,
      limit: last,
      limitLabel: "last survey station",
    });
  }
  return fields;
}

function surveyOmitting(inputs: WellInputs, md: MdKey, tvd: TvdKey): SurveyPoint[] {
  return surveyFromInputs({ ...inputs, [md]: "", [tvd]: "" });
}

/**
 * Bit, pill, anchor, shoe, and survey depths past TD.
 * Pill and anchor past the bit: MD against bit MD, TVD against bit TVD.
 * Equal to the limit is inside the well. An empty TD or bit skips that comparison.
 * Bit TVD is omitted when the bit is past the last survey station.
 */
export function depthBeyondFields(inputs: WellInputs): DepthField[] {
  const fields: DepthField[] = [];
  const td = finite(inputs.tdDepth);
  const bit = finite(inputs.currentDepthMd);
  const bitTvdFt = bitTvd(inputs);

  past(fields, "Current well depth", bit, td, "TD");
  past(fields, "Current well depth TVD", bitTvdFt, td, "TD");

  for (const pair of MD_TVD_PAIRS) {
    past(fields, pair.mdLabel, finite(inputs[pair.md]), td, "TD");
    past(fields, pair.tvdLabel, finite(inputs[pair.tvd]), td, "TD");
  }

  realSurvey(inputs).forEach((station, index) => {
    const label = `Survey station ${index + 1}`;
    past(fields, `${label} MD`, station.md, td, "TD");
    past(fields, `${label} TVD`, station.tvd, td, "TD");
  });

  past(fields, "Spot depth MD", finite(inputs.spotMd), bit, "bit MD");
  past(fields, "Anchor point MD", finite(inputs.anchorMd), bit, "bit MD");
  past(fields, "Spot depth TVD", finite(inputs.spotTvd), bitTvdFt, "bit TVD");
  past(fields, "Anchor point TVD", finite(inputs.anchorTvd), bitTvdFt, "bit TVD");

  return fields;
}

export interface MdSync {
  inputs: WellInputs;
  /** TVDs rewritten from the survey. */
  updated: { field: TvdKey; label: string; tvd: number }[];
  beyond: DepthField[];
}

function depthMoved(before: unknown, after: unknown): boolean {
  if (typeof before === "number" && typeof after === "number" && Number.isFinite(before) && Number.isFinite(after)) {
    return Math.abs(before - after) > EPS;
  }
  return before !== after;
}

/**
 * MDs that differ from `before` get a new TVD from the other survey stations.
 * The stored TVD is replaced. An MD past the last other station is listed and
 * left unextrapolated. Unchanged MDs keep their TVDs, so a stored job is stable.
 */
export function syncChangedMd(before: WellInputs, after: WellInputs): MdSync {
  const inputs: WellInputs = { ...after };
  const updated: MdSync["updated"] = [];
  const beyond: DepthField[] = [];

  for (const pair of MD_TVD_PAIRS) {
    if (!depthMoved(before[pair.md], after[pair.md])) continue;
    const md = finite(after[pair.md]);
    if (md == null) continue;
    const survey = surveyOmitting(after, pair.md, pair.tvd);
    const tvd = surveyTvdAt(after, md, survey);
    if (tvd == null) {
      const limit = survey.filter((point) => point.md > EPS).at(-1)?.md ?? 0;
      beyond.push({
        label: pair.mdLabel,
        value: md,
        limit,
        limitLabel: "last survey station",
      });
      continue;
    }
    inputs[pair.tvd] = tvd;
    updated.push({ field: pair.tvd, label: pair.tvdLabel, tvd });
  }

  return { inputs, updated, beyond };
}

export function depthBlockMessage(fields: DepthField[]): string {
  return fields
    .map((field) => `${field.label} ${field.value} ft is past ${field.limitLabel} ${field.limit} ft`)
    .join("; ");
}
