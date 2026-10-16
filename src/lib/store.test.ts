import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc/engine";
import { EXAMPLE_8_5 } from "@/lib/calc/examples";
import { simulate } from "@/lib/pill/simulate";
import { localDateInput, useAppStore } from "@/lib/store";

describe("localDateInput", () => {
  it("uses the local calendar day", () => {
    const evening = new Date(2026, 9, 16, 23, 45, 0);
    expect(localDateInput(evening)).toBe("2026-10-16");
    if (evening.getTimezoneOffset() > 0) {
      expect(evening.toISOString().slice(0, 10)).not.toBe("2026-10-16");
    }
    const source = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("export function localDateInput"), source.indexOf("function blankWell"));
    expect(fn).toContain("getFullYear");
    expect(fn).toContain("getDate");
    expect(fn).not.toContain("toISOString");
    const examples = readFileSync(new URL("./calc/examples.ts", import.meta.url), "utf8");
    expect(examples).not.toContain("toISOString");
  });
});

describe("setField", () => {
  it("stores an anchor MD and keeps the sheet TVD", () => {
    useAppStore.getState().setInputs(EXAMPLE_8_5);
    useAppStore.getState().setField("anchorMd", 12000);
    const { inputs } = useAppStore.getState();
    expect(inputs.anchorMd).toBe(12000);
    expect(inputs.anchorTvd).toBe(EXAMPLE_8_5.anchorTvd);
    useAppStore.getState().setInputs(EXAMPLE_8_5);
  });

  it("refuses a bit MD of 17651 with the bit-past-TD check", () => {
    useAppStore.getState().setInputs(EXAMPLE_8_5);
    useAppStore.getState().setField("currentDepthMd", 17651);
    const { inputs } = useAppStore.getState();
    expect(inputs.currentDepthMd).toBe(17651);
    const results = calculate(inputs);
    expect(results.depthBlock).toEqual({
      code: "DEPTH_BEYOND_TD",
      fields: [{ label: "Current well depth", value: 17651, limit: 17650, limitLabel: "TD" }],
    });
    expect(results.procedurePossible).toBe(false);
    expect(simulate(inputs, results, [15400])).toMatchObject({ ok: false, code: "DEPTH_BEYOND_TD" });
    useAppStore.getState().setInputs(EXAMPLE_8_5);
  });
});
