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
if (missingIds.length) throw new Error(`Missing HTML ids: ${missingIds.join(", ")}`);
if (duplicateIds.length) throw new Error(`Duplicate HTML ids: ${duplicateIds.join(", ")}`);

source = source.slice(0, source.lastIndexOf("buildInputs();"));
source += `
Object.assign(state, example);
const exampleResults = calc();
const exampleSchedule = makeScheduleRows(exampleResults);
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
});
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
console.log(JSON.stringify({
  staticPressure: round(exampleResults.staticStrippingPressure, 3),
  maxDynamicSbp: round(exampleResults.maxDynamicSbp, 3),
  exampleRows: exampleSchedule.rows.length,
  referenceRows: reference.rows.length,
  cutoffVerified: true,
}, null, 2));
`;

vm.runInNewContext(source, { console });
