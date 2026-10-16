import { asNum, isNum } from "@/lib/utils";
import type { DepthField, WellInputs } from "./types";

/** A bit, pill, anchor, or shoe depth is past TD, or the pill or anchor is past the bit. */
export const DEPTH_BEYOND_TD = "DEPTH_BEYOND_TD" as const;

const EPS = 1e-4;

export const MD_TVD_PAIRS = [
  { md: "anchorMd", tvd: "anchorTvd", mdLabel: "Anchor point MD", tvdLabel: "Anchor point TVD" },
  { md: "casingMd", tvd: "casingTvd", mdLabel: "Casing depth MD", tvdLabel: "Casing depth TVD" },
  { md: "spotMd", tvd: "spotTvd", mdLabel: "Spot depth MD", tvdLabel: "Spot depth TVD" },
] as const;

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

/**
 * Bit, pill, anchor, and shoe depths past TD.
 * Pill and anchor MD are also compared to bit MD.
 * TVDs are the sheet values. They are compared to TD only.
 * Equal to the limit is inside the well. An empty TD or bit skips that comparison.
 */
export function depthBeyondFields(inputs: WellInputs): DepthField[] {
  const fields: DepthField[] = [];
  const td = finite(inputs.tdDepth);
  const bit = finite(inputs.currentDepthMd);

  past(fields, "Current well depth", bit, td, "TD");

  for (const pair of MD_TVD_PAIRS) {
    past(fields, pair.mdLabel, finite(inputs[pair.md]), td, "TD");
    past(fields, pair.tvdLabel, finite(inputs[pair.tvd]), td, "TD");
  }

  past(fields, "Spot depth MD", finite(inputs.spotMd), bit, "bit MD");
  past(fields, "Anchor point MD", finite(inputs.anchorMd), bit, "bit MD");

  return fields;
}

export function depthBlockMessage(fields: DepthField[]): string {
  return fields
    .map((field) => `${field.label} ${field.value} ft is past ${field.limitLabel} ${field.limit} ft`)
    .join("; ");
}
