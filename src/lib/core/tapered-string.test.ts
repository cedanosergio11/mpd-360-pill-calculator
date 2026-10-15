import { describe, expect, it } from "vitest";
import { exampleB, exampleC, exampleD } from "@/lib/example-b";
import { capBblFt } from "@/lib/utils";
import { calculate } from "./calculate";
import { columnDisplacedByPipe, esdAtMd } from "./column";
import { emwProfile } from "./emw-profile";
import { intervalVolume } from "./geometry";
import { annularFrictionSegments, ecdPpg, frictionPsi } from "./hydraulics";
import { poohFill } from "./kpi";
import { strokesSchedule } from "./strokes";
import { placedStringSections, stringVolumeBbl, usesTaperedString } from "./string";
import { tvdAt } from "./tvd";

const CROSS_MD = 8480;
const BIT_MD = 10480;

describe("single pipe stays one section", () => {
  it("does not treat EXAMPLE B or C as a taper", () => {
    expect(usesTaperedString(exampleB.well)).toBe(false);
    expect(usesTaperedString(exampleC.well)).toBe(false);
    const placed = placedStringSections(exampleB.well);
    expect(placed).toHaveLength(1);
    expect(placed?.[0]).toMatchObject({
      topMd_ft: 0,
      bottomMd_ft: BIT_MD,
      length_ft: BIT_MD,
      od_in: 5.5,
      id_in: 4.778,
    });
    const b = emwProfile(exampleB);
    const c = emwProfile(exampleC);
    expect(b.ok).toBe(true);
    expect(c.ok).toBe(true);
    if (!b.ok || !c.ok) return;
    expect(b.inPlace.lines.static).toHaveLength(106);
    expect(c.inPlace.lines.static).toHaveLength(106);
    expect(b.crossovers).toEqual([]);
    expect(c.crossovers).toEqual([]);
    expect(b.sections).toEqual([
      {
        label: "5.5 in OD / 4.778 in ID",
        topMd_ft: 0,
        bottomMd_ft: BIT_MD,
        topTvd_ft: 0,
        bottomTvd_ft: 10466,
        id_in: 4.778,
        od_in: 5.5,
      },
    ]);
    expect(c.sections).toEqual(b.sections);
  });
});

describe("EXAMPLE D (tapered)", () => {
  const well = exampleD.well;

  it("places two sections and pins capacity and closed-pipe displacement", () => {
    expect(exampleD.name).toBe("EXAMPLE D (tapered)");
    expect(usesTaperedString(well)).toBe(true);
    expect(well.stringOd_in).toBe(5.5);
    expect(well.stringId_in).toBe(4.778);
    const sections = placedStringSections(well);
    expect(sections).toHaveLength(2);
    expect(sections?.[0]).toMatchObject({
      topMd_ft: 0,
      bottomMd_ft: CROSS_MD,
      length_ft: 8480,
      od_in: 5.5,
      id_in: 4.778,
    });
    expect(sections?.[1]).toMatchObject({
      topMd_ft: CROSS_MD,
      bottomMd_ft: BIT_MD,
      length_ft: 2000,
      od_in: 4,
      id_in: 3.34,
    });
    expect(sections?.[0].capacity_bblFt).toBeCloseTo(capBblFt(4.778), 12);
    expect(sections?.[1].capacity_bblFt).toBeCloseTo(capBblFt(3.34), 12);
    expect(sections?.[0].closedDisplacement_bblFt).toBeCloseTo(capBblFt(5.5), 12);
    expect(sections?.[1].closedDisplacement_bblFt).toBeCloseTo(capBblFt(4), 12);
    expect(stringVolumeBbl(well, 0, CROSS_MD, "capacity")).toBeCloseTo(188.06326823392263, 9);
    expect(stringVolumeBbl(well, CROSS_MD, BIT_MD, "capacity")).toBeCloseTo(21.67398484554109, 9);
    expect(stringVolumeBbl(well, 0, BIT_MD, "capacity")).toBeCloseTo(209.73725307946373, 9);
    expect(stringVolumeBbl(well, 0, CROSS_MD, "closed")).toBeCloseTo(249.19370507091506, 9);
    expect(stringVolumeBbl(well, CROSS_MD, BIT_MD, "closed")).toBeCloseTo(31.086069555080627, 9);
    expect(stringVolumeBbl(well, 0, BIT_MD, "closed")).toBeCloseTo(280.2797746259957, 9);
  });

  it("gives every annular segment its own velocity and friction", () => {
    const segments = annularFrictionSegments(exampleD, BIT_MD, BIT_MD, { kind: "flow" });
    expect(segments).toEqual([
      {
        topMd_ft: 0,
        bottomMd_ft: 8045,
        length_ft: 8045,
        holeId_in: 12.515,
        pipeOd_in: 5.5,
        pipeId_in: 4.778,
        fluidId: "mud",
        density_ppg: 11.4,
        velocity_ftmin: 58.18387266966291,
        laminar: true,
        friction_psi: 52.8794547665897,
      },
      {
        topMd_ft: 8045,
        bottomMd_ft: 8060,
        length_ft: 15,
        holeId_in: 12.25,
        pipeOd_in: 5.5,
        pipeId_in: 4.778,
        fluidId: "mud",
        density_ppg: 11.4,
        velocity_ftmin: 61.37089201877935,
        laminar: true,
        friction_psi: 0.10426928980901387,
      },
      {
        topMd_ft: 8060,
        bottomMd_ft: CROSS_MD,
        length_ft: 420,
        holeId_in: 12.25,
        pipeOd_in: 5.5,
        pipeId_in: 4.778,
        fluidId: "pill",
        density_ppg: 14,
        velocity_ftmin: 61.37089201877935,
        laminar: true,
        friction_psi: 2.9195401146523885,
      },
      {
        topMd_ft: CROSS_MD,
        bottomMd_ft: BIT_MD,
        length_ft: 2000,
        holeId_in: 12.25,
        pipeOd_in: 4,
        pipeId_in: 3.34,
        fluidId: "pill",
        density_ppg: 14,
        velocity_ftmin: 54.84755244755245,
        laminar: true,
        friction_psi: 10.761507934622033,
      },
    ]);
    expect(frictionPsi(exampleD, well.shoeMd_ft, BIT_MD, { kind: "flow" })).toBeCloseTo(
      52.8794547665897,
      9,
    );
    expect(frictionPsi(exampleD, BIT_MD, BIT_MD, { kind: "flow" })).toBeCloseTo(
      66.66477210567314,
      9,
    );
  });

  it("keeps volume and friction continuous at the crossover", () => {
    const above = intervalVolume(well, 0, CROSS_MD, "annular");
    const below = intervalVolume(well, CROSS_MD, BIT_MD, "annular");
    const all = intervalVolume(well, 0, BIT_MD, "annular");
    expect(above).toBeCloseTo(1038.281642340198, 9);
    expect(below).toBeCloseTo(260.4672624829998, 9);
    expect((above ?? 0) + (below ?? 0)).toBeCloseTo(all ?? Number.NaN, 9);

    const capAbove = stringVolumeBbl(well, 0, CROSS_MD, "capacity") ?? 0;
    const capBelow = stringVolumeBbl(well, CROSS_MD, BIT_MD, "capacity") ?? 0;
    expect(capAbove + capBelow).toBeCloseTo(stringVolumeBbl(well, 0, BIT_MD, "capacity") ?? NaN, 9);

    const atCross = frictionPsi(exampleD, CROSS_MD, BIT_MD, { kind: "flow" }) ?? Number.NaN;
    const atBit = frictionPsi(exampleD, BIT_MD, BIT_MD, { kind: "flow" }) ?? Number.NaN;
    const segments = annularFrictionSegments(exampleD, BIT_MD, BIT_MD, { kind: "flow" }) ?? [];
    const lower = segments
      .filter((segment) => segment.topMd_ft >= CROSS_MD - 1e-6)
      .reduce((sum, segment) => sum + segment.friction_psi, 0);
    expect(atCross).toBeCloseTo(55.903264171051106, 9);
    expect(atBit - atCross).toBeCloseTo(lower, 9);
  });

  it("counts strokes to the bit from the tapered pill capacity", () => {
    const schedule = strokesSchedule(exampleD, calculate(exampleD));
    expect(schedule.ok).toBe(true);
    if (!schedule.ok) return;
    expect(schedule.bblPerStk).toBeCloseTo(0.10182672, 9);
    const last = schedule.rows[schedule.rows.length - 1];
    expect(last.cum_bbl).toBeCloseTo(30.988439168447634, 9);
    expect(last.cumStrokes).toBeCloseTo(304.3252219893524, 9);
    expect(stringVolumeBbl(well, 8060, BIT_MD, "capacity")).toBeCloseTo(30.988439168447634, 9);
  });

  it("spots the pill on the tapered displacement and pins shoeCheck", () => {
    const spotted = columnDisplacedByPipe(exampleD, BIT_MD);
    const pill = spotted?.column.find((segment) => segment.fluidId === "pill");
    expect(pill?.topMd_ft).toBeCloseTo(7705.472909148134, 6);
    expect(tvdAt(well, pill?.topMd_ft ?? Number.NaN)).toBeCloseTo(7693.472909148134, 6);
    expect(pill?.bottomMd_ft).toBe(BIT_MD);

    const profile = emwProfile(exampleD);
    const uniform = emwProfile(exampleC);
    expect(profile.ok).toBe(true);
    expect(uniform.ok).toBe(true);
    if (!profile.ok || !uniform.ok) return;
    expect(profile.inPlace.lines.static).toHaveLength(107);
    expect(
      profile.inPlace.lines.static.some((point) => Math.abs(point.md_ft - CROSS_MD) < 1e-6),
    ).toBe(true);
    expect(profile.stations.map((station) => station.label)).toEqual(["shoe", "anchor", "bit"]);
    const inPlace = profile.shoeCheck.filter((row) => row.pillState === "inPlace");
    const uniformInPlace = uniform.shoeCheck.filter((row) => row.pillState === "inPlace");
    expect(inPlace).toEqual(uniformInPlace);
    expect(profile.shoeCheck).toEqual([
      {
        line: "static",
        pillState: "inPlace",
        emw_ppg: 11.4,
        fit_ppg: 12.6,
        margin_ppg: 1.1999999999999993,
        margin_psi: 501.2591999999997,
        over: false,
      },
      {
        line: "staticSbp",
        pillState: "inPlace",
        emw_ppg: 12.716684062856103,
        fit_ppg: 12.6,
        margin_ppg: -0.11668406285610367,
        margin_psi: -48.7408000000002,
        over: true,
      },
      {
        line: "ecd",
        pillState: "inPlace",
        emw_ppg: 11.526591882443071,
        fit_ppg: 12.6,
        margin_ppg: 1.0734081175569283,
        margin_psi: 448.3797452334099,
        over: false,
      },
      {
        line: "static",
        pillState: "spotted",
        emw_ppg: 11.509892995918692,
        fit_ppg: 12.6,
        margin_ppg: 1.0901070040813075,
        margin_psi: 455.35513731682744,
        over: false,
      },
      {
        line: "staticSbp",
        pillState: "spotted",
        emw_ppg: 12.826577058774795,
        fit_ppg: 12.6,
        margin_ppg: -0.2265770587747955,
        margin_psi: -94.64486268317248,
        over: true,
      },
      {
        line: "ecd",
        pillState: "spotted",
        emw_ppg: 11.636484878361763,
        fit_ppg: 12.6,
        margin_ppg: 0.9635151216382365,
        margin_psi: 402.4756825502376,
        over: false,
      },
    ]);
  });

  it("returns sections and crossovers with TVD already resolved", () => {
    const profile = emwProfile(exampleD);
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;
    expect(profile.sections).toEqual([
      {
        label: "5.5 in OD / 4.778 in ID",
        topMd_ft: 0,
        bottomMd_ft: CROSS_MD,
        topTvd_ft: 0,
        bottomTvd_ft: 8466,
        id_in: 4.778,
        od_in: 5.5,
      },
      {
        label: "4 in OD / 3.34 in ID",
        topMd_ft: CROSS_MD,
        bottomMd_ft: BIT_MD,
        topTvd_ft: 8466,
        bottomTvd_ft: 10466,
        id_in: 3.34,
        od_in: 4,
      },
    ]);
    expect(profile.crossovers).toEqual([{ md_ft: CROSS_MD, tvd_ft: 8466 }]);
  });

  it("keeps static continuous and ECD without a jump at the crossover", () => {
    const eps = 0.01;
    const profile = emwProfile(exampleD);
    const spotted = columnDisplacedByPipe(exampleD, BIT_MD);
    expect(profile.ok).toBe(true);
    expect(spotted).not.toBeNull();
    if (!profile.ok || !spotted) return;
    const crossover = profile.crossovers[0];
    expect(crossover).toEqual({ md_ft: 8480, tvd_ft: 8466 });

    const sample = (column: typeof exampleD, md: number) => {
      const esd = esdAtMd(column, md);
      const friction = frictionPsi(column, md, BIT_MD, { kind: "flow" });
      const tvd = tvdAt(well, md);
      const ecd = ecdPpg(esd, friction, tvd, exampleD.trip.sbpCirc_psi);
      expect(esd).not.toBeNull();
      expect(friction).not.toBeNull();
      expect(tvd).not.toBeNull();
      expect(ecd).not.toBeNull();
      return {
        static: esd as number,
        staticSbp: (esd as number) + exampleD.trip.sbpConn_psi / (0.052 * (tvd as number)),
        ecd: ecd as number,
        friction: friction as number,
      };
    };

    const expectContinuous = (
      above: { static: number; staticSbp: number; ecd: number },
      at: { static: number; staticSbp: number; ecd: number },
      below: { static: number; staticSbp: number; ecd: number },
    ) => {
      for (const line of ["static", "staticSbp", "ecd"] as const) {
        expect(Math.abs(above[line] - at[line])).toBeLessThan(1e-4);
        expect(Math.abs(below[line] - at[line])).toBeLessThan(1e-4);
      }
    };

    const inAbove = sample(exampleD, crossover.md_ft - eps);
    const inAt = sample(exampleD, crossover.md_ft);
    const inBelow = sample(exampleD, crossover.md_ft + eps);
    expectContinuous(inAbove, inAt, inBelow);
    expect(inAbove.static).toBeCloseTo(11.528983615619675, 9);
    expect(inAt.static).toBeCloseTo(11.528986534372788, 9);
    expect(inBelow.static).toBeCloseTo(11.528989453119003, 9);
    expect(inAbove.staticSbp).toBeCloseTo(12.778326347765955, 9);
    expect(inAt.staticSbp).toBeCloseTo(12.778327790801216, 9);
    expect(inBelow.staticSbp).toBeCloseTo(12.778329233833068, 9);
    expect(inAbove.ecd).toBeCloseTo(11.65596952461962, 9);
    expect(inAt.ecd).toBeCloseTo(11.655972451278082, 9);
    expect(inBelow.ecd).toBeCloseTo(11.65597534225457, 9);

    const spotAbove = sample(spotted, crossover.md_ft - eps);
    const spotAt = sample(spotted, crossover.md_ft);
    const spotBelow = sample(spotted, crossover.md_ft + eps);
    expectContinuous(spotAbove, spotAt, spotBelow);
    expect(spotAbove.static).toBeCloseTo(11.63724861902918, 9);
    expect(spotAt.static).toBeCloseTo(11.637251409900173, 9);
    expect(spotBelow.static).toBeCloseTo(11.63725420076457, 9);
    expect(spotAbove.staticSbp).toBeCloseTo(12.886591351175458, 9);
    expect(spotAt.staticSbp).toBeCloseTo(12.886592666328601, 9);
    expect(spotBelow.staticSbp).toBeCloseTo(12.886593981478635, 9);
    expect(spotAbove.ecd).toBeCloseTo(11.764234528029125, 9);
    expect(spotAt.ecd).toBeCloseTo(11.764237326805468, 9);
    expect(spotBelow.ecd).toBeCloseTo(11.764240089900136, 9);

    const gradAbove = (inAt.friction - inAbove.friction) / eps;
    const gradBelow = (inBelow.friction - inAt.friction) / eps;
    expect(gradAbove).toBeCloseTo(2.9195401146523885 / 420, 6);
    expect(gradBelow).toBeCloseTo(10.761507934622033 / 2000, 6);
    expect(Math.abs(gradAbove - gradBelow)).toBeGreaterThan(0.001);

    const onStatic = profile.inPlace.lines.static.find((point) => point.md_ft === CROSS_MD);
    const onEcd = profile.inPlace.lines.ecd.find((point) => point.md_ft === CROSS_MD);
    expect(onStatic?.emw_ppg).toBeCloseTo(inAt.static, 12);
    expect(onEcd?.emw_ppg).toBeCloseTo(inAt.ecd, 12);
  });

  it("fills POOH stands across the section boundary", () => {
    const fill = poohFill(exampleD);
    expect(fill.ok).toBe(true);
    if (!fill.ok) return;
    expect(fill.closed.total_bbl).toBeCloseTo(280.2797746259957, 9);
    const crossing = fill.closed.stands[91];
    expect(crossing.n).toBe(92);
    expect(crossing.length_ft).toBe(93);
    expect(crossing.bbl).toBeCloseTo(capBblFt(5.5) * 17 + capBblFt(4) * 76, 9);
  });
});
