import { describe, expect, it } from "vitest";
import { exampleB, exampleC } from "@/lib/example-b";
import { columnDisplacedByPipe, esdAtMd } from "./column";
import {
  emwProfile,
  type EmwPoint,
  type EmwProfileValue,
  type EmwStationLabel,
} from "./emw-profile";
import type { Job } from "./job.schema";
import { PSI_PER_PPG_FT } from "./result";
import { tvdAt } from "./tvd";

function at(points: EmwPoint[], md: number): EmwPoint {
  const point = points.find((item) => Math.abs(item.md_ft - md) < 0.05);
  if (!point) throw new Error(`no station at ${md}`);
  return point;
}

function labeled(result: EmwProfileValue, label: EmwStationLabel) {
  const station = result.stations.find((item) => item.label === label);
  if (!station) throw new Error(`no ${label}`);
  return station;
}

function bitStaticHand(): number {
  const mudTvd = 8046;
  const pillTvd = 10466 - 8046;
  return (11.4 * mudTvd + 14 * pillTvd) / 10466;
}

describe("emwProfile EXAMPLE B and C", () => {
  it("stacks the entered column at the shoe, anchor, and bit", () => {
    const result = emwProfile(exampleB);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.limits.pore_ppg).toBeNull();
    expect(result.limits.fit_ppg).toBe(12.6);
    expect(
      result.crossings.some((flag) => flag.pillState === "inPlace" && flag.limit === "pore"),
    ).toBe(false);
    expect(
      result.crossings.some((flag) => flag.pillState === "spotted" && flag.limit === "pore"),
    ).toBe(false);
    expect(result.crossings.length).toBeGreaterThan(0);
    expect(Object.keys(result.crossings[0]).sort()).toEqual([
      "limit",
      "line",
      "pillState",
      "tvd_ft",
    ]);

    expect(result.stations.map((station) => station.label)).toEqual(["shoe", "anchor", "bit"]);
    const shoe = labeled(result, "shoe");
    const anchor = labeled(result, "anchor");
    const bit = labeled(result, "bit");
    expect(shoe.md_ft).toBe(8045);
    expect(shoe.tvd_ft).toBe(8033);
    expect(anchor.md_ft).toBe(10480);
    expect(anchor.tvd_ft).toBe(10466);
    expect(bit.md_ft).toBe(10480);
    expect(bit.tvd_ft).toBe(10466);
    expect(result.stations.filter((station) => station.md_ft === 10480)).toHaveLength(2);

    const shoeStatic = at(result.inPlace.lines.static, 8045);
    const bitStatic = at(result.inPlace.lines.static, 10480);
    expect(shoeStatic.emw_ppg).toBeCloseTo(11.4, 6);
    expect(bitStatic.emw_ppg).toBeCloseTo(bitStaticHand(), 6);
    expect(shoe.emw.inPlace.static).toBeCloseTo(shoeStatic.emw_ppg, 8);
    expect(bit.emw.inPlace.static).toBeCloseTo(bitStatic.emw_ppg, 8);
    expect(anchor.emw.inPlace).toEqual(bit.emw.inPlace);
    expect(at(result.inPlace.lines.staticSbp, 8045).emw_ppg).toBeCloseTo(
      11.4 + 325 / (PSI_PER_PPG_FT * 8033),
      6,
    );
    expect(at(result.inPlace.lines.staticSbp, 10480).emw_ppg).toBeCloseTo(
      bitStaticHand() + 325 / (PSI_PER_PPG_FT * 10466),
      6,
    );
    expect(shoe.emw.inPlace.staticSbp).toBeCloseTo(
      at(result.inPlace.lines.staticSbp, 8045).emw_ppg,
      8,
    );
    expect(tvdAt(exampleB.well, 8060)).toBe(8046);

    const displaced = columnDisplacedByPipe(exampleB, exampleB.well.bitMd_ft);
    expect(displaced).not.toBeNull();
    if (!displaced) return;
    expect(at(result.spotted.lines.static, 8045).emw_ppg).toBeCloseTo(esdAtMd(displaced, 8045)!, 8);
    expect(at(result.spotted.lines.static, 10480).emw_ppg).toBeCloseTo(
      esdAtMd(displaced, 10480)!,
      8,
    );
    expect(shoe.emw.spotted.static).toBeCloseTo(at(result.spotted.lines.static, 8045).emw_ppg, 8);
    expect(at(result.spotted.lines.static, 8045).emw_ppg).toBeGreaterThan(11.4);

    const mds = result.inPlace.lines.static.map((point) => point.md_ft);
    expect(mds).toEqual([...mds].sort((a, b) => a - b));
    expect(result.stations).toHaveLength(3);
    expect(result.inPlace.lines.static).toHaveLength(106);
    expect(result.inPlace.lines.ecd).toHaveLength(106);
    expect(result.spotted.lines.ecd).toHaveLength(106);
    expect(result.spotted.lines.ecd[0].md_ft).toBe(result.inPlace.lines.static[0].md_ft);
  });

  it("keeps EXAMPLE C static and ECD on the EXAMPLE B column and moves only connection SBP", () => {
    const base = emwProfile(exampleB);
    const result = emwProfile(exampleC);
    expect(base.ok && result.ok).toBe(true);
    if (!base.ok || !result.ok) return;
    for (const md of [8045, 10480]) {
      expect(at(result.inPlace.lines.static, md).emw_ppg).toBeCloseTo(
        at(base.inPlace.lines.static, md).emw_ppg,
        8,
      );
      expect(at(result.inPlace.lines.ecd, md).emw_ppg).toBeCloseTo(
        at(base.inPlace.lines.ecd, md).emw_ppg,
        8,
      );
      expect(at(result.spotted.lines.static, md).emw_ppg).toBeCloseTo(
        at(base.spotted.lines.static, md).emw_ppg,
        8,
      );
      expect(at(result.spotted.lines.ecd, md).emw_ppg).toBeCloseTo(
        at(base.spotted.lines.ecd, md).emw_ppg,
        8,
      );
    }
    expect(at(result.inPlace.lines.staticSbp, 8045).emw_ppg).toBeCloseTo(
      11.4 + 550 / (PSI_PER_PPG_FT * 8033),
      6,
    );
    expect(at(result.inPlace.lines.staticSbp, 10480).emw_ppg).toBeCloseTo(
      bitStaticHand() + 550 / (PSI_PER_PPG_FT * 10466),
      6,
    );
    expect(labeled(result, "shoe").emw.inPlace.staticSbp).toBeCloseTo(
      11.4 + 550 / (PSI_PER_PPG_FT * 8033),
      6,
    );
    expect(result.limits.pore_ppg).toBeNull();
  });

  it("draws a vertical pore line only when pore is entered", () => {
    const job: Job = structuredClone(exampleB);
    job.well.porePressure_ppg = 12;
    const result = emwProfile(job);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.limits.pore_ppg).toBe(12);
    expect(
      result.crossings.some((flag) => flag.pillState === "inPlace" && flag.limit === "pore"),
    ).toBe(true);
    expect(result.crossings.every((flag) => flag.limit === "pore" || flag.limit === "fit")).toBe(
      true,
    );
  });

  it("returns MISSING_FIT and no line when FIT is blank", () => {
    const job: Job = {
      ...exampleB,
      well: { ...exampleB.well, fit_ppg: null as unknown as number },
    };
    expect(emwProfile(job)).toEqual({
      ok: false,
      error: { code: "MISSING_FIT", field: "well.fit_ppg", message: "FIT is missing." },
    });
  });

  it("does not invent a pore value when the entered pore is not finite", () => {
    const job: Job = structuredClone(exampleB);
    job.well.porePressure_ppg = Number.NaN;
    const result = emwProfile(job);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("well.porePressure_ppg");
    expect(JSON.stringify(result)).not.toMatch(/11\.4/);
  });
});
