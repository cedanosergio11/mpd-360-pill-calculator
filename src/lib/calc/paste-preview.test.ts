import { describe, expect, it } from "vitest";
import { EXAMPLE_8_5, EMPTY_INPUTS, PRESETS } from "./examples";
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

  it("reports which sheet TVDs the paste carried", () => {
    expect(previewPaste(EXAMPLE_8_5, "Current well depth\t17000\tft").foundTvds).toEqual({
      anchorTvd: false,
      casingTvd: false,
      spotTvd: false,
    });
    expect(previewPaste(EXAMPLE_8_5, "Anchor point TVD\t11111\tft").foundTvds).toEqual({
      anchorTvd: true,
      casingTvd: false,
      spotTvd: false,
    });
    expect(
      previewPaste(
        EXAMPLE_8_5,
        ["Anchor point TVD\t11111\tft", "Casing depth TVD\t10100\tft", "Spot depth TVD\t11000\tft"].join("\n"),
      ).foundTvds,
    ).toEqual({ anchorTvd: true, casingTvd: true, spotTvd: true });
    const bad = previewPaste(EXAMPLE_8_5, "Anchor point TVD\t1,5\tft\nSpot depth TVD\t11000\tft");
    expect(bad.canApply).toBe(false);
    expect(bad.foundTvds).toEqual({ anchorTvd: false, casingTvd: false, spotTvd: true });
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
    const preview = previewPaste(EXAMPLE_8_5, "Casing depth MD\t12000\tft");
    expect(preview.canApply).toBe(true);
    const applied = applyPaste(EXAMPLE_8_5, preview);
    expect(applied.casingMd).toBe(12000);
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

  it("refuses a TVD strictly deeper than its own MD, one error per field", () => {
    const preview = previewPaste(
      EMPTY_INPUTS,
      ["Anchor point MD\t8000\tft", "Anchor point TVD\t9000\tft", "Spot depth MD\t7000\tft", "Spot depth TVD\t7001\tft"].join("\n"),
    );
    expect(preview.canApply).toBe(false);
    expect(preview.errors).toEqual([
      expect.objectContaining({ code: "TVD_DEEPER_THAN_MD", fields: ["anchorTvd"] }),
      expect.objectContaining({ code: "TVD_DEEPER_THAN_MD", fields: ["spotTvd"] }),
    ]);
    expect(preview.errors.every((error) => error.fields?.every((field) => typeof field === "string"))).toBe(true);
    expect(preview.foundTvds).toEqual({ anchorTvd: true, casingTvd: false, spotTvd: true });
    expect(() => applyPaste(EMPTY_INPUTS, preview)).toThrow(/blocked/);
  });

  it("refuses a deeper MD with a strictly shallower TVD", () => {
    const preview = previewPaste(
      EMPTY_INPUTS,
      [
        "Casing depth MD\t8000\tft",
        "Casing depth TVD\t7000\tft",
        "Anchor point MD\t9000\tft",
        "Anchor point TVD\t4000\tft",
      ].join("\n"),
    );
    expect(preview.canApply).toBe(false);
    expect(preview.errors).toEqual([
      expect.objectContaining({
        code: "TVD_OUT_OF_ORDER",
        fields: ["casingTvd", "anchorTvd"],
        message: expect.any(String),
      }),
    ]);
    expect(preview.foundTvds).toEqual({ anchorTvd: true, casingTvd: true, spotTvd: false });
    expect(() => applyPaste(EMPTY_INPUTS, preview)).toThrow(/blocked/);
    const belowAnchor = previewPaste(EXAMPLE_8_5, "Casing depth MD\t16000\tft");
    expect(belowAnchor.canApply).toBe(false);
    expect(belowAnchor.errors).toEqual([
      expect.objectContaining({ code: "TVD_OUT_OF_ORDER", fields: ["anchorTvd", "casingTvd"] }),
      expect.objectContaining({ code: "TVD_OUT_OF_ORDER", fields: ["spotTvd", "casingTvd"] }),
    ]);
    expect(belowAnchor.foundTvds).toEqual({ anchorTvd: false, casingTvd: false, spotTvd: false });
  });

  it("accepts a TVD equal to its MD", () => {
    const preview = previewPaste(EMPTY_INPUTS, ["Anchor point MD\t10000\tft", "Anchor point TVD\t10000\tft"].join("\n"));
    expect(preview.errors).toEqual([]);
    expect(preview.canApply).toBe(true);
    expect(applyPaste(EMPTY_INPUTS, preview).anchorTvd).toBe(10000);
    expect(applyPaste(EMPTY_INPUTS, preview).anchorMd).toBe(10000);
  });

  it("accepts the MD and TVD pairs on all seven presets", () => {
    expect(PRESETS).toHaveLength(7);
    for (const preset of PRESETS) {
      const text = [
        ["Anchor point MD", preset.inputs.anchorMd],
        ["Anchor point TVD", preset.inputs.anchorTvd],
        ["Casing depth MD", preset.inputs.casingMd],
        ["Casing depth TVD", preset.inputs.casingTvd],
        ["Spot depth MD", preset.inputs.spotMd],
        ["Spot depth TVD", preset.inputs.spotTvd],
      ]
        .filter(([, value]) => value !== "" && value != null)
        .map(([label, value]) => `${label}\t${value}\tft`)
        .join("\n");
      const preview = previewPaste(preset.inputs, text);
      expect(preview.errors, preset.label).toEqual([]);
      expect(preview.canApply, preset.label).toBe(true);
    }
  });

  it("leaves the loose sheet parser unchanged", () => {
    const loose = parseWellPaste("Current well depth\t1,5\tft\nWell name\tEXAMPLE");
    expect(loose.patch.currentDepthMd).toBe(15);
    expect(loose.patch.wellName).toBe("EXAMPLE");
    expect(applyWellPaste(EMPTY_INPUTS, loose.patch).pillMode).toBe(EMPTY_INPUTS.pillMode);
  });
});
