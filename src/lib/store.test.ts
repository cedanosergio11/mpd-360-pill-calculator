import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc/engine";
import { EMPTY_INPUTS, EXAMPLE_8_5 } from "@/lib/calc/examples";
import { surveyTvdAt } from "@/lib/calc/depth";
import type { WellInputs } from "@/lib/calc/types";
import { useAppStore } from "@/lib/store";

/** EXAMPLE depths, with no client or well name. */
const EXAMPLE_5: WellInputs = {
  ...EMPTY_INPUTS,
  wellName: "EXAMPLE",
  client: "",
  date: "2026-10-05",
  sectionType: "Intermediate",
  pillMode: "noSlug",
  currentDepthMd: 10530,
  anchorMd: 10480,
  anchorTvd: 10466,
  casingMd: 3199,
  casingTvd: 3187,
  spotMd: 10480,
  spotTvd: 10466,
  openHoleDia: 12.25,
  odDp: 5.5,
  idDp: 4.778,
  idCasing: 12.515,
  currentMw: 11.4,
  kmw: 14,
  desiredEmw: 12,
  sbpConnection: 325,
  fit: 12.6,
  maxFlowRate: 300,
  initialFlowRate: 300,
  safevisionNoSlug: 11.5,
  pumpDisp: 0.0914,
  desiredResolution: 30,
  overbalanceSlug: 300,
  taperedOn: false,
  tdDepth: "",
};

describe("setField survey TVD", () => {
  it("blocks an EXAMPLE anchor moved from 10480 to 10500 instead of keeping TVD 10466", () => {
    useAppStore.getState().setInputs(EXAMPLE_5);
    useAppStore.getState().setField("anchorMd", 10500);
    const { inputs, editBlock } = useAppStore.getState();
    expect(inputs.anchorMd).toBe(10480);
    expect(inputs.anchorTvd).toBe(10466);
    expect(editBlock).toEqual({
      code: "MD_BEYOND_SURVEY",
      fields: [
        {
          label: "Anchor point MD",
          value: 10500,
          limit: 10480,
          limitLabel: "last survey station",
        },
      ],
    });
    const onSheet = calculate(inputs);
    const stale = calculate({ ...EXAMPLE_5, anchorMd: 10500, anchorTvd: 10466 });
    expect(onSheet.depthBlock).toBeNull();
    expect(onSheet.cement.bocToShoe).toBe(calculate(EXAMPLE_5).cement.bocToShoe);
    expect(onSheet.cement.bocToShoe).not.toBe(stale.cement.bocToShoe);
    expect(onSheet.heightPillNoDp).toBe(2420);
  });

  it("recomputes anchor TVD when the new MD is still inside the other stations", () => {
    useAppStore.getState().setInputs(EXAMPLE_5);
    useAppStore.getState().setField("anchorMd", 8000);
    const { inputs, editBlock } = useAppStore.getState();
    const expected = surveyTvdAt({ ...EXAMPLE_5, anchorMd: "", anchorTvd: "" }, 8000);
    expect(editBlock).toBeNull();
    expect(inputs.anchorMd).toBe(8000);
    expect(expected).not.toBeNull();
    expect(inputs.anchorTvd).toBeCloseTo(expected!, 6);
    expect(inputs.anchorTvd).not.toBe(10466);
  });

  it("stores a bit MD past the last survey station and does not set editBlock", () => {
    useAppStore.getState().setInputs(EXAMPLE_8_5);
    useAppStore.getState().setField("currentDepthMd", 17000);
    const { inputs, editBlock } = useAppStore.getState();
    expect(editBlock).toBeNull();
    expect(inputs.currentDepthMd).toBe(17000);
    expect(calculate(inputs).depthBlock).toBeNull();
    useAppStore.getState().setInputs(EXAMPLE_8_5);
  });

  it("blocks shoe, anchor, and spot edits past the last survey station", () => {
    useAppStore.getState().setInputs(EXAMPLE_8_5);
    useAppStore.getState().setField("casingMd", 16000);
    expect(useAppStore.getState().inputs.casingMd).toBe(EXAMPLE_8_5.casingMd);
    expect(useAppStore.getState().editBlock).toEqual({
      code: "MD_BEYOND_SURVEY",
      fields: [{ label: "Casing depth MD", value: 16000, limit: 15400, limitLabel: "last survey station" }],
    });
    expect(calculate(useAppStore.getState().inputs).depthBlock).toBeNull();

    useAppStore.getState().setInputs(EXAMPLE_8_5);
    useAppStore.getState().setField("anchorMd", 20000);
    expect(useAppStore.getState().inputs.anchorMd).toBe(EXAMPLE_8_5.anchorMd);
    expect(useAppStore.getState().editBlock?.code).toBe("MD_BEYOND_SURVEY");
    expect(useAppStore.getState().editBlock?.fields).toEqual([
      { label: "Anchor point MD", value: 20000, limit: 15400, limitLabel: "last survey station" },
    ]);

    useAppStore.getState().setInputs(EXAMPLE_8_5);
    useAppStore.getState().setField("spotMd", 16000);
    expect(useAppStore.getState().inputs.spotMd).toBe(EXAMPLE_8_5.spotMd);
    expect(useAppStore.getState().editBlock).toEqual({
      code: "MD_BEYOND_SURVEY",
      fields: [{ label: "Spot depth MD", value: 16000, limit: 13900, limitLabel: "last survey station" }],
    });
    useAppStore.getState().setInputs(EXAMPLE_8_5);
  });
});
