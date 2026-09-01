import { describe, expect, it } from "vitest";
import { applyWellPaste, parseWellPaste } from "./paste";
import { EMPTY_INPUTS } from "./examples";

const tsv = [
  "Well name\t\tMomentum 5-12-12 HU2",
  "Client\t\tPaloma/Apex",
  "Date\t\t8.19.26",
  "Produced By\t\tDonald Sehr",
  "Current Well Depth (MD)\t18889\tft.",
  "Anchor Point (BOC) (MD)\t12281\tft.",
  "Anchor Point (BOC) (TVD)\t11888\tft.",
  "Casing Depth ( MD)\t10428\tft.",
  "Casing Depth (TVD)\t10310\tft.",
  "Spot Depth (MD)\t11527\tft.",
  "Spot Depth (TVD)\t11394\tft.",
  "Open Hole Diameter\t6.75\tin.",
  "Desired EMW @ Anchor Point\t17.4\tppge",
  "OD Drill pipe\t4.5\tin.",
  "ID Drill pipe\t3.7\tin.",
  "ID Casing\t6.88\tin.",
  "Current MW\t15.3\tppg",
  "Pump Displacement\t0.0625\tbbls/stk",
  "KMW\t18.5\tppg",
  "SBP on connection\t1298\tpsi",
  "FIT\t17.1\tppge",
  "Max Flow Rate\t250\tgpm",
  "Desired Resolution\t20\tbbls",
  "Initial Flow Rate\t250\tgpm",
  "Over Balance Pressure For Slug\t300\tpsi",
  "Safevision Anchor Point ECD @ Initial Flow Rate (no Slug)\t16.35\tppge",
  "Is this section Prodcution or Intermediate? (DEFAULT TO PRODUCTION)\tProduction",
].join("\n");

describe("parseWellPaste", () => {
  const { patch, matched } = parseWellPaste(tsv);

  it("maps Momentum workbook fields", () => {
    expect(patch.wellName).toBe("Momentum 5-12-12 HU2");
    expect(patch.client).toBe("Paloma/Apex");
    expect(patch.date).toBe("2026-08-19");
    expect(patch.producedBy).toBe("Donald Sehr");
    expect(patch.currentDepthMd).toBe(18889);
    expect(patch.anchorMd).toBe(12281);
    expect(patch.anchorTvd).toBe(11888);
    expect(patch.spotMd).toBe(11527);
    expect(patch.openHoleDia).toBe(6.75);
    expect(patch.odDp).toBe(4.5);
    expect(patch.idDp).toBe(3.7);
    expect(patch.idCasing).toBe(6.88);
    expect(patch.desiredEmw).toBe(17.4);
    expect(patch.currentMw).toBe(15.3);
    expect(patch.kmw).toBe(18.5);
    expect(patch.pumpDisp).toBe(0.0625);
    expect(patch.fit).toBe(17.1);
    expect(patch.sectionType).toBe("Production");
    expect(patch.safevisionNoSlug).toBe(16.35);
    expect(matched.length).toBeGreaterThanOrEqual(20);
  });

  it("merges without clobbering pill mode", () => {
    const merged = applyWellPaste(EMPTY_INPUTS, patch);
    expect(merged.wellName).toBe("Momentum 5-12-12 HU2");
    expect(merged.pillMode).toBe(EMPTY_INPUTS.pillMode);
  });

  it("does not map calculated MASP", () => {
    const calculated = parseWellPaste("MASP for this Procedure\t1112.7\tpsi\nWell name\tTest Well");
    expect(calculated.patch.wellName).toBe("Test Well");
    expect("masp" in calculated.patch).toBe(false);
  });
});
