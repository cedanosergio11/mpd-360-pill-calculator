import { EXAMPLE_8_5, EXAMPLE_SHALLOW, PRESETS, exampleLoadLabel } from "@/lib/calc/examples";
import type { WellInputs } from "@/lib/calc/types";

type Preset = (typeof PRESETS)[number];

export const EXAMPLE_85_LABEL = exampleLoadLabel(6, EXAMPLE_8_5);
export const SHALLOW_LABEL = exampleLoadLabel(7, EXAMPLE_SHALLOW);
export const EXAMPLE_85_WELL = "EXAMPLE";

/**
 * Menu copy for the two presets whose stored labels are off the EXAMPLE n pattern.
 * Stored workbook rows are not edited. Only the label and, for the 8.5-in row, the well name change.
 */
export function presentPreset(preset: Preset): Preset {
  if (preset.id === "example-85") {
    const inputs: WellInputs = { ...preset.inputs, wellName: EXAMPLE_85_WELL };
    return { ...preset, label: EXAMPLE_85_LABEL, inputs };
  }
  if (preset.id === "shallow") {
    return { ...preset, label: SHALLOW_LABEL };
  }
  return preset;
}

export function presentPresets(presets: readonly Preset[] = PRESETS): Preset[] {
  return presets.map(presentPreset);
}
