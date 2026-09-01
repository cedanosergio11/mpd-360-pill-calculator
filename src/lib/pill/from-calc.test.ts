import { describe, expect, it } from "vitest";
import { calculate } from "../calc/engine";
import { AUBURNIA, MOMENTUM } from "../calc/examples";
import { computeModel, floatDrainOnMove, pipeBoreBblPerFt, volumeFromDepths } from "./physics";
import { composeWellState, geometryFromWell, pillFromProcedure } from "./from-calc";
import { emwAt, hydrostaticLayers, tvdAt, tvdFn } from "./hydrostatic";

describe("from-calc — Auburnia placement", () => {
  const results = calculate(AUBURNIA);
  const geo = geometryFromWell(AUBURNIA);
  const placement = pillFromProcedure(AUBURNIA, results, geo, "closed");

  it("maps well geometry", () => {
    expect(geo.wellDepth).toBe(18359);
    expect(geo.holeId).toBe(6.875);
  });

  it("places the as-pumped pill", () => {
    expect(Math.abs(placement.placedPillBottom - 11681)).toBeLessThan(1);
    expect(Math.abs(placement.pillVolume - 98)).toBeLessThan(3);
    expect(Math.abs(placement.pipeKmwVolume - 74)).toBeLessThan(2);
    expect(placement.pipeChaseVolume ?? 0).toBeGreaterThan(80);
  });

  it("interval volume matches placed annulus", () => {
    const annularCheck = volumeFromDepths(
      {
        wellDepth: geo.wellDepth,
        holeId: geo.holeId,
        pipeOd: geo.pipeOd,
        pipeId: geo.pipeId,
        pipeEnd: "closed",
        pipeDepth: placement.pipeDepth,
        referencePipeDepth: placement.referencePipeDepth,
        placedPillTop: placement.placedPillTop,
        placedPillBottom: placement.placedPillBottom,
        pillVolume: placement.pillVolume,
        pillMw: placement.pillMw,
        autoBackfill: true,
        baseMw: geo.baseMw,
        pipeKmwVolume: placement.pipeKmwVolume,
        pipeChaseVolume: placement.pipeChaseVolume ?? 0,
        survey: geo.survey,
      },
      placement.placedPillTop,
      placement.placedPillBottom,
      placement.pipeDepth,
    );
    expect(Math.abs(annularCheck - placement.pillVolume)).toBeLessThan(1.5);
  });

  it("model has KMW and chase in the string", () => {
    const state = composeWellState(AUBURNIA, {
      ...placement,
      pipeEnd: "closed",
      autoBackfill: true,
    });
    const model = computeModel(state);
    expect(Math.abs(model.pillTop - (results.topOfPillNoDp as number))).toBeLessThan(80);
    expect(model.pipeKmwInHole).toBeGreaterThan(50);
    expect(model.pipeChaseInHole).toBeGreaterThan(50);
  });

  it("POOH with trip tank on fills steel", () => {
    const pulled = composeWellState(AUBURNIA, {
      ...placement,
      pipeDepth: placement.pipeDepth - 1000,
      pipeEnd: "closed",
      autoBackfill: true,
    });
    const pulledModel = computeModel(pulled);
    expect(pulledModel.pipeDelta).toBe(-1000);
    expect(pulledModel.backfillVolume > 0 || pulledModel.tripTankGain > 0).toBe(true);
  });
});

describe("from-calc — Momentum", () => {
  const mRes = calculate(MOMENTUM);
  const mGeo = geometryFromWell(MOMENTUM);
  const mPlace = pillFromProcedure(MOMENTUM, mRes, mGeo, "closed");

  it("splits mixed volume into annulus + string, no chase", () => {
    expect(mRes.totalPillVol).toBe(358);
    expect(Math.abs(mPlace.pillVolume - 207)).toBeLessThan(4);
    expect(Math.abs(mPlace.pipeKmwVolume - 153)).toBeLessThan(2);
    expect(mPlace.pipeChaseVolume ?? 0).toBeLessThan(1);
    expect(Math.abs(mPlace.placedPillTop - 3717)).toBeLessThan(80);
    expect(mPlace.pillVolume).toBeLessThan(320);
  });

  it("string is full of KMW as-pumped", () => {
    const mState = composeWellState(MOMENTUM, { ...mPlace, pipeEnd: "closed", autoBackfill: true });
    const mModel = computeModel(mState);
    expect(mModel.pipeKmwTop).toBeLessThan(200);
  });

  it("equalized-with-float dumps string KMW into the annulus", () => {
    const eqPlace = pillFromProcedure(MOMENTUM, mRes, mGeo, "closed", { equalized: true });
    const eqState = composeWellState(MOMENTUM, { ...eqPlace, pipeEnd: "closed", autoBackfill: true });
    const eqModel = computeModel(eqState);
    expect(eqModel.pipeKmwTop).toBeGreaterThan(400);
    expect(Math.abs(eqPlace.placedPillBottom - mPlace.placedPillBottom)).toBeLessThan(5);
    expect(eqPlace.placedPillTop).toBeLessThan(mPlace.placedPillTop - 50);
    expect(eqPlace.pipeKmwVolume).toBeLessThan(mPlace.pipeKmwVolume);
    expect(eqPlace.pillVolume).toBeGreaterThan(mPlace.pillVolume);
    expect(eqPlace.pipeKmwVolume + eqPlace.pillVolume).toBeGreaterThan(330);
  });

  it("anchor EMW stays on 17.4 as-pumped and after equalize", () => {
    const mState = composeWellState(MOMENTUM, { ...mPlace, pipeEnd: "closed", autoBackfill: true });
    const mModel = computeModel(mState);
    const eqPlace = pillFromProcedure(MOMENTUM, mRes, mGeo, "closed", { equalized: true });
    const eqState = composeWellState(MOMENTUM, { ...eqPlace, pipeEnd: "closed", autoBackfill: true });
    const eqModel = computeModel(eqState);
    const anchorMd = 12281;
    expect(Math.abs(tvdAt(mState.survey, anchorMd) - 11888)).toBeLessThan(2);
    const asPumpedEmw = emwAt(anchorMd, hydrostaticLayers(mState, mModel), tvdFn(mState), mState.baseMw);
    expect(Math.abs(asPumpedEmw - 17.4)).toBeLessThan(0.08);
    const eqEmw = emwAt(anchorMd, hydrostaticLayers(eqState, eqModel), tvdFn(eqState), eqState.baseMw);
    expect(Math.abs(eqEmw - 17.4)).toBeLessThan(0.2);
  });

  it("float drains KMW on POOH and blocks influx on RIH", () => {
    const mState = composeWellState(MOMENTUM, { ...mPlace, pipeEnd: "closed", autoBackfill: true });
    const bore = pipeBoreBblPerFt(mState);
    const pull = floatDrainOnMove(11527, 10527, mPlace.pipeKmwVolume, bore);
    expect(pull.drained).toBeGreaterThan(10);
    expect(pull.pipeKmwVolume).toBeLessThan(mPlace.pipeKmwVolume - 10);
    const push = floatDrainOnMove(10527, 11527, pull.pipeKmwVolume, bore);
    expect(push.drained).toBe(0);
    expect(push.pipeKmwVolume).toBe(pull.pipeKmwVolume);
  });
});

describe("from-calc — 18 ppge KMW backfill", () => {
  const tightRes = calculate({ ...MOMENTUM, wellName: "18 ppge backfill", desiredEmw: 18 });
  const tightPlace = pillFromProcedure(
    { ...MOMENTUM, desiredEmw: 18 },
    tightRes,
    geometryFromWell(MOMENTUM),
    "closed",
  );

  it("carries backfill into the sim and applies it while POOH", () => {
    expect(tightRes.bblBackfill).toBeGreaterThanOrEqual(1);
    const tightPulled = composeWellState(MOMENTUM, {
      ...tightPlace,
      pipeEnd: "closed",
      autoBackfill: true,
      kmwBackfillRequired: tightRes.bblBackfill,
      pipeDepth: Math.max(100, tightPlace.pipeDepth - 3000),
    });
    const tightPullModel = computeModel(tightPulled);
    expect(tightPullModel.kmwBackfillRequired).toBe(tightRes.bblBackfill);
    expect(tightPullModel.kmwBackfillApplied).toBeGreaterThan(0.5);
    expect(tightPullModel.fillZoneVolume).toBeLessThan(tightPullModel.backfillVolume - 0.4);
    const noKmwFill = computeModel({ ...tightPulled, kmwBackfillRequired: 0 });
    expect(tightPullModel.pillTop).toBeLessThan(noKmwFill.pillTop - 5);
  });

  it("pipe-out annulus matches needed KMW", () => {
    const tightOut = composeWellState(MOMENTUM, {
      ...tightPlace,
      pipeEnd: "closed",
      autoBackfill: true,
      kmwBackfillRequired: tightRes.bblBackfill,
      pipeDepth: 0,
      pipeKmwVolume: 0,
      pillVolume: tightPlace.pillVolume + tightPlace.pipeKmwVolume,
    });
    const tightOutModel = computeModel(tightOut);
    expect(Math.abs(tightOutModel.annularKmwVolume - tightRes.totalPillVol)).toBeLessThan(2);
  });
});
