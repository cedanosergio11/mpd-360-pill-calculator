import { describe, expect, it } from "vitest";
import { inputHash } from "@/contract";
import { exampleC } from "@/lib/example-b";
import { parseSaved, toSaved } from "@/lib/store";

describe("saved job presetBaseline", () => {
  it("loads an old save without presetBaseline with no baseline", () => {
    const p = parseSaved(JSON.stringify(exampleC));
    expect(p).not.toBeNull();
    expect(p!.baselineHash).toBeNull();
    expect(inputHash(p!.job)).toBe(inputHash(exampleC));
  });
  it("round-trips presetBaseline without changing the job hash", () => {
    const base = inputHash(exampleC);
    const edited = { ...exampleC, trip: { ...exampleC.trip, sbpConn_psi: 560 } };
    const saved = toSaved(edited, base);
    expect(saved.presetBaseline).toBe(base);
    const p = parseSaved(JSON.stringify(saved))!;
    expect(p.baselineHash).toBe(base);
    expect("presetBaseline" in p.job).toBe(false);
    expect(inputHash(p.job)).toBe(inputHash(edited));
    expect(inputHash(p.job)).not.toBe(base);
  });
  it("omits presetBaseline when there is no baseline", () => {
    expect("presetBaseline" in toSaved(exampleC, null)).toBe(false);
  });
});
