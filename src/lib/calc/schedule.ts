import { asNum, floorTo, isNum, nonNegative, safeDiv } from "@/lib/utils";
import type { CalcResults, PillMode, ScheduleResult, ScheduleRow, WellInputs } from "./types";

function productionFlowLadder(
  initialFlow: number,
  apl: number,
  resGain: number,
  hiddenSbpSeries: number[],
): number[] {
  const base = floorTo(initialFlow, 10);
  const ratio = apl > 1e-9 ? Math.max(0, (apl - resGain) / apl) : 0;
  const factor = Math.sqrt(ratio);
  const b: number[] = [];
  const c: number[] = [];
  b[0] = base;
  c[0] = base * factor;
  for (let i = 1; i < 40; i += 1) {
    const prevHidden = hiddenSbpSeries[i - 1] ?? 0;
    b[i] = floorTo(prevHidden > 50 ? base : c[i - 1], 10);
    c[i] = b[i] * factor;
  }
  return b;
}

export function buildSchedule(inputs: WellInputs, results: CalcResults, mode?: PillMode): ScheduleResult {
  const activeMode: PillMode = mode ?? inputs.pillMode;
  const withSlug = activeMode === "withSlug";
  const resolution = asNum(inputs.desiredResolution);
  const initialFlow = asNum(inputs.initialFlowRate);
  const pumpDisp = asNum(inputs.pumpDisp);
  const currentMw = asNum(inputs.currentMw);
  const kmw = asNum(inputs.kmw);
  const odDp = asNum(inputs.odDp);
  const section = inputs.sectionType;

  const spotted = isNum(results.spottedKmwVol) && results.spottedKmwVol > 0
    ? results.spottedKmwVol
    : results.totalPillVol;
  const heavyVolume = nonNegative(withSlug ? results.pillVolAtSpot : spotted);
  const fullPillAtSpot =
    !withSlug ||
    !isNum(results.minHeightWithDp) ||
    !isNum(asNum(inputs.spotMd)) ||
    asNum(inputs.spotMd) > results.minHeightWithDp;
  const normalFinal = nonNegative(withSlug ? results.chaseWithSlug : results.kwmPlusChase);
  const correctedFinal = nonNegative(results.correctedSlugPill);
  const finalVolume =
    withSlug && !fullPillAtSpot && isNum(correctedFinal) ? correctedFinal : normalFinal;

  const empty: ScheduleResult = {
    rows: [],
    mode: activeMode,
    heavyVolume,
    finalVolume,
    finalStrokes: Number.NaN,
  };

  const required = [
    resolution,
    initialFlow,
    pumpDisp,
    currentMw,
    kmw,
    odDp,
    results.drillStringVolAtSpot,
    results.spottedKmwVol,
    heavyVolume,
    finalVolume,
    results.staticStrippingPressure,
    results.resolutionPressureGain,
    results.pressureDifferential,
  ];
  if (withSlug) {
    required.push(results.pressureDifferentialSlug, results.slugFallOut, results.slugPsiEquivalent);
  }
  if (
    required.some((v) => !isNum(v)) ||
    resolution <= 0 ||
    pumpDisp <= 0 ||
    heavyVolume <= 0 ||
    finalVolume <= 0
  ) {
    return empty;
  }

  const noSlugInitial = Math.min(heavyVolume, nonNegative(results.drillStringVolAtSpot));
  const slugInitial =
    results.totalPillVol < results.drillStringVolAtSpot
      ? heavyVolume
      : Math.min(resolution, finalVolume);
  let volume = Math.min(withSlug ? slugInitial : noSlugInitial, finalVolume);

  const rows: ScheduleRow[] = [];
  let hiddenSbp = withSlug ? results.pressureDifferentialSlug : results.pressureDifferential;
  let priorStatic = Number.NaN;
  const hiddenTrace: number[] = [];

  for (let step = 1; step <= 80; step += 1) {
    let sbp: number | "Open Choke" = "Open Choke";
    if (step === 1 && hiddenSbp > 0) {
      sbp = hiddenSbp;
    } else if (!withSlug && step === 2 && odDp > 0 && hiddenSbp > 0) {
      sbp = results.pressureDifferential;
    } else if (withSlug && step === 2 && results.slugFits) {
      hiddenSbp = results.pressureDifferential;
      if (hiddenSbp > 0) sbp = hiddenSbp;
    } else if (step > 2 && hiddenSbp > 50) {
      hiddenSbp =
        hiddenSbp > results.resolutionPressureGain
          ? Math.max(hiddenSbp - results.resolutionPressureGain, 50)
          : 50;
      sbp = hiddenSbp;
    } else if (withSlug && step === 2 && hiddenSbp > 50) {
      hiddenSbp =
        hiddenSbp > results.resolutionPressureGain
          ? Math.max(hiddenSbp - results.resolutionPressureGain, 50)
          : 50;
      sbp = hiddenSbp;
    }

    const numericHidden = typeof sbp === "number" ? sbp : 0;
    hiddenTrace.push(typeof sbp === "number" ? sbp : hiddenSbp <= 50 ? 50 : hiddenSbp);

    const slugOffset = withSlug && results.slugPsiEquivalent > 0 ? results.slugPsiEquivalent : 0;
    let staticSbp: number;
    if (slugOffset > 0) {
      if (step === 1) staticSbp = Math.max(0, results.staticStrippingPressure - slugOffset);
      else if (step === 2) staticSbp = Math.max(0, results.staticStrippingPressure - slugOffset * 2);
      else staticSbp = Math.max(0, priorStatic - results.resolutionPressureGain - slugOffset);
    } else {
      staticSbp = Math.max(
        0,
        results.staticStrippingPressure - (step - 1) * results.resolutionPressureGain,
      );
    }
    priorStatic = staticSbp;

    let notes = "";
    if (withSlug && step === 1) notes = `Remaining KMW after ${Math.round(results.slugPillVol)} bbl slug`;
    if (!withSlug && step === 1) notes = "KMW into drill string";
    if (volume >= heavyVolume - 1e-6 && rows.every((r) => r.volume < heavyVolume - 1e-6)) {
      notes = notes || "KMW displaced — swap to chase";
    }

    rows.push({
      step,
      sbp: typeof sbp === "number" && sbp <= 50 && step > 2 && numericHidden <= 50 && hiddenSbp <= 50 && sbp === 50
        ? 50
        : sbp,
      flow: initialFlow,
      volume,
      strokes: safeDiv(volume, pumpDisp),
      density: volume <= heavyVolume + 1e-6 ? kmw : currentMw,
      staticSbp,
      activityNotes: notes,
      hiddenSbp: hiddenTrace[step - 1] ?? 0,
    });

    if (volume >= finalVolume - 1e-9) break;

    let nextVolume = volume + resolution;
    const remainingPill = heavyVolume - volume;
    if (remainingPill > 0 && remainingPill < resolution) nextVolume = heavyVolume;
    nextVolume = Math.min(nextVolume, finalVolume);
    if (nextVolume <= volume + 1e-9) break;
    volume = nextVolume;
  }

  // Open choke once hidden SBP has floored at 50 on a later row
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (i >= 2 && typeof row.sbp === "number" && row.sbp <= 50) {
      const prev = rows[i - 1];
      if (typeof prev.sbp === "number" && prev.sbp <= 50) {
        row.sbp = "Open Choke";
      }
    }
  }

  if (section === "Production") {
    const apl = isNum(results.initialAplAnchor) ? results.initialAplAnchor : results.initialApl;
    const hiddenForLadder = rows.map((r) =>
      typeof r.sbp === "number" ? r.sbp : r.hiddenSbp || 50,
    );
    const ladder = productionFlowLadder(initialFlow, apl, results.resolutionPressureGain, hiddenForLadder);
    rows.forEach((row, i) => {
      if (i === 0 || i === 1) {
        row.flow = initialFlow;
      } else {
        // J26 uses B80 which is ladder index 2
        row.flow = ladder[i] ?? floorTo(initialFlow, 10);
      }
    });
  }

  // Trim trailing rows that repeat the final volume (Excel "hide red cells")
  const lastIdx = rows.findIndex((r, i) => i > 0 && r.volume >= finalVolume - 1e-9);
  const trimmed = lastIdx >= 0 ? rows.slice(0, lastIdx + 1) : rows;

  // Annotate density swap
  trimmed.forEach((row, i) => {
    if (i > 0 && trimmed[i - 1].density !== row.density) {
      row.activityNotes = row.activityNotes
        ? `${row.activityNotes}; density swap to ${row.density} ppg`
        : `Density swap to ${row.density} ppg chase`;
    }
  });

  const last = trimmed.at(-1);
  return {
    rows: trimmed,
    mode: activeMode,
    heavyVolume,
    finalVolume,
    finalStrokes: last ? last.strokes : Number.NaN,
  };
}

export function scheduleToCsv(rows: ScheduleRow[]): string {
  const header = [
    "Step",
    "SBP psi",
    "Flow Rate gpm",
    "Volume bbls",
    "Total Strokes stks",
    "Density In ppg",
    "Static SBP psi",
    "Activity Notes",
  ];
  const body = rows.map((r) =>
    [
      r.step,
      typeof r.sbp === "number" ? r.sbp.toFixed(1) : r.sbp,
      r.flow,
      r.volume.toFixed(2),
      r.strokes.toFixed(1),
      r.density.toFixed(2),
      r.staticSbp.toFixed(1),
      r.activityNotes,
    ]
      .map((c) => `"${String(c).replaceAll('"', '""')}"`)
      .join(","),
  );
  return [header.join(","), ...body].join("\n");
}
