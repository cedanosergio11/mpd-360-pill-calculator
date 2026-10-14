export type IssueLevel = "error" | "warn";

export interface Issue {
  level: IssueLevel;
  code: string;
  /** Dotted path into the job, e.g. `fluids[1].fann.r300`. */
  field?: string;
  message: string;
}

export function issue(level: IssueLevel, code: string, message: string, field?: string): Issue {
  return field === undefined ? { level, code, message } : { level, code, field, message };
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
