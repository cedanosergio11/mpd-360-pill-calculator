// UI-facing re-export of Code Ninja's calc core (cedanosergio11/mpd-360-pill-calculator @ rebuild e232618).
// The core in src/lib/core is the source of truth; do not redefine types here.
export type {
  Job,
  Fluid,
  FannReading,
  ColumnSegment,
  CasingInterval,
  SurveyStation,
  TripInputs,
  Well,
  PillMode,
  PipeEnd,
  PumpInput,
  PumpError,
  PumpOutputResult,
  StrokesScheduleResult,
  StrokesScheduleRow,
  Result,
  DepthKey,
  DepthResult,
  Displacement,
  DisplacementStage,
  TripDirection,
  TripLimit,
  TripScheduleRow,
  Issue,
  IssueLevel,
} from "@/lib/core";
export type { TripEmw, TripPointKey, SpeedEmw } from "@/lib/core";
export {
  calculate,
  inputHash,
  CALC_VERSION,
  SCHEMA_VERSION,
  pumpOutput_bblPerStk,
  strokesSchedule,
} from "@/lib/core";
/** True once the core schema grows `pipeColumn` (fluid intervals inside the string). In core since e232618. */
export const HAS_PIPE_COLUMN = true as const;
