import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc/engine";
import { EMPTY_INPUTS } from "@/lib/calc/examples";
import { surveyTvdAt } from "@/lib/calc/depth";
import type { WellInputs } from "@/lib/calc/types";
import { useAppStore } from "@/lib/store";

/** Lock Sub depths, with the client and well name removed. */
const LOCK_SUB: WellInputs = {
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
  it("blocks a Lock Sub anchor moved from 10480 to 10500 instead of keeping TVD 10466", () => {
    useAppStore.getState().setInputs(LOCK_SUB);
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
    const stale = calculate({ ...LOCK_SUB, anchorMd: 10500, anchorTvd: 10466 });
    expect(onSheet.depthBlock).toBeNull();
    expect(onSheet.cement.bocToShoe).toBe(calculate(LOCK_SUB).cement.bocToShoe);
    expect(onSheet.cement.bocToShoe).not.toBe(stale.cement.bocToShoe);
    expect(onSheet.heightPillNoDp).toBe(2420);
  });

  it("recomputes anchor TVD when the new MD is still inside the other stations", () => {
    useAppStore.getState().setInputs(LOCK_SUB);
    useAppStore.getState().setField("anchorMd", 8000);
    const { inputs, editBlock } = useAppStore.getState();
    const expected = surveyTvdAt({ ...LOCK_SUB, anchorMd: "", anchorTvd: "" }, 8000);
    expect(editBlock).toBeNull();
    expect(inputs.anchorMd).toBe(8000);
    expect(expected).not.toBeNull();
    expect(inputs.anchorTvd).toBeCloseTo(expected!, 6);
    expect(inputs.anchorTvd).not.toBe(10466);
  });
});
