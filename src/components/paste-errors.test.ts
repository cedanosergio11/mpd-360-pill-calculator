import { describe, expect, it } from "vitest";
import type { PastePreviewError } from "@/lib/calc/paste";
import { toUiErrors } from "./paste-errors";

describe("paste refusal messages", () => {
  it("deeper than MD", () => {
    const [e] = toUiErrors([{ code: "TVD_DEEPER_THAN_MD", fields: ["casingTvd"], message: "x", blocking: true }]);
    expect(e.lines).toEqual(["Shoe TVD is deeper than its MD. Check the TVD cell in the sheet; TVD can equal MD but not exceed it."]);
    expect(e.highlight).toEqual(["casingTvd"]);
  });
  it("out of order, shallower MD first", () => {
    const [e] = toUiErrors([{ code: "TVD_OUT_OF_ORDER", fields: ["casingTvd", "anchorTvd"], message: "x", blocking: true }]);
    expect(e.lines).toEqual(["Shoe and Anchor are out of order: Anchor is deeper in MD but shallower in TVD. Check both rows in the sheet."]);
    expect(e.highlight).toEqual(["casingTvd", "anchorTvd"]);
  });
  it("unknown code falls back to the server message; several errors all kept", () => {
    const out = toUiErrors([
      { code: "SOMETHING_NEW", message: "Server says no.", blocking: true } as unknown as PastePreviewError,
      { code: "TVD_DEEPER_THAN_MD", fields: ["spotTvd"], message: "x", blocking: true },
    ]);
    expect(out.map((e) => e.lines[0])).toEqual([
      "Server says no.",
      "Spot TVD is deeper than its MD. Check the TVD cell in the sheet; TVD can equal MD but not exceed it.",
    ]);
  });
});
