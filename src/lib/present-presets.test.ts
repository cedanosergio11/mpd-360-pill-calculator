import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EXAMPLE_8_5, EXAMPLE_SHALLOW, PRESETS } from "@/lib/calc/examples";
import { EXAMPLE_85_WELL, presentPreset, presentPresets } from "./present-presets";

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

describe("present presets", () => {
  it("renames labels and the 8.5 well name without changing numbers", () => {
    const stored85 = PRESETS.find((preset) => preset.id === "example-85");
    const storedShallow = PRESETS.find((preset) => preset.id === "shallow");
    expect(stored85?.label).toBe("Example 8.5 in hole");
    expect(storedShallow?.label).toBe("Shallow spot snapshot");

    const before85 = numericFieldDigest(EXAMPLE_8_5);
    const beforeShallow = numericFieldDigest(EXAMPLE_SHALLOW);
    const shown = presentPresets();
    const shown85 = shown.find((preset) => preset.id === "example-85");
    const shownShallow = shown.find((preset) => preset.id === "shallow");

    expect(shown85?.label).toBe("EXAMPLE 6 — 8.5 in hole, 12.4 ppg, spot 15,400 ft MD");
    expect(shownShallow?.label).toBe("EXAMPLE 7 — 6.75 in hole, 11.8 ppg, spot 6,000 ft MD");
    expect(shown85?.inputs.wellName).toBe(EXAMPLE_85_WELL);
    expect(shownShallow?.inputs.wellName).toBe(EXAMPLE_SHALLOW.wellName);
    expect(numericFieldDigest(shown85?.inputs)).toBe(before85);
    expect(numericFieldDigest(shownShallow?.inputs)).toBe(beforeShallow);
    expect(numericFieldDigest(presentPreset(stored85!).inputs)).toBe(before85);
    expect(before85).toBe("a545e2b0c81be5625f0f6bd613c433f71c6829510804167ad3d87c93e5438205");
    expect(beforeShallow).toBe("05a584aab9ab040e9db2dac32faaf65f6bf56c3b36f5d6eaa41dbb6d4d2df2e5");
    expect(EXAMPLE_8_5.wellName).toBe("RIG - WELL");
  });
});
