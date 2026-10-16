import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculate } from "./engine";
import {
  EXAMPLE_1,
  EXAMPLE_2,
  EXAMPLE_3,
  EXAMPLE_4,
  EXAMPLE_5,
  EXAMPLE_8_5,
  EXAMPLE_SHALLOW,
  PRESETS,
  exampleLoadLabel,
} from "./examples";
import { useAppStore } from "@/lib/store";
import type { WellInputs } from "./types";

/** sha256 of finite numbers only, with sorted keys. Strings and booleans are omitted. */
function numericFieldDigest(value: unknown): string {
  const lines: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "number") {
      if (Number.isFinite(node)) lines.push(`${path}=${node}`);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const key of Object.keys(node).sort()) {
        walk((node as Record<string, unknown>)[key], path ? `${path}.${key}` : key);
      }
    }
  };
  walk(value, "");
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function renamedCopy(inputs: WellInputs): WellInputs {
  return {
    ...inputs,
    wellName: "RENAMED",
    client: "RENAMED",
    date: "1999-01-01",
    producedBy: "RENAMED",
  };
}

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
    expect(labels.slice(0, 2)).toEqual([
      exampleLoadLabel(6, EXAMPLE_8_5),
      exampleLoadLabel(7, EXAMPLE_SHALLOW),
    ]);
    expect(EXAMPLE_8_5.wellName).toBe("EXAMPLE");
    expect(labels[0]).toBe("EXAMPLE 6 — 8.5 in hole, 12.4 ppg, spot 15,400 ft MD");
    expect(labels[1]).toBe("EXAMPLE 7 — 6.75 in hole, 11.8 ppg, spot 6,000 ft MD");
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

  it("hashes numeric fields the same before and after a label rename", () => {
    const before85 = numericFieldDigest(EXAMPLE_8_5);
    const beforeShallow = numericFieldDigest(EXAMPLE_SHALLOW);
    expect(numericFieldDigest(renamedCopy(EXAMPLE_8_5))).toBe(before85);
    expect(numericFieldDigest(renamedCopy(EXAMPLE_SHALLOW))).toBe(beforeShallow);
    expect(before85).not.toBe(beforeShallow);
    expect(before85).toBe("a545e2b0c81be5625f0f6bd613c433f71c6829510804167ad3d87c93e5438205");
    expect(beforeShallow).toBe("05a584aab9ab040e9db2dac32faaf65f6bf56c3b36f5d6eaa41dbb6d4d2df2e5");
  });

  it("loads each preset and calculates", () => {
    for (const preset of PRESETS) {
      useAppStore.getState().loadPreset(preset.inputs);
      const { inputs } = useAppStore.getState();
      const results = calculate(inputs);
      const reason = results.depthBlock
        ? `${results.depthBlock.code}: ${results.errorReason}`
        : null;
      expect(reason, preset.label).toBeNull();
      expect(results.procedurePossible, preset.label).toBe(true);
    }
  });
});
