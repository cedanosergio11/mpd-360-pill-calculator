import type { Job, StringSection } from "./job.schema";

/**
 * Excel paste for the 2.0 job.
 * `parseWellPaste` reads text only. `previewPaste` diffs that result against a job.
 * `applyPaste` writes the preview rows and nothing else.
 */

export interface PasteError {
  /** 1-based sheet row in the pasted block. */
  row: number;
  /** 1-based cell on that row. Column 1 is the label. */
  column: number;
  code:
    | "EMPTY"
    | "UNMAPPED_LABEL"
    | "BAD_NUMBER"
    | "BAD_DATE"
    | "BAD_SECTION"
    | "BAD_BOOL"
    | "UNIT_MISMATCH"
    | "NOT_A_2_0_INPUT"
    | "CONFLICTING_DUPLICATE";
  /** 2.0 field path when the label mapped, otherwise the raw label. */
  field: string;
  message: string;
}

export interface PasteIgnored {
  row: number;
  column: number;
  field: string;
  code: "CALCULATED" | "DUPLICATE";
  message: string;
}

export interface PasteMatch {
  /** 2.0 field path. */
  field: string;
  /** 1-based sheet row. */
  row: number;
  /** 1-based column of the value cell. */
  column: number;
  /** Recognized unit cell on that row, or null when the row has none. */
  unit: string | null;
}

/** Patch is a partial Job. Absent fields are left for the caller to keep. */
export interface PasteResult {
  ok: boolean;
  patch: Partial<Job>;
  /** Patched fields, in sheet order. `field` is the 2.0 path. */
  matched: PasteMatch[];
  ignored: PasteIgnored[];
  errors: PasteError[];
}

export type PastePreviewKind = "number" | "text" | "bool" | "date";

export interface PastePreviewRow {
  /** 2.0 field path. */
  field: string;
  /**
   * Unit shown with both values. The recognized sheet unit when the row has one,
   * otherwise the unit that field already uses. Null for text, bool, and date.
   * The unit is not written into `oldDisplay` or `newDisplay`.
   */
  unit: string | null;
  /**
   * How the engine formatted the display strings.
   * `number` uses the field precision. `bool` is Yes/No. `date` is ISO YYYY-MM-DD.
   * `text` is the value as stored.
   */
  kind: PastePreviewKind;
  /** Value on `job` at `field`, in `unit`. Null when the job has no value there. */
  oldValue: unknown;
  /** Coerced value from `result.patch`, in the same `unit`. */
  newValue: unknown;
  /** Engine-formatted `oldValue`. The UI prints this and does not format `oldValue`. */
  oldDisplay: string;
  /** Engine-formatted `newValue`. The UI prints this and does not format `newValue`. */
  newDisplay: string;
  /** 1-based sheet row, copied from `matched`. */
  row: number;
  /** 1-based value column, copied from `matched.column`. */
  col: number;
}

export interface PastePreviewError {
  code: PasteError["code"];
  row: number;
  /** `PasteError.column`. */
  col: number;
  message: string;
  /**
   * True when this code blocks apply.
   * Blocking codes: `BAD_NUMBER`, `CONFLICTING_DUPLICATE`, `EMPTY`, `BAD_DATE`,
   * `BAD_SECTION`, `BAD_BOOL`, `UNIT_MISMATCH`.
   * `UNMAPPED_LABEL` and `NOT_A_2_0_INPUT` are false.
   */
  blocking: boolean;
}

export interface PastePreview {
  rows: PastePreviewRow[];
  errors: PastePreviewError[];
  /** False when any `errors` entry has `blocking: true`. */
  canApply: boolean;
}

const BLOCKING: ReadonlySet<PasteError["code"]> = new Set([
  "BAD_NUMBER",
  "CONFLICTING_DUPLICATE",
  "EMPTY",
  "BAD_DATE",
  "BAD_SECTION",
  "BAD_BOOL",
  "UNIT_MISMATCH",
]);

type Kind = "text" | "number" | "date" | "section" | "bool";
type Disposition = "store" | "not2" | "switch";

interface FieldRule {
  field: string;
  kind: Kind;
  labels: string[];
  disposition: Disposition;
}

interface Cell {
  text: string;
  column: number;
}

interface Hit {
  field: string;
  value: unknown;
  row: number;
  column: number;
  unit: string | null;
}

const UNIT_NORMS = new Set(
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
  { field: "wellName", kind: "text", labels: ["well name"], disposition: "store" },
  { field: "client", kind: "text", labels: ["client"], disposition: "not2" },
  { field: "date", kind: "date", labels: ["date"], disposition: "not2" },
  { field: "producedBy", kind: "text", labels: ["produced by"], disposition: "not2" },
  { field: "currentDepthMd", kind: "number", labels: ["current well depth"], disposition: "store" },
  {
    field: "anchorMd",
    kind: "number",
    labels: ["anchor point boc md", "anchor boc md", "anchor point md", "anchor / boc md"],
    disposition: "store",
  },
  {
    field: "anchorTvd",
    kind: "number",
    labels: ["anchor point boc tvd", "anchor boc tvd", "anchor point tvd", "anchor / boc tvd"],
    disposition: "store",
  },
  { field: "casingMd", kind: "number", labels: ["casing depth md"], disposition: "store" },
  { field: "casingTvd", kind: "number", labels: ["casing depth tvd"], disposition: "store" },
  { field: "spotMd", kind: "number", labels: ["spot depth md"], disposition: "store" },
  { field: "spotTvd", kind: "number", labels: ["spot depth tvd"], disposition: "store" },
  { field: "openHoleDia", kind: "number", labels: ["open hole diameter"], disposition: "store" },
  { field: "desiredEmw", kind: "number", labels: ["desired emw"], disposition: "store" },
  { field: "odDp", kind: "number", labels: ["od drill pipe", "od dp"], disposition: "store" },
  { field: "idDp", kind: "number", labels: ["id drill pipe", "id dp"], disposition: "store" },
  { field: "idCasing", kind: "number", labels: ["id casing"], disposition: "store" },
  { field: "currentMw", kind: "number", labels: ["current mw"], disposition: "store" },
  { field: "pumpDisp", kind: "number", labels: ["pump displacement"], disposition: "store" },
  { field: "kmw", kind: "number", labels: ["kmw", "kwm"], disposition: "store" },
  { field: "sbpConnection", kind: "number", labels: ["sbp on connection"], disposition: "store" },
  { field: "fit", kind: "number", labels: ["fit"], disposition: "store" },
  { field: "maxFlowRate", kind: "number", labels: ["max flow rate"], disposition: "not2" },
  { field: "desiredResolution", kind: "number", labels: ["desired resolution"], disposition: "not2" },
  { field: "initialFlowRate", kind: "number", labels: ["initial flow rate"], disposition: "store" },
  {
    field: "overbalanceSlug",
    kind: "number",
    labels: ["over balance pressure for slug", "overbalance for slug"],
    disposition: "not2",
  },
  {
    field: "safevisionNoSlug",
    kind: "number",
    labels: ["safevision anchor point ecd", "safevision ap ecd no slug", "safevision no slug"],
    disposition: "not2",
  },
  {
    field: "sectionType",
    kind: "section",
    labels: ["production or intermediate", "section type"],
    disposition: "not2",
  },
  { field: "topSlugBbl", kind: "number", labels: ["top slug"], disposition: "not2" },
  { field: "tdDepth", kind: "number", labels: ["td depth"], disposition: "store" },
  {
    field: "cementDesiredEsd",
    kind: "number",
    labels: ["desired esd for offline cement"],
    disposition: "not2",
  },
  { field: "newCasingOd", kind: "number", labels: ["new casing od"], disposition: "not2" },
  { field: "newCasingId", kind: "number", labels: ["new casing id"], disposition: "not2" },
  { field: "cementMw", kind: "number", labels: ["mw"], disposition: "not2" },
  {
    field: "taperedOn",
    kind: "bool",
    labels: ["tapered string casing trigger", "tapered casing"],
    disposition: "switch",
  },
  { field: "casingIdLarger", kind: "number", labels: ["casing id larger"], disposition: "store" },
  {
    field: "casingShoeMdLarger",
    kind: "number",
    labels: ["casing shoe depth md larger"],
    disposition: "store",
  },
  { field: "linerId", kind: "number", labels: ["liner id"], disposition: "store" },
  { field: "linerHangerMd", kind: "number", labels: ["liner hanger"], disposition: "store" },
  { field: "linerShoeMd", kind: "number", labels: ["liner shoe"], disposition: "store" },
  { field: "odDp1", kind: "number", labels: ["od drill pipe 1"], disposition: "store" },
  { field: "idDp1", kind: "number", labels: ["id drill pipe 1"], disposition: "store" },
  { field: "lengthDp1", kind: "number", labels: ["length of dp 1"], disposition: "store" },
  { field: "odDp2", kind: "number", labels: ["od drill pipe 2"], disposition: "store" },
  { field: "idDp2", kind: "number", labels: ["id drill pipe 2"], disposition: "store" },
];

/** Expected unit norms for stored numeric fields. A unit outside the list is `UNIT_MISMATCH`. */
const EXPECTED_UNITS: Record<string, readonly string[]> = {
  currentDepthMd: ["ft", "md"],
  tdDepth: ["ft", "md"],
  anchorMd: ["ft", "md"],
  anchorTvd: ["ft", "tvd"],
  casingMd: ["ft", "md"],
  casingTvd: ["ft", "tvd"],
  spotMd: ["ft", "md"],
  spotTvd: ["ft", "tvd"],
  openHoleDia: ["in"],
  desiredEmw: ["ppg", "ppge"],
  odDp: ["in"],
  idDp: ["in"],
  idCasing: ["in"],
  currentMw: ["ppg", "ppge"],
  pumpDisp: ["bbl stk", "bbls stk"],
  kmw: ["ppg", "ppge"],
  sbpConnection: ["psi"],
  fit: ["ppg", "ppge"],
  initialFlowRate: ["gpm"],
  odDp1: ["in"],
  idDp1: ["in"],
  lengthDp1: ["ft"],
  odDp2: ["in"],
  idDp2: ["in"],
  casingIdLarger: ["in"],
  casingShoeMdLarger: ["ft", "md"],
  linerId: ["in"],
  linerHangerMd: ["ft", "md"],
  linerShoeMd: ["ft", "md"],
};

function norm(value: string): string {
  return value
    .toLowerCase()
    .replace(/prodcution/g, "production")
    .replace(/[()]/g, " ")
    .replace(/[/_.,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnit(cell: string): boolean {
  return UNIT_NORMS.has(norm(cell));
}

function isSkipLabel(label: string): boolean {
  const n = norm(label);
  return SKIP_LABELS.some((skip) => n === skip || n.startsWith(`${skip} `) || n.includes(skip));
}

function matchRule(label: string): FieldRule | null {
  const n = norm(label);
  if (!n || isSkipLabel(n) || isUnit(n)) return null;
  let best: FieldRule | null = null;
  let bestLen = 0;
  for (const rule of RULES) {
    for (const candidate of rule.labels) {
      if (n === candidate || n.startsWith(candidate) || (candidate.length > 8 && n.includes(candidate))) {
        if (candidate.length > bestLen) {
          best = rule;
          bestLen = candidate.length;
        }
      }
    }
  }
  return best;
}

/** Thousands separators only: exactly three digits, then end, `.`, or another comma. */
function parseStrictNumber(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== ",") {
      out += ch;
      continue;
    }
    const rest = text.slice(i + 1);
    if (!/^\d{3}(?:$|\.|,)/.test(rest)) return null;
  }
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(out)) return null;
  const n = Number(out);
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: string): string | null {
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
  return null;
}

function parseSection(raw: string): "Production" | "Intermediate" | null {
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

function sameValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b);
}

function cellsFromHtml(html: string): string[][] {
  const rows: string[][] = [];
  const trs = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const tr of trs) {
    const tds = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
      match[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    );
    if (tds.some((cell) => cell)) rows.push(tds);
  }
  return rows;
}

function sheetRows(text: string): { row: number; cells: string[] }[] {
  if (text.includes("<table") || text.includes("<tr")) {
    return cellsFromHtml(text).map((cells, index) => ({ row: index + 1, cells }));
  }
  return text.split(/\r?\n/).map((line, index) => ({
    row: index + 1,
    cells: line.split("\t"),
  }));
}

function nonempty(cells: string[]): Cell[] {
  const out: Cell[] = [];
  cells.forEach((text, index) => {
    const trimmed = text.trim();
    if (trimmed) out.push({ text: trimmed, column: index + 1 });
  });
  return out;
}

function error(
  row: number,
  column: number,
  code: PasteError["code"],
  field: string,
  message: string,
): PasteError {
  return { row, column, code, field, message };
}

function primaryPath(field: string): string {
  switch (field) {
    case "wellName":
      return "name";
    case "currentDepthMd":
      return "well.bitMd_ft";
    case "tdDepth":
      return "well.mdTd_ft";
    case "anchorMd":
      return "well.anchorMd_ft";
    case "anchorTvd":
      return "well.anchorTvd_ft";
    case "casingMd":
      return "well.shoeMd_ft";
    case "casingTvd":
      return "well.shoeTvd_ft";
    case "spotMd":
      return "spot.bottomMd_ft";
    case "spotTvd":
      return "well.survey.spot";
    case "openHoleDia":
      return "well.openHoleId_in";
    case "desiredEmw":
      return "well.targetEmw_ppg";
    case "odDp":
      return "well.stringOd_in";
    case "idDp":
      return "well.stringId_in";
    case "idCasing":
      return "well.casing.0.id_in";
    case "currentMw":
      return "fluids.0.density_ppg";
    case "kmw":
      return "fluids.1.density_ppg";
    case "pumpDisp":
      return "pump.bblPerStk";
    case "sbpConnection":
      return "trip.sbpConn_psi";
    case "fit":
      return "well.fit_ppg";
    case "initialFlowRate":
      return "trip.flow_gpm";
    default:
      return field;
  }
}

interface Assignment {
  field: string;
  value: unknown;
  row: number;
  column: number;
  unit: string | null;
}

function num(hits: Map<string, Hit>, field: string): number | null {
  const hit = hits.get(field);
  return hit && typeof hit.value === "number" ? hit.value : null;
}

function assignmentsFrom(hits: Map<string, Hit>): Assignment[] {
  const out: Assignment[] = [];
  const push = (field: string, value: unknown, source: Hit, unit: string | null) => {
    out.push({ field, value, row: source.row, column: source.column, unit });
  };
  const direct = (field: string) => {
    const hit = hits.get(field);
    if (!hit) return;
    push(primaryPath(field), hit.value, hit, hit.unit);
  };

  for (const field of [
    "wellName",
    "anchorMd",
    "anchorTvd",
    "casingTvd",
    "openHoleDia",
    "desiredEmw",
    "odDp",
    "idDp",
    "idCasing",
    "currentMw",
    "kmw",
    "pumpDisp",
    "sbpConnection",
    "fit",
    "initialFlowRate",
  ]) {
    direct(field);
  }

  const depth = hits.get("currentDepthMd");
  if (depth) {
    push("well.bitMd_ft", depth.value, depth, depth.unit);
    if (!hits.has("tdDepth")) push("well.mdTd_ft", depth.value, depth, depth.unit);
  }
  const td = hits.get("tdDepth");
  if (td) push("well.mdTd_ft", td.value, td, td.unit);

  const shoe = hits.get("casingMd");
  if (shoe) {
    push("well.shoeMd_ft", shoe.value, shoe, shoe.unit);
    push("well.casing.0.bottomMd_ft", shoe.value, shoe, shoe.unit);
  }

  const spotMd = hits.get("spotMd");
  const spotTvd = hits.get("spotTvd");
  if (spotMd) push("spot.bottomMd_ft", spotMd.value, spotMd, spotMd.unit);
  if (spotMd && spotTvd) {
    push(
      "well.survey.spot",
      { md_ft: spotMd.value, tvd_ft: spotTvd.value },
      spotTvd,
      spotTvd.unit,
    );
  }

  const bit = num(hits, "currentDepthMd");
  const od1 = num(hits, "odDp1");
  const id1 = num(hits, "idDp1");
  const len1 = num(hits, "lengthDp1");
  const od2 = num(hits, "odDp2");
  const id2 = num(hits, "idDp2");
  if (od1 != null && id1 != null && len1 != null && od2 != null && id2 != null && bit != null) {
    const length2 = bit - len1;
    if (length2 > 0) {
      const source = hits.get("lengthDp1")!;
      const sections: StringSection[] = [
        { length_ft: len1, od_in: od1, id_in: id1 },
        { length_ft: length2, od_in: od2, id_in: id2 },
      ];
      push("well.stringSections", sections, source, null);
    }
  }

  const largerId = num(hits, "casingIdLarger");
  const largerShoe = num(hits, "casingShoeMdLarger");
  if (largerId != null && largerShoe != null) {
    const source = hits.get("casingIdLarger")!;
    const top = num(hits, "casingMd") ?? 0;
    push(
      "well.casing.1",
      { topMd_ft: top, bottomMd_ft: largerShoe, id_in: largerId },
      source,
      source.unit,
    );
  }

  const linerId = num(hits, "linerId");
  const hanger = num(hits, "linerHangerMd");
  const linerShoe = num(hits, "linerShoeMd");
  if (linerId != null && hanger != null && linerShoe != null) {
    const source = hits.get("linerId")!;
    const index = largerId != null && largerShoe != null ? 2 : 1;
    push(
      `well.casing.${index}`,
      { topMd_ft: hanger, bottomMd_ft: linerShoe, id_in: linerId, liner: true },
      source,
      source.unit,
    );
  }

  return out;
}

function canonicalUnit(path: string): string | null {
  if (path.endsWith("bblPerStk")) return "bbl/stk";
  if (path.endsWith("_ppg") || path.endsWith("density_ppg")) return "ppg";
  if (path.endsWith("_psi")) return "psi";
  if (path.endsWith("_gpm")) return "gpm";
  if (path.endsWith("_in") || path.endsWith("id_in")) return "in";
  if (path.endsWith("_ft")) return "ft";
  return null;
}

export function getPath(root: unknown, path: string): unknown {
  let cursor: unknown = root;
  for (const part of path.split(".")) {
    if (cursor == null || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor === undefined ? null : cursor;
}

export function setPath(root: object, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor: unknown = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = parts[i + 1];
    const parent = cursor as Record<string, unknown>;
    if (parent[key] == null) parent[key] = /^\d+$/.test(next) ? [] : {};
    cursor = parent[key];
  }
  const last = parts[parts.length - 1];
  const stored = value != null && typeof value === "object" ? structuredClone(value) : value;
  (cursor as Record<string, unknown>)[last] = stored;
}

function applySpot(job: Job, bottom: number): void {
  let pill: { topMd_ft: number; bottomMd_ft: number } | null = null;
  const surface = job.column[0]?.fluidId;
  for (const segment of job.column) {
    if (segment.fluidId === surface) continue;
    if (!pill || segment.bottomMd_ft >= pill.bottomMd_ft) {
      pill = segment;
    }
  }
  if (pill) pill.bottomMd_ft = bottom;
}

function applySurveySpot(job: Job, station: { md_ft: number; tvd_ft: number }): void {
  const survey = job.well.survey ? [...job.well.survey] : [];
  const index = survey.findIndex((row) => Math.abs(row.md_ft - station.md_ft) <= 0.5);
  if (index >= 0) survey[index] = { ...station };
  else survey.push({ ...station });
  survey.sort((a, b) => a.md_ft - b.md_ft);
  job.well.survey = survey;
}

export function parseWellPaste(text: string): PasteResult {
  const rows = sheetRows(text);
  const errors: PasteError[] = [];
  const ignored: PasteIgnored[] = [];
  const hits = new Map<string, Hit>();
  let conflict = false;
  let usable = 0;

  for (const sheetRow of rows) {
    const cells = nonempty(sheetRow.cells);
    if (cells.length < 2) continue;
    usable += 1;
    let matchedRule = false;
    let skipped = false;
    for (let i = 0; i < cells.length; i++) {
      const labelCell = cells[i];
      if (isSkipLabel(labelCell.text)) {
        ignored.push({
          row: sheetRow.row,
          column: labelCell.column,
          field: labelCell.text,
          code: "CALCULATED",
          message: `${labelCell.text} is calculated and was not pasted.`,
        });
        skipped = true;
        break;
      }
      if (isUnit(labelCell.text)) continue;
      const rule = matchRule(labelCell.text);
      if (!rule) continue;
      matchedRule = true;

      let valueCell: Cell | undefined;
      let unitText: string | null = null;
      let unitColumn = labelCell.column;
      for (let j = i + 1; j < cells.length; j++) {
        if (isUnit(cells[j].text)) {
          if (unitText == null) {
            unitText = cells[j].text;
            unitColumn = cells[j].column;
          }
          continue;
        }
        valueCell = cells[j];
        break;
      }
      if (!valueCell) break;

      const path = primaryPath(rule.field);
      if (rule.disposition === "store" && unitText != null) {
        const allowed = EXPECTED_UNITS[rule.field];
        if (!allowed?.includes(norm(unitText))) {
          errors.push(
            error(
              sheetRow.row,
              unitColumn,
              "UNIT_MISMATCH",
              path,
              `${unitText} is not a unit for ${path}.`,
            ),
          );
          break;
        }
      }

      if (rule.disposition === "not2") {
        if (rule.kind === "date" && parseDate(valueCell.text) == null) {
          errors.push(
            error(sheetRow.row, valueCell.column, "BAD_DATE", rule.field, `${valueCell.text} is not a date.`),
          );
        } else if (rule.kind === "section" && parseSection(valueCell.text) == null) {
          errors.push(
            error(
              sheetRow.row,
              valueCell.column,
              "BAD_SECTION",
              rule.field,
              `${valueCell.text} is not Production or Intermediate.`,
            ),
          );
        } else {
          const message =
            rule.field === "safevisionNoSlug"
              ? "ECD is computed by emwProfile, not pasted from a SafeVision cell."
              : `${labelCell.text} is not a 2.0 input.`;
          errors.push(error(sheetRow.row, labelCell.column, "NOT_A_2_0_INPUT", rule.field, message));
        }
        break;
      }

      if (rule.disposition === "switch") {
        if (parseBool(valueCell.text) == null) {
          errors.push(
            error(
              sheetRow.row,
              valueCell.column,
              "BAD_BOOL",
              rule.field,
              `${valueCell.text} is not a yes or no.`,
            ),
          );
        }
        break;
      }

      let coerced: unknown;
      if (rule.kind === "text") coerced = valueCell.text;
      else if (rule.kind === "number") {
        coerced = parseStrictNumber(valueCell.text);
        if (coerced == null) {
          errors.push(
            error(
              sheetRow.row,
              valueCell.column,
              "BAD_NUMBER",
              path,
              `${valueCell.text} is not a number.`,
            ),
          );
          break;
        }
      } else break;

      const previous = hits.get(rule.field);
      if (previous) {
        if (sameValue(previous.value, coerced)) {
          ignored.push({
            row: sheetRow.row,
            column: labelCell.column,
            field: path,
            code: "DUPLICATE",
            message: `${labelCell.text} repeats ${path} with the same value.`,
          });
        } else {
          conflict = true;
          errors.push(
            error(
              sheetRow.row,
              labelCell.column,
              "CONFLICTING_DUPLICATE",
              path,
              `${labelCell.text} repeats ${path} with a different value.`,
            ),
          );
        }
        break;
      }

      hits.set(rule.field, {
        field: rule.field,
        value: coerced,
        row: sheetRow.row,
        column: valueCell.column,
        unit: unitText,
      });
      break;
    }

    if (!matchedRule && !skipped) {
      const label = cells.find((cell) => !isUnit(cell.text));
      if (label) {
        errors.push(
          error(
            sheetRow.row,
            label.column,
            "UNMAPPED_LABEL",
            label.text,
            `${label.text} does not match a paste field.`,
          ),
        );
      }
    }
  }

  if (usable === 0) {
    return {
      ok: false,
      patch: {},
      matched: [],
      ignored,
      errors: [error(0, 0, "EMPTY", "", "The paste has no usable row.")],
    };
  }

  if (conflict) {
    return { ok: false, patch: {}, matched: [], ignored, errors };
  }

  const assignments = assignmentsFrom(hits);
  const patch = {};
  for (const row of assignments) setPath(patch, row.field, row.value);
  const matched: PasteMatch[] = assignments.map((row) => ({
    field: row.field,
    row: row.row,
    column: row.column,
    unit: row.unit,
  }));
  return {
    ok: matched.length > 0 && errors.length === 0,
    patch: patch as Partial<Job>,
    matched,
    ignored,
    errors,
  };
}

function kindOf(value: unknown): PastePreviewKind | null {
  if (value == null) return null;
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "bool";
  if (value instanceof Date) return "date";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return "date";
  return "text";
}

/** Display step for a number. ppg 0.1, in 0.001, ft 1, psi 1, bbl 0.01, gpm 1. */
function precisionStep(unit: string | null, field: string): number {
  const token = (unit ?? "").toLowerCase().replace(/\s+/g, "");
  if (token === "ppg" || token === "ppge" || field.endsWith("_ppg") || field.endsWith("density_ppg")) return 0.1;
  if (token === "in" || field.endsWith("_in")) return 0.001;
  if (token === "psi" || field.endsWith("_psi")) return 1;
  if (token === "gpm" || field.endsWith("_gpm")) return 1;
  if (
    token === "bbl" ||
    token === "bbl/stk" ||
    token === "bblstk" ||
    field.endsWith("bblPerStk") ||
    field.endsWith("_bbl")
  ) {
    return 0.01;
  }
  return 1;
}

function formatDisplay(value: unknown, kind: PastePreviewKind, unit: string | null, field: string): string {
  if (value == null) return "";
  if (kind === "bool") {
    if (value === true) return "Yes";
    if (value === false) return "No";
    return "";
  }
  if (kind === "date") {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    if (typeof value === "string") {
      const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
      return match ? match[1] : value;
    }
    return "";
  }
  if (kind === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) return "";
    const step = precisionStep(unit, field);
    const digits = step >= 1 ? 0 : Math.round(-Math.log10(step));
    return value.toFixed(digits);
  }
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function previewPaste(job: Job, result: PasteResult): PastePreview {
  const rows: PastePreviewRow[] = result.matched.map((match) => {
    const oldValue = getPath(job, match.field);
    const newValue = getPath(result.patch, match.field);
    const unit = match.unit ?? canonicalUnit(match.field);
    const kind = kindOf(newValue) ?? kindOf(oldValue) ?? "text";
    return {
      field: match.field,
      unit,
      kind,
      oldValue,
      newValue,
      oldDisplay: formatDisplay(oldValue, kind, unit, match.field),
      newDisplay: formatDisplay(newValue, kind, unit, match.field),
      row: match.row,
      col: match.column,
    };
  });
  const errors: PastePreviewError[] = result.errors.map((item) => ({
    code: item.code,
    row: item.row,
    col: item.column,
    message: item.message,
    blocking: BLOCKING.has(item.code),
  }));
  return { rows, errors, canApply: errors.every((item) => !item.blocking) };
}

export function applyPaste(job: Job, preview: PastePreview): Job {
  if (!preview.canApply) throw new Error("Paste is blocked and was not applied.");
  const next = structuredClone(job) as Job & { presetBaseline?: string };
  delete next.presetBaseline;
  for (const row of preview.rows) {
    if (row.field === "spot.bottomMd_ft" && typeof row.newValue === "number") {
      applySpot(next, row.newValue);
      continue;
    }
    if (
      row.field === "well.survey.spot" &&
      row.newValue != null &&
      typeof row.newValue === "object" &&
      "md_ft" in row.newValue &&
      "tvd_ft" in row.newValue
    ) {
      applySurveySpot(next, row.newValue as { md_ft: number; tvd_ft: number });
      continue;
    }
    setPath(next, row.field, row.newValue);
  }
  next.meta = { modified: true, isExample: false };
  return next;
}
