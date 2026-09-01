import { describe, expect, it } from "vitest";
import { annularBblFt, capBblFt } from "../utils";
import { annularBblPerFt, pipeBoreBblPerFt } from "./physics";
import type { WellState } from "./types";
import { DEFAULT_STATE } from "./types";

describe("physics capacities share oilfield d²/1029.4", () => {
  it("matches capBblFt / annularBblFt for 3.7 / 4.5 / 6.88 in", () => {
    const state: WellState = {
      ...DEFAULT_STATE,
      holeId: 6.88,
      pipeOd: 4.5,
      pipeId: 3.7,
    };
    expect(pipeBoreBblPerFt(state)).toBe(capBblFt(3.7));
    expect(annularBblPerFt(state)).toBe(annularBblFt(6.88, 4.5));
  });
});
