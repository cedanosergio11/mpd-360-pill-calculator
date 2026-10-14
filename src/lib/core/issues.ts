export type IssueLevel = "error" | "warn";

export interface Issue {
  level: IssueLevel;
  code: string;
  /**
   * Dotted path into the result (`depths.shoe.esd_ppg`) or, for input
   * problems, into the job (`fluids[1].fann.r300`).
   */
  field?: string;
  /** Job input paths that drive this result issue. Exact paths, never a whole section. */
  jobFields?: string[];
  /** Displacement stage numbers where this issue fires. */
  stages?: number[];
  message: string;
}

export function issue(
  level: IssueLevel,
  code: string,
  message: string,
  field?: string,
  jobFields?: string[],
): Issue {
  const item: Issue = { level, code, message };
  if (field !== undefined) item.field = field;
  if (jobFields != null && jobFields.length > 0) item.jobFields = jobFields;
  return item;
}

/** Errors that make hydrostatic results untrustworthy. */
export const STRUCTURE_ERRORS = new Set([
  "SCHEMA_VERSION",
  "COLUMN_GAP",
  "COLUMN_OVERLAP",
  "COLUMN_ORDER",
  "UNKNOWN_FLUID",
  "TVD_GT_MD",
]);

export function hasStructureError(issues: Issue[]): boolean {
  return issues.some((item) => item.level === "error" && STRUCTURE_ERRORS.has(item.code));
}

export function fannBlocked(issues: Issue[]): boolean {
  return issues.some(
    (item) =>
      item.level === "error" && (item.code === "MISSING_FANN" || item.code === "INVALID_FANN"),
  );
}
