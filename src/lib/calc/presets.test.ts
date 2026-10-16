import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import { EXAMPLE_1, EXAMPLE_2, EXAMPLE_3, EXAMPLE_4, EXAMPLE_5, PRESETS, exampleLoadLabel } from "./examples";
import { useAppStore } from "@/lib/store";

const NUMBERED = [
  [1, EXAMPLE_1],
  [2, EXAMPLE_2],
  [3, EXAMPLE_3],
  [4, EXAMPLE_4],
  [5, EXAMPLE_5],
] as const;

describe("Load well", () => {
  it("lists labels built from hole size, current MW, and spot MD", () => {
    const shell = readFileSync(new URL("../../components/app-shell.tsx", import.meta.url), "utf8");
    expect(shell).toMatch(/PRESETS\.map\(\(p\)/);
    expect(shell).toContain("{p.label}");
    const labels = PRESETS.map((preset) => preset.label);
    expect(labels.slice(0, 2)).toEqual(["Example 8.5 in hole", "Shallow spot snapshot"]);
    for (const [n, inputs] of NUMBERED) {
      const label = exampleLoadLabel(n, inputs);
      expect(labels).toContain(label);
      const named = {
        ...inputs,
        wellName: "NOT USED",
        client: "NOT USED",
        date: "1999-01-01",
        producedBy: "NOT USED",
      };
      expect(exampleLoadLabel(n, named)).toBe(label);
    }
    for (const label of labels) console.log(label);
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
