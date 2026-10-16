import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { PRESETS } from "./examples";
import { useAppStore } from "@/lib/store";

const LOAD_WELL_LABELS = [
  "Example 8.5 in hole",
  "Shallow spot snapshot",
  "EXAMPLE 1",
  "EXAMPLE 2",
  "EXAMPLE 3",
  "EXAMPLE 4",
  "EXAMPLE 5",
];

describe("Load well", () => {
  it("lists the scrubbed examples", () => {
    const shell = readFileSync(new URL("../../components/app-shell.tsx", import.meta.url), "utf8");
    expect(shell).toMatch(/PRESETS\.map\(\(p\)/);
    expect(shell).toContain("{p.label}");
    expect(PRESETS.map((preset) => preset.label)).toEqual(LOAD_WELL_LABELS);
  });

  it("loads each preset and calculates", () => {
    for (const preset of PRESETS) {
      useAppStore.getState().loadPreset(preset.inputs);
      const { inputs, editBlock } = useAppStore.getState();
      expect(editBlock, preset.label).toBeNull();
      const results = calculate(inputs);
      const reason = results.depthBlock
        ? `${results.depthBlock.code}: ${results.errorReason}`
        : null;
      expect(reason, preset.label).toBeNull();
      expect(results.procedurePossible, preset.label).toBe(true);
    }
  });
});
