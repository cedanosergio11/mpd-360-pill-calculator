import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { emwProfile } from "@/contract";
import { EmwBody, type Ok } from "@/components/emw";
import { mockProfile } from "@/components/__mock__/emw-mock";
import { exampleC } from "@/lib/example-b";

const html = (p: Ok, print = false) => renderToStaticMarkup(createElement(EmwBody, { p, view: "both", print }));

describe("EMW screen optional contract fields", () => {
  it("hides exceedance and shoe-check sections when the contract omits them", () => {
    const r = emwProfile(exampleC);
    expect(r.ok).toBe(true);
    const out = html(r as Ok);
    expect(out).not.toContain("emw-shoe-check");
    expect(out).not.toContain("emw-exceedances");
    expect(out).not.toContain("data-emw-band");
  });
  it("renders mocked shoeCheck and exceedances verbatim (MOCK)", () => {
    const ex = [{ fromTvd_ft: 9486, toTvd_ft: 10466, fromMd_ft: 9500, toMd_ft: 10480, line: "staticSbp" as const, pillState: "spotted" as const, limit: "fit" as const, maxEmw_ppg: 13.155383 }];
    const p = mockProfile(exampleC, ex);
    for (const print of [false, true]) {
      const out = html(p, print);
      expect(out.match(/data-emw-shoe-row=/g)?.length).toBe(6);
      expect(out).toMatch(/data-emw-shoe-row="inPlace.staticSbp".*?-48.74<\/td><td><span data-emw-shoe-flag="over"/);
      expect(out.match(/data-emw-band=/g)?.length).toBe(1);
      expect(out).toContain("9486–10466");
    }
  });
});
