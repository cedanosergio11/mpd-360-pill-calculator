import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emwProfile, kpiVolumes } from "@/contract";
import { EmwBody, rihShoeNote, type Ok } from "@/components/emw";
import { exampleB, exampleC } from "@/lib/example-b";

const html = (p: Ok, print = false) => renderToStaticMarkup(createElement(EmwBody, { p, view: "both", print }));
const kpiMargin = (j: typeof exampleB) => { const k = kpiVolumes(j, { surfaceLine_bbl: 0 }); if (!k.ok) throw new Error("kpi"); return k.masp.margin_psi; };

describe("EMW screen on the real contract", () => {
  it("renders 6 shoe rows, exceedance bands and contract labels, screen and print", () => {
    for (const [job, bands] of [[exampleC, 2], [exampleB, 1]] as const) {
      const p = emwProfile(job) as Ok;
      for (const print of [false, true]) {
        const out = html(p, print);
        expect(out.match(/data-emw-shoe-row=/g)?.length).toBe(6);
        expect(out.match(/data-emw-band=/g)?.length).toBe(bands);
        expect(out).toContain(p.spotted.label);
      }
    }
  });
});

describe("KPI RIH shoe note", () => {
  it("shows for EXAMPLE C with the spotted static+SBP margin", () => {
    expect(rihShoeNote(kpiMargin(exampleC), emwProfile(exampleC))).toBe("After RIH the pill covers the shoe; see shoe check, -125.14 psi.");
  });
  it("is hidden for EXAMPLE B (row not over)", () => {
    expect(rihShoeNote(kpiMargin(exampleB), emwProfile(exampleB))).toBeNull();
  });
  it("is hidden when the row is over but not tighter than the KPI margin", () => {
    expect(rihShoeNote(-500, emwProfile(exampleC))).toBeNull();
  });
  it("is hidden on an error profile", () => {
    expect(rihShoeNote(0, { ok: false, notes: [], error: { code: "MISSING_FIT", field: "well.fit_ppg", message: "FIT is missing." } })).toBeNull();
  });
});
