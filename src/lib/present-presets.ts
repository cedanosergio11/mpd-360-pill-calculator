import { PRESETS } from "@/lib/calc/examples";
import type { WellInputs } from "@/lib/calc/types";

type Preset = (typeof PRESETS)[number];

export const EXAMPLE_WELL = "EXAMPLE";

/**
 * Menu copies of the workbook presets.
 * Stored rows are not edited. Only the well-name string changes.
 */
export function presentPreset(preset: Preset): Preset {
  const inputs: WellInputs = { ...preset.inputs, wellName: EXAMPLE_WELL };
  return { ...preset, inputs };
}

export function presentPresets(presets: readonly Preset[] = PRESETS): Preset[] {
  return presets.map(presentPreset);
}
