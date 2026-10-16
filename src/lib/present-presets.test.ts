import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EXAMPLE_SHALLOW, PRESETS } from "@/lib/calc/examples";
import { EXAMPLE_WELL, presentPreset, presentPresets } from "./present-presets";

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

const SHALLOW_NUMERIC_HASH = "05a584aab9ab040e9db2dac32faaf65f6bf56c3b36f5d6eaa41dbb6d4d2df2e5";

describe("present presets", () => {
  it("shows EXAMPLE for every well name and leaves EXAMPLE 7 numbers unchanged", () => {
    const storedShallow = PRESETS.find((preset) => preset.id === "shallow");
    expect(storedShallow?.inputs.wellName).toBe("Shallow Spot Check");
    expect(EXAMPLE_SHALLOW.wellName).toBe("Shallow Spot Check");

    const beforeShallow = numericFieldDigest(EXAMPLE_SHALLOW);
    expect(beforeShallow).toBe(SHALLOW_NUMERIC_HASH);

    const shown = presentPresets();
    expect(shown).toHaveLength(PRESETS.length);
    for (const preset of shown) {
      expect(preset.inputs.wellName).toBe(EXAMPLE_WELL);
    }

    const shownShallow = shown.find((preset) => preset.id === "shallow");
    expect(shownShallow?.label).toBe(storedShallow?.label);
    expect(numericFieldDigest(shownShallow?.inputs)).toBe(SHALLOW_NUMERIC_HASH);
    expect(numericFieldDigest(presentPreset(storedShallow!).inputs)).toBe(beforeShallow);
    expect(EXAMPLE_SHALLOW.wellName).toBe("Shallow Spot Check");

    for (const stored of PRESETS) {
      const copy = shown.find((preset) => preset.id === stored.id);
      expect(numericFieldDigest(copy?.inputs)).toBe(numericFieldDigest(stored.inputs));
      expect(copy?.label).toBe(stored.label);
    }
  });
});
