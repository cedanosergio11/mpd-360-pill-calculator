/**
 * Display names for job input paths. The engine keeps the raw path.
 * Indexed paths (`column[1]`, `stringSections[1]`, `well.casing.0`) share one entry per suffix.
 */

export interface FieldLabel {
  label: string;
  unit: string;
}

const EXACT: Record<string, FieldLabel> = {
  name: { label: "Well name", unit: "" },
  survey: { label: "Survey", unit: "" },
  "well.survey": { label: "Survey", unit: "" },
  "well.survey.spot": { label: "Spot survey", unit: "" },
  "well.bitMd_ft": { label: "Bit MD", unit: "ft" },
  "well.mdTd_ft": { label: "TD MD", unit: "ft" },
  "well.tvdTd_ft": { label: "TD TVD", unit: "ft" },
  "well.shoeMd_ft": { label: "Shoe MD", unit: "ft" },
  "well.shoeTvd_ft": { label: "Shoe TVD", unit: "ft" },
  "well.anchorMd_ft": { label: "Anchor MD", unit: "ft" },
  "well.anchorTvd_ft": { label: "Anchor TVD", unit: "ft" },
  "well.fit_ppg": { label: "FIT", unit: "ppg" },
  "well.porePressure_ppg": { label: "Pore pressure", unit: "ppg" },
  "well.targetEmw_ppg": { label: "Target EMW", unit: "ppg" },
  "well.openHoleId_in": { label: "Open hole ID", unit: "in" },
  "well.stringOd_in": { label: "String OD", unit: "in" },
  "well.stringId_in": { label: "String ID", unit: "in" },
  "well.casing": { label: "Casing", unit: "" },
  "spot.bottomMd_ft": { label: "Spot MD", unit: "ft" },
  "pump.bblPerStk": { label: "Pump output", unit: "bbl/stk" },
  "trip.sbpConn_psi": { label: "SBP on connection", unit: "psi" },
  "trip.sbpCirc_psi": { label: "SBP circulating", unit: "psi" },
  "trip.flow_gpm": { label: "Flow", unit: "gpm" },
  "trip.standLength_ft": { label: "Stand length", unit: "ft" },
  "trip.speeds_ftmin": { label: "Trip speeds", unit: "ft/min" },
  column: { label: "Annulus column", unit: "" },
  pipeColumn: { label: "Pipe column", unit: "" },
  stringSections: { label: "String sections", unit: "" },
};

interface IndexedLabel {
  pattern: RegExp;
  label: (index: number, rest: string) => string;
  unit: string | ((rest: string) => string);
}

const INDEXED: IndexedLabel[] = [
  { pattern: /^well\.survey\[(\d+)\]\.md_ft$/, label: (n) => `Survey station ${n + 1} MD`, unit: "ft" },
  { pattern: /^well\.survey\[(\d+)\]\.tvd_ft$/, label: (n) => `Survey station ${n + 1} TVD`, unit: "ft" },
  { pattern: /^well\.casing\[(\d+)\]$/, label: (n) => `Casing ${n + 1}`, unit: "" },
  { pattern: /^well\.casing\[(\d+)\]\.topMd_ft$/, label: (n) => `Casing ${n + 1} top MD`, unit: "ft" },
  { pattern: /^well\.casing\[(\d+)\]\.bottomMd_ft$/, label: (n) => `Casing ${n + 1} bottom MD`, unit: "ft" },
  { pattern: /^well\.casing\[(\d+)\]\.id_in$/, label: (n) => `Casing ${n + 1} ID`, unit: "in" },
  { pattern: /^column\[(\d+)\]$/, label: (n) => `Annulus column ${n + 1}`, unit: "" },
  { pattern: /^column\[(\d+)\]\.topMd_ft$/, label: (n) => `Annulus column ${n + 1} top MD`, unit: "ft" },
  { pattern: /^column\[(\d+)\]\.bottomMd_ft$/, label: (n) => `Annulus column ${n + 1} bottom MD`, unit: "ft" },
  { pattern: /^column\[(\d+)\]\.fluidId$/, label: (n) => `Annulus column ${n + 1} fluid`, unit: "" },
  { pattern: /^pipeColumn\[(\d+)\]$/, label: (n) => `Pipe column ${n + 1}`, unit: "" },
  { pattern: /^pipeColumn\[(\d+)\]\.topMd_ft$/, label: (n) => `Pipe column ${n + 1} top MD`, unit: "ft" },
  { pattern: /^pipeColumn\[(\d+)\]\.bottomMd_ft$/, label: (n) => `Pipe column ${n + 1} bottom MD`, unit: "ft" },
  { pattern: /^pipeColumn\[(\d+)\]\.fluidId$/, label: (n) => `Pipe column ${n + 1} fluid`, unit: "" },
  { pattern: /^stringSections\[(\d+)\]$/, label: (n) => `String section ${n + 1}`, unit: "" },
  { pattern: /^stringSections\[(\d+)\]\.length_ft$/, label: (n) => `String section ${n + 1} length`, unit: "ft" },
  { pattern: /^stringSections\[(\d+)\]\.od_in$/, label: (n) => `String section ${n + 1} OD`, unit: "in" },
  { pattern: /^stringSections\[(\d+)\]\.id_in$/, label: (n) => `String section ${n + 1} ID`, unit: "in" },
  { pattern: /^fluids\[(\d+)\]\.density_ppg$/, label: (n) => `Fluid ${n + 1} density`, unit: "ppg" },
  {
    pattern: /^fluids\[(\d+)\]\.fann(?:\.([A-Za-z0-9]+))?$/,
    label: (n, rest) => (rest ? `Fluid ${n + 1} Fann ${rest}` : `Fluid ${n + 1} Fann`),
    unit: "",
  },
];

/** `well.casing.0.id_in` and `well.casing[0].id_in` are the same path. */
export function normalizeFieldPath(path: string): string {
  return path.replace(/\.(\d+)(?=\.|$)/g, "[$1]");
}

function lookup(path: string): FieldLabel | null {
  const key = normalizeFieldPath(path);
  const exact = EXACT[key];
  if (exact) return exact;
  for (const row of INDEXED) {
    const match = row.pattern.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    const rest = match[2] ?? "";
    const unit = typeof row.unit === "function" ? row.unit(rest) : row.unit;
    return { label: row.label(index, rest), unit };
  }
  return null;
}

/** True when `path` is in the catalog. A humanized fallback is not an entry. */
export function hasFieldLabel(path: string): boolean {
  return lookup(path) != null;
}

function inferUnit(path: string): string {
  if (/_ft$|speeds_ftmin$/.test(path)) return path.endsWith("speeds_ftmin") ? "ft/min" : "ft";
  if (/_in$/.test(path)) return "in";
  if (/_ppg$|density_ppg$/.test(path)) return "ppg";
  if (/_psi$/.test(path)) return "psi";
  if (/_gpm$/.test(path)) return "gpm";
  if (/bblPerStk$/.test(path)) return "bbl/stk";
  if (/bblPerStand$/.test(path)) return "bbl/stand";
  return "";
}

function humanize(path: string): FieldLabel {
  const body = path
    .replace(/\[(\d+)\]/g, (_, index: string) => ` ${Number(index) + 1} `)
    .replace(/\.(\d+)(?=\.|$)/g, (_, index: string) => ` ${Number(index) + 1} `)
    .replace(/[()[\].]/g, " ")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const label = body ? body.charAt(0).toUpperCase() + body.slice(1) : "Field";
  return { label: label === path ? `Field ${label}` : label, unit: inferUnit(path) };
}

/** `{ label, unit }` for a job path. An unknown path is a humanized string, never the raw path. */
export function fieldLabel(path: string): FieldLabel {
  return lookup(path) ?? humanize(path);
}
