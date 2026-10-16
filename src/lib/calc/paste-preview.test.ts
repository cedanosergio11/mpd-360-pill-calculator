import { describe, expect, it } from "vitest";
import { EXAMPLE_8_5, EMPTY_INPUTS } from "./examples";
import { applyPaste, applyWellPaste, parseWellPaste, previewPaste } from "./paste";

describe("previewPaste", () => {
  it("writes Current well depth to currentDepthMd only", () => {
    const preview = previewPaste(EXAMPLE_8_5, "Current well depth\t17000\tft");
    expect(preview.canApply).toBe(true);
    expect(preview.errors).toEqual([]);
    const applied = applyPaste(EXAMPLE_8_5, preview);
    expect(applied.currentDepthMd).toBe(17000);
    expect(applied.tdDepth).toBe(EXAMPLE_8_5.tdDepth);
    expect(preview.rows.map((row) => row.field)).toEqual(["currentDepthMd"]);
  });

  it("rejects a bad thousands group and does not apply", () => {
    for (const raw of ["1,5", "1,50", "1,2345"]) {
      const preview = previewPaste(EXAMPLE_8_5, `Spot depth MD\t${raw}\tft`);
      expect(preview.canApply).toBe(false);
      expect(preview.errors.map((error) => error.code)).toEqual(["BAD_NUMBER"]);
      expect(() => applyPaste(EXAMPLE_8_5, preview)).toThrow(/blocked/);
    }
    const ok = previewPaste(EMPTY_INPUTS, "Desired EMW\t1,234.5\tppg\nPump displacement\t1,500");
    expect(ok.canApply).toBe(true);
    const applied = applyPaste(EMPTY_INPUTS, ok);
    expect(applied.desiredEmw).toBe(1234.5);
    expect(applied.pumpDisp).toBe(1500);
  });

  it("keeps the sheet TVD when only the MD is pasted", () => {
    const preview = previewPaste(EXAMPLE_8_5, "Anchor point MD\t12000\tft");
    expect(preview.canApply).toBe(true);
    const applied = applyPaste(EXAMPLE_8_5, preview);
    expect(applied.anchorMd).toBe(12000);
    expect(applied.anchorTvd).toBe(EXAMPLE_8_5.anchorTvd);
    expect(preview.rows.some((row) => row.field === "anchorTvd")).toBe(false);
  });

  it("keeps a TVD pasted with its MD", () => {
    const preview = previewPaste(
      EXAMPLE_8_5,
      "Anchor point MD\t12000\tft\nAnchor point TVD\t11111\tft",
    );
    expect(preview.canApply).toBe(true);
    expect(applyPaste(EXAMPLE_8_5, preview).anchorTvd).toBe(11111);
  });

  it("applies a spot MD inside TD and keeps the sheet TVD", () => {
    const preview = previewPaste(
      EXAMPLE_8_5,
      ["Well name\tEXAMPLE", "Current MW\t12.4", "Spot depth MD\t16000\tft"].join("\n"),
    );
    expect(preview.canApply).toBe(true);
    const applied = applyPaste(EXAMPLE_8_5, preview);
    expect(applied.spotMd).toBe(16000);
    expect(applied.spotTvd).toBe(EXAMPLE_8_5.spotTvd);
  });

  it("blocks an anchor MD past TD", () => {
    const preview = previewPaste(EXAMPLE_8_5, "Anchor point MD\t20000\tft");
    expect(preview.canApply).toBe(false);
    expect(preview.errors[0]?.code).toBe("DEPTH_BEYOND_TD");
    expect(preview.errors[0]?.fields).toEqual(
      expect.arrayContaining([
        { label: "Anchor point MD", value: 20000, limit: 17650, limitLabel: "TD" },
        { label: "Anchor point MD", value: 20000, limit: 17650, limitLabel: "bit MD" },
      ]),
    );
    expect(() => applyPaste(EXAMPLE_8_5, preview)).toThrow(/blocked/);
  });

  it("applies a bit MD inside TD", () => {
    const preview = previewPaste(EXAMPLE_8_5, "Current well depth\t17000\tft");
    expect(preview.canApply).toBe(true);
    expect(applyPaste(EXAMPLE_8_5, preview).currentDepthMd).toBe(17000);
  });

  it("applies a shoe MD inside TD and keeps the sheet TVD", () => {
    const preview = previewPaste(EXAMPLE_8_5, "Casing depth MD\t16000\tft");
    expect(preview.canApply).toBe(true);
    const applied = applyPaste(EXAMPLE_8_5, preview);
    expect(applied.casingMd).toBe(16000);
    expect(applied.casingTvd).toBe(EXAMPLE_8_5.casingTvd);
  });

  it("blocks a depth past TD with the field list", () => {
    const preview = previewPaste(EXAMPLE_8_5, "Current well depth\t18000\tft");
    expect(preview.canApply).toBe(false);
    const depth = preview.errors.find((error) => error.code === "DEPTH_BEYOND_TD");
    expect(depth?.fields).toEqual(
      expect.arrayContaining([
        { label: "Current well depth", value: 18000, limit: 17650, limitLabel: "TD" },
      ]),
    );
  });

  it("leaves the loose sheet parser unchanged", () => {
    const loose = parseWellPaste("Current well depth\t1,5\tft\nWell name\tEXAMPLE");
    expect(loose.patch.currentDepthMd).toBe(15);
    expect(loose.patch.wellName).toBe("EXAMPLE");
    expect(applyWellPaste(EMPTY_INPUTS, loose.patch).pillMode).toBe(EMPTY_INPUTS.pillMode);
  });
});
