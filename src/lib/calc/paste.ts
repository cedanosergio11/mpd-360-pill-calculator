import { DEPTH_BEYOND_TD, depthBeyondFields, depthBlockMessage } from "./depth";
import type { DepthField, SectionType, WellInputs } from "./types";

type FieldKind = "text" | "number" | "date" | "section" | "bool";

type FieldRule = {
  field: keyof WellInputs;
  kind: FieldKind;
  labels: string[];
};

const UNITS = new Set(
  [
    "ft",
    "ft.",
    "in",
    "in.",
    "ppg",
    "ppge",
    "ppge.",
    "psi",
    "gpm",
    "bbl",
    "bbls",
    "bbls.",
    "bbl/stk",
    "bbls/stk",
    "bbls/ft",
    "bbls/ft.",
    "stk",
    "md",
    "tvd",
  ].map(norm),
);

const SKIP_LABELS = [
  "masp",
  "drill string capacity",
  "drill string volume",
  "casing capacity",
  "annular capacity",
  "open hole capacity",
  "height of pill",
  "total pill volume",
  "required pill",
  "corrected pill",
  "chase volume",
  "final kwm",
  "min height",
  "balanced",
  "static stripping",
  "max dynamic",
  "slug pressure",
  "slug pill",
  "strokes to pump",
  "trip speeds",
  "swab ap",
  "dynamic pressure",
  "engineering inputs",
  "horizontal section",
  "relevant pill",
  "pill calculations",
  "calculations",
  "only trigger",
].map(norm);

const RULES: FieldRule[] = [
  { field: "wellName", kind: "text", labels: ["well name"] },
  { field: "client", kind: "text", labels: ["client"] },
  { field: "date", kind: "date", labels: ["date"] },
  { field: "producedBy", kind: "text", labels: ["produced by"] },
  { field: "currentDepthMd", kind: "number", labels: ["current well depth"] },
  { field: "anchorMd", kind: "number", labels: ["anchor point boc md", "anchor boc md", "anchor point md", "anchor / boc md"] },
  { field: "anchorTvd", kind: "number", labels: ["anchor point boc tvd", "anchor boc tvd", "anchor point tvd", "anchor / boc tvd"] },
  { field: "casingMd", kind: "number", labels: ["casing depth md"] },
  { field: "casingTvd", kind: "number", labels: ["casing depth tvd"] },
  { field: "spotMd", kind: "number", labels: ["spot depth md"] },
  { field: "spotTvd", kind: "number", labels: ["spot depth tvd"] },
  { field: "openHoleDia", kind: "number", labels: ["open hole diameter"] },
  { field: "desiredEmw", kind: "number", labels: ["desired emw"] },
  { field: "odDp", kind: "number", labels: ["od drill pipe", "od dp"] },
  { field: "idDp", kind: "number", labels: ["id drill pipe", "id dp"] },
  { field: "idCasing", kind: "number", labels: ["id casing"] },
  { field: "currentMw", kind: "number", labels: ["current mw"] },
  { field: "pumpDisp", kind: "number", labels: ["pump displacement"] },
  { field: "kmw", kind: "number", labels: ["kmw", "kwm"] },
  { field: "sbpConnection", kind: "number", labels: ["sbp on connection"] },
  { field: "fit", kind: "number", labels: ["fit"] },
  { field: "maxFlowRate", kind: "number", labels: ["max flow rate"] },
  { field: "desiredResolution", kind: "number", labels: ["desired resolution"] },
  { field: "initialFlowRate", kind: "number", labels: ["initial flow rate"] },
  { field: "overbalanceSlug", kind: "number", labels: ["over balance pressure for slug", "overbalance for slug"] },
  {
    field: "safevisionNoSlug",
    kind: "number",
    labels: ["safevision anchor point ecd", "safevision ap ecd no slug", "safevision no slug"],
  },
  { field: "sectionType", kind: "section", labels: ["production or intermediate", "section type"] },
  { field: "topSlugBbl", kind: "number", labels: ["top slug"] },
  { field: "tdDepth", kind: "number", labels: ["td depth"] },
  { field: "cementDesiredEsd", kind: "number", labels: ["desired esd for offline cement"] },
  { field: "newCasingOd", kind: "number", labels: ["new casing od"] },
  { field: "newCasingId", kind: "number", labels: ["new casing id"] },
  { field: "cementMw", kind: "number", labels: ["mw"] },
  { field: "taperedOn", kind: "bool", labels: ["tapered string casing trigger", "tapered casing"] },
  { field: "casingIdLarger", kind: "number", labels: ["casing id larger"] },
  { field: "casingShoeMdLarger", kind: "number", labels: ["casing shoe depth md larger"] },
  { field: "linerId", kind: "number", labels: ["liner id"] },
  { field: "linerHangerMd", kind: "number", labels: ["liner hanger"] },
  { field: "linerShoeMd", kind: "number", labels: ["liner shoe"] },
  { field: "odDp1", kind: "number", labels: ["od drill pipe 1"] },
  { field: "idDp1", kind: "number", labels: ["id drill pipe 1"] },
  { field: "lengthDp1", kind: "number", labels: ["length of dp 1"] },
  { field: "odDp2", kind: "number", labels: ["od drill pipe 2"] },
  { field: "idDp2", kind: "number", labels: ["id drill pipe 2"] },
];

export function norm(value: string) {
  return value
    .toLowerCase()
    .replace(/prodcution/g, "production")
    .replace(/[()]/g, " ")
    .replace(/[/_.,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnit(cell: string) {
  return UNITS.has(norm(cell));
}

function isSkipLabel(label: string) {
  const n = norm(label);
  return SKIP_LABELS.some((s) => n === s || n.startsWith(s + " ") || n.includes(s));
}

function matchRule(label: string): FieldRule | null {
  const n = norm(label);
  if (!n || isSkipLabel(n) || isUnit(n)) return null;
  let best: FieldRule | null = null;
  let bestLen = 0;
  for (const rule of RULES) {
    for (const label of rule.labels) {
      if (n === label || n.startsWith(label) || (label.length > 8 && n.includes(label))) {
        if (label.length > bestLen) {
          best = rule;
          bestLen = label.length;
        }
      }
    }
  }
  return best;
}

function parseNumber(raw: string): number | "" {
  const cleaned = raw.replace(/,/g, "").replace(/[^\d.eE+-]/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : "";
}

/** Thousands groups of three, or a plain number. "1,5" and "1,2345" are not numbers. */
const STRICT_NUMBER = /^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/;

function strictNumber(raw: string): number | "" | "bad" {
  const trimmed = raw.trim();
  if (!trimmed || isUnit(trimmed)) return "";
  if (!STRICT_NUMBER.test(trimmed)) return "bad";
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : "bad";
}

function parseDate(raw: string): string {
  const t = raw.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dotted = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dotted) {
    const month = dotted[1].padStart(2, "0");
    const day = dotted[2].padStart(2, "0");
    let year = dotted[3];
    if (year.length === 2) year = Number(year) >= 70 ? `19${year}` : `20${year}`;
    return `${year}-${month}-${day}`;
  }
  const serial = Number(t);
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    return utc.toISOString().slice(0, 10);
  }
  return t;
}

function parseSection(raw: string): SectionType | null {
  const n = norm(raw);
  if (n.includes("intermediate")) return "Intermediate";
  if (n.includes("production")) return "Production";
  return null;
}

function parseBool(raw: string): boolean | null {
  const n = norm(raw);
  if (["on", "yes", "true", "1"].includes(n)) return true;
  if (["off", "no", "false", "0"].includes(n)) return false;
  return null;
}

function coerce(kind: FieldKind, raw: string): WellInputs[keyof WellInputs] | undefined {
  const trimmed = raw.trim();
  if (!trimmed || isUnit(trimmed)) return undefined;
  if (kind === "text") return trimmed;
  if (kind === "number") {
    const n = parseNumber(trimmed);
    return n === "" ? undefined : n;
  }
  if (kind === "date") return parseDate(trimmed);
  if (kind === "section") return parseSection(trimmed) ?? undefined;
  if (kind === "bool") {
    const b = parseBool(trimmed);
    return b == null ? undefined : b;
  }
  return undefined;
}

function cellsFromHtml(html: string): string[][] {
  const rows: string[][] = [];
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trs) {
    const tds = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) =>
      m[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (tds.some((c) => c)) rows.push(tds);
  }
  return rows;
}

function cellsFromText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\t/))
    .filter((row) => row.some((c) => c.trim()));
}

const FIELD_LABELS: Partial<Record<keyof WellInputs, string>> = {
  wellName: "Well name",
  client: "Client",
  date: "Date",
  producedBy: "Produced by",
  currentDepthMd: "Current well depth",
  anchorMd: "Anchor point MD",
  anchorTvd: "Anchor point TVD",
  casingMd: "Casing depth MD",
  casingTvd: "Casing depth TVD",
  spotMd: "Spot depth MD",
  spotTvd: "Spot depth TVD",
  openHoleDia: "Open hole diameter",
  desiredEmw: "Desired EMW",
  odDp: "OD drill pipe",
  idDp: "ID drill pipe",
  idCasing: "ID casing",
  currentMw: "Current MW",
  pumpDisp: "Pump displacement",
  kmw: "KMW",
  sbpConnection: "SBP on connection",
  fit: "FIT",
  maxFlowRate: "Max flow rate",
  desiredResolution: "Desired resolution",
  initialFlowRate: "Initial flow rate",
  overbalanceSlug: "Overbalance for slug",
  safevisionNoSlug: "SafeVision AP ECD",
  sectionType: "Section type",
  topSlugBbl: "Top slug",
  tdDepth: "TD depth",
  taperedOn: "Tapered casing",
};

export interface PastePreviewRow {
  field: keyof WellInputs;
  label: string;
  oldValue: WellInputs[keyof WellInputs];
  newValue: WellInputs[keyof WellInputs];
  changed: boolean;
}

export interface PastePreviewError {
  code: "BAD_NUMBER" | typeof DEPTH_BEYOND_TD;
  message: string;
  blocking: true;
  fields?: DepthField[];
}

export interface PastePreview {
  rows: PastePreviewRow[];
  errors: PastePreviewError[];
  canApply: boolean;
}

function sameValue(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number" && Number.isFinite(left) && Number.isFinite(right)) {
    return Math.abs(left - right) <= 1e-4;
  }
  return left === right;
}

function labelFor(field: keyof WellInputs): string {
  return FIELD_LABELS[field] ?? field;
}

type Collected = {
  patch: Partial<WellInputs>;
  matched: (keyof WellInputs)[];
  errors: PastePreviewError[];
};

function collectPaste(text: string, strict: boolean): Collected {
  const html = text.includes("<table") || text.includes("<tr") ? cellsFromHtml(text) : [];
  const rows = html.length ? html : cellsFromText(text);
  const patch: Partial<WellInputs> = {};
  const matched: (keyof WellInputs)[] = [];
  const errors: PastePreviewError[] = [];

  for (const row of rows) {
    const cells = row.map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells.length < 2) continue;
    for (let i = 0; i < cells.length - 1; i++) {
      const rule = matchRule(cells[i]);
      if (!rule || rule.field in patch) continue;
      let value: string | undefined;
      for (let j = i + 1; j < cells.length; j++) {
        if (isUnit(cells[j])) continue;
        value = cells[j];
        break;
      }
      if (value == null) continue;
      if (strict && rule.kind === "number") {
        const parsed = strictNumber(value);
        if (parsed === "bad") {
          errors.push({
            code: "BAD_NUMBER",
            message: `${labelFor(rule.field)} is not a number ("${value.trim()}").`,
            blocking: true,
          });
          matched.push(rule.field);
          break;
        }
        if (parsed === "") continue;
        (patch as Record<string, unknown>)[rule.field] = parsed;
        matched.push(rule.field);
        break;
      }
      const coerced = coerce(rule.kind, value);
      if (coerced === undefined) continue;
      (patch as Record<string, unknown>)[rule.field] = coerced;
      matched.push(rule.field);
      break;
    }
  }

  return { patch, matched, errors };
}

export function parseWellPaste(text: string): {
  patch: Partial<WellInputs>;
  matched: string[];
} {
  const { patch, matched } = collectPaste(text, false);
  return { patch, matched };
}

function previewRow(
  current: WellInputs,
  field: keyof WellInputs,
  newValue: WellInputs[keyof WellInputs],
): PastePreviewRow {
  const oldValue = current[field];
  return {
    field,
    label: labelFor(field),
    oldValue,
    newValue,
    changed: !sameValue(oldValue, newValue),
  };
}

/**
 * Preview a sheet paste. Does not write.
 * "Current well depth" maps to `currentDepthMd` only.
 * TVDs are the sheet fields in the paste. A changed MD does not recompute its TVD.
 * An MD or TVD past TD blocks.
 */
export function previewPaste(current: WellInputs, text: string): PastePreview {
  const { patch, matched, errors } = collectPaste(text, true);
  const rows = matched
    .filter((field) => field in patch)
    .map((field) => previewRow(current, field, patch[field] as WellInputs[keyof WellInputs]));

  if (errors.length) return { rows, errors, canApply: false };

  const projected: WellInputs = { ...current, ...patch };
  const depthFields = depthBeyondFields(projected);
  if (depthFields.length) {
    errors.push({
      code: DEPTH_BEYOND_TD,
      message: depthBlockMessage(depthFields),
      blocking: true,
      fields: depthFields,
    });
  }
  return { rows, errors, canApply: errors.length === 0 };
}

/** Apply a preview. Throws when the preview is blocked, and writes nothing. */
export function applyPaste(current: WellInputs, preview: PastePreview): WellInputs {
  if (!preview.canApply) throw new Error("Paste is blocked and was not applied.");
  const next: WellInputs = { ...current };
  for (const row of preview.rows) {
    (next as unknown as Record<string, unknown>)[row.field] = row.newValue;
  }
  return next;
}

export function applyWellPaste(current: WellInputs, patch: Partial<WellInputs>): WellInputs {
  return { ...current, ...patch };
}
