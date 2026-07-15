import fs from "node:fs";
import vm from "node:vm";

const appUrl = new URL("./app.js", import.meta.url);
const htmlUrl = new URL("./index.html", import.meta.url);
let source = fs.readFileSync(appUrl, "utf8");
const html = fs.readFileSync(htmlUrl, "utf8");

const referencedIds = [...source.matchAll(/byId\("([^"]+)"\)/g)].map((match) => match[1]);
const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const generatedIds = new Set(["staticStrippingPressure", "maxDynamicSbp"]);
const missingIds = [...new Set(referencedIds)].filter(
  (id) => !htmlIds.includes(id) && !generatedIds.has(id),
);
const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
const pillModes = [...html.matchAll(/name="pillMode" value="([^"]+)"/g)].map(
  (match) => match[1],
);
if (missingIds.length) throw new Error(`Missing HTML ids: ${missingIds.join(", ")}`);
if (duplicateIds.length) throw new Error(`Duplicate HTML ids: ${duplicateIds.join(", ")}`);
if (pillModes.join(",") !== "noSlug,withSlug") {
  throw new Error("Pill mode toggle is incomplete");
}
if (!/<section class="data-section" id="pillSection">[\s\S]*?<h2>Pill Calculations<\/h2>[\s\S]*?<\/section>/.test(html)) {
  throw new Error("Pill Calculations section is not wired correctly");
}
if (!/<section class="data-section" id="slugSection">[\s\S]*?<h2>Slug Calculations<\/h2>[\s\S]*?<\/section>/.test(html)) {
  throw new Error("Slug Calculations section is not wired correctly");
}
const summaryPanel = html.match(/<section class="tab-panel active" id="summary">([\s\S]*?)<section class="tab-panel" id="schedule">/)?.[1] ?? "";
const schedulePanel = html.match(/<section class="tab-panel" id="schedule">([\s\S]*?)<section class="tab-panel" id="cement">/)?.[1] ?? "";
if (summaryPanel.includes("Trip Speed Pressure Table") || !schedulePanel.includes("Trip Speed Pressure Table")) {
  throw new Error("Trip Speed Pressure Table must appear only on the Schedule tab");
}

source = source.slice(0, source.lastIndexOf("buildInputs();"));
source += `
const blankResults = calc();
if (blankResults.topOfPillWithDp === "Surface") {
  throw new Error("Incomplete inputs should leave procedure results pending");
}
Object.assign(state, example);
const exampleResults = calc();
const exampleSchedule = makeScheduleRows(exampleResults, "noSlug");
if (round(exampleResults.topOfPillNoDp, 3) !== round(example.spotMd - exampleResults.heightPillNoDp, 3)) {
  throw new Error("Top of pill without DP does not follow the workbook formula");
}
if (
  exampleResults.topOfPillWithDp !== "Surface" &&
  round(exampleResults.topOfPillWithDp, 3) !== round(example.spotMd - exampleResults.minHeightWithDp, 3)
) {
  throw new Error("Top of pill with DP does not follow the workbook formula");
}
if (round(exampleResults.balancedEsdCasing, 6) !== round(exampleResults.esdCasingNoDp + exampleResults.addPpgCsg, 6)) {
  throw new Error("Balanced casing-shoe ESD does not include the DP pressure increment");
}
if (exampleResults.totalPillVolAtSpotNoSlug !== exampleResults.totalPillVol) {
  throw new Error("No Slug total pill volume at spot depth is incorrect");
}
const exampleStrokes = exampleSchedule.rows.map((row) => row.strokes);
if (!exampleStrokes.every((value, index) => index === 0 || value > exampleStrokes[index - 1])) {
  throw new Error("Schedule strokes repeat before cutoff");
}
if (exampleSchedule.rows.at(-1)?.volume !== exampleResults.kwmPlusChase) {
  throw new Error("Schedule does not reach final volume");
}
if (exampleSchedule.cutoff?.strokes !== exampleSchedule.rows.at(-1)?.strokes) {
  throw new Error("Cutoff row is not the first repeated stroke total");
}

Object.assign(state, {
  anchorMd: 11804,
  anchorTvd: 10509,
  casingMd: 11167,
  casingTvd: 10188,
  spotMd: 6000,
  spotTvd: 6000,
  openHoleDia: 6.75,
  desiredEmw: 12.5,
  odDp: 4,
  idDp: 2.688,
  idCasing: 6.875,
  currentMw: 11.8,
  pumpDisp: 0.0693,
  kmw: 15,
  fit: 14,
});
const workbookResults = calc();
const workbookResultSnapshot = [
  workbookResults.correctedPillVol,
  workbookResults.finalKwm,
  workbookResults.totalPillVol,
  workbookResults.totalPillVolAtSpotNoSlug,
  workbookResults.totalPillVolAtSpotWithSlug,
  workbookResults.topOfPillWithDp,
  workbookResults.topOfPillNoDp,
  workbookResults.balancedEsdCasing,
  workbookResults.anchorPointEsd,
  workbookResults.minHeightWithDp,
  workbookResults.esdCasingNoDp,
  workbookResults.heightPillNoDp,
].map((value) => round(value, 3));
const expectedWorkbookResultSnapshot = [
  70,
  36.143,
  106,
  106,
  106,
  3165.143,
  3700,
  12.69,
  12.663,
  2834.857,
  12.522,
  2300,
];
if (JSON.stringify(workbookResultSnapshot) !== JSON.stringify(expectedWorkbookResultSnapshot)) {
  throw new Error("Procedure result block differs from workbook: " + JSON.stringify(workbookResultSnapshot));
}

Object.assign(state, {
  desiredResolution: 15,
  initialFlowRate: 260,
  pumpDisp: 0.0624,
  currentMw: 16.2,
  kmw: 19.5,
  odDp: 5,
});
const reference = makeScheduleRows({
  drillStringVolAtSpot: 150,
  totalPillVol: 346,
  kwmPlusChase: 404,
  staticStrippingPressure: 808,
  resolutionPressureGain: 48.05,
  pressureDifferential: 574,
}, "noSlug");
if (reference.rows.length !== 19) throw new Error("Reference schedule should have 19 active rows");
if (reference.rows[14].volume !== 346 || reference.rows[14].density !== 19.5) {
  throw new Error("Pill-volume boundary row is incorrect");
}
if (reference.rows[15].density !== 16.2) throw new Error("Chase density transition is incorrect");
if (reference.rows[12].sbp !== 50 || reference.rows[13].sbp !== "Open Choke") {
  throw new Error("SBP-to-open-choke transition is incorrect");
}
if (reference.rows[17].staticSbp !== 0 || Math.round(reference.rows.at(-1).strokes) !== 6474) {
  throw new Error("Static SBP or final stroke result is incorrect");
}
if (reference.cutoff?.strokes !== reference.rows.at(-1)?.strokes) {
  throw new Error("Reference cutoff does not repeat the final stroke total");
}

Object.assign(state, {
  desiredResolution: 10,
  initialFlowRate: 250,
  pumpDisp: 0.0561,
  currentMw: 15.3,
  kmw: 18.5,
  odDp: 5,
  spotMd: 6000,
});
const withSlugReference = makeScheduleRows({
  drillStringVolAtSpot: 87,
  totalPillVol: 163,
  kwmPlusChase: 180,
  pillVolAtSpot: 49.89090139224119,
  chaseWithSlug: 66.72923100172241,
  correctedSlugPill: 130.89090139224118,
  minHeightWithDp: 4001.6580703732634,
  staticStrippingPressure: 589.004,
  resolutionPressureGain: 63.40484812030074,
  pressureDifferential: 323.9522,
  pressureDifferentialSlug: 229.7273556231407,
  slugFits: false,
  slugFallOut: 26,
  slugPsiEquivalent: 94.22484437685948,
}, "withSlug");
if (withSlugReference.rows.length !== 7) {
  throw new Error("With Slug reference should have 7 active rows");
}
if (round(withSlugReference.rows[4].volume, 3) !== 49.891 || withSlugReference.rows[4].density !== 18.5) {
  throw new Error("With Slug KMW boundary is incorrect");
}
if (withSlugReference.rows[5].density !== 15.3) {
  throw new Error("With Slug chase density transition is incorrect");
}
const withSlugSbp = withSlugReference.rows.slice(0, 5).map((row) =>
  isNum(row.sbp) ? round(row.sbp, 3) : row.sbp,
);
if (JSON.stringify(withSlugSbp) !== JSON.stringify([229.727, 166.323, 102.918, 50, "Open Choke"])) {
  throw new Error("With Slug SBP sequence is incorrect");
}
const withSlugStatic = withSlugReference.rows.slice(0, 5).map((row) => round(row.staticSbp, 3));
if (JSON.stringify(withSlugStatic) !== JSON.stringify([494.779, 400.554, 242.925, 85.295, 0])) {
  throw new Error("With Slug static SBP compensation is incorrect");
}
if (withSlugReference.cutoff?.strokes !== withSlugReference.rows.at(-1)?.strokes) {
  throw new Error("With Slug cutoff does not repeat the final stroke total");
}
console.log(JSON.stringify({
  staticPressure: round(exampleResults.staticStrippingPressure, 3),
  maxDynamicSbp: round(exampleResults.maxDynamicSbp, 3),
  exampleRows: exampleSchedule.rows.length,
  referenceRows: reference.rows.length,
  withSlugRows: withSlugReference.rows.length,
  workbookResultVerified: true,
  cutoffVerified: true,
}, null, 2));
`;

vm.runInNewContext(source, { console });
