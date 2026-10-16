import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { calculate } from "@/lib/calc/engine";
import { EXAMPLE_8_5 } from "@/lib/calc/examples";
import { Rp13dView, bitDifferenceCell, bitEcdCell } from "./view";

function bitCells(inputs: typeof EXAMPLE_8_5) {
  const html = renderToStaticMarkup(createElement(Rp13dView, { inputs, results: calculate(inputs) }));
  const row = html.split('data-rp13d-depth="bit"')[1]?.split("</tr>")[0] ?? "";
  return {
    html,
    ecd: row.split('data-rp13d-column="ecd"')[1]?.split("</td>")[0] ?? "",
    difference: row.split('data-rp13d-column="difference"')[1]?.split("</td>")[0] ?? "",
  };
}

describe("RP 13D bit row", () => {
  it("says the sheet paste has no bit TVD", () => {
    expect(bitEcdCell()).toBe("bit TVD not in sheet paste");
    expect(bitDifferenceCell()).toBe("bit TVD not in sheet paste");
  });

  it("EXAMPLE 8.5 shows that reason in both bit columns", () => {
    const cells = bitCells(EXAMPLE_8_5);
    expect(calculate(EXAMPLE_8_5).depthBlock).toBeNull();
    expect(cells.ecd).toContain("bit TVD not in sheet paste");
    expect(cells.difference).toContain("bit TVD not in sheet paste");
    expect(cells.html).not.toMatch(/trip speed/i);
    expect(cells.html).not.toMatch(/swab/i);
  });
});
