import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { bitTvd } from "@/lib/calc/depth";
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
  it("keys off a null bit TVD, not the calc result code", () => {
    expect(bitEcdCell(null, 12.8)).toBe("needs survey to bit");
    expect(bitDifferenceCell(null)).toBe("needs survey to bit");
    expect(bitEcdCell(11250, 12.814)).toBe("12.81 ppg no sheet value at bit");
    expect(bitDifferenceCell(11250)).toBe("no sheet value at bit");
  });

  it("EXAMPLE 8.5 at 17649 says needs survey to bit in both columns", () => {
    const inputs = { ...EXAMPLE_8_5, currentDepthMd: 17649 as const };
    expect(bitTvd(inputs)).toBeNull();
    expect(calculate(inputs).depthBlock).toBeNull();
    const cells = bitCells(inputs);
    expect(cells.ecd).toContain("needs survey to bit");
    expect(cells.difference).toContain("needs survey to bit");
    expect(cells.html).not.toMatch(/trip speed/i);
    expect(cells.html).not.toMatch(/swab/i);
  });

  it("shows the RP 13D ECD and no sheet value when the bit has a TVD", () => {
    const inputs = { ...EXAMPLE_8_5, currentDepthMd: 15400 };
    expect(bitTvd(inputs)).not.toBeNull();
    const cells = bitCells(inputs);
    expect(cells.ecd).toContain("no sheet value at bit");
    expect(cells.ecd).not.toContain("needs survey to bit");
    expect(cells.difference).toContain("no sheet value at bit");
    expect(cells.difference).not.toContain("needs survey to bit");
  });
});
