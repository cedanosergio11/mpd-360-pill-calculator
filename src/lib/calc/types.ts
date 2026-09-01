export type SectionType = "Production" | "Intermediate";
export type PillMode = "noSlug" | "withSlug";
export type ProcedureKind =
  | "standard"
  | "tapered"
  | "cement"
  | "steel"
  | "stage1";

export interface WellInputs {
  wellName: string;
  client: string;
  date: string;
  producedBy: string;
  sectionType: SectionType;
  pillMode: PillMode;

  currentDepthMd: number | "";
  anchorMd: number | "";
  anchorTvd: number | "";
  casingMd: number | "";
  casingTvd: number | "";
  spotMd: number | "";
  spotTvd: number | "";
  openHoleDia: number | "";
  odDp: number | "";
  idDp: number | "";
  idCasing: number | "";

  desiredEmw: number | "";
  currentMw: number | "";
  kmw: number | "";
  pumpDisp: number | "";
  sbpConnection: number | "";
  fit: number | "";
  maxFlowRate: number | "";

  desiredResolution: number | "";
  initialFlowRate: number | "";
  overbalanceSlug: number | "";
  safevisionNoSlug: number | "";
  topSlugBbl: number | "";

  taperedOn: boolean;
  casingIdLarger: number | "";
  casingShoeMdLarger: number | "";
  linerId: number | "";
  linerHangerMd: number | "";
  linerShoeMd: number | "";
  odDp1: number | "";
  idDp1: number | "";
  lengthDp1: number | "";
  odDp2: number | "";
  idDp2: number | "";

  cementDesiredEsd: number | "";
  newCasingOd: number | "";
  newCasingId: number | "";
  cementMw: number | "";
  tdDepth: number | "";

  customSwab: number[];
}

export interface TripPressure {
  speed: number;
  ppge: number;
  swabPressure: number;
  dynamicPressure: number;
}

export interface CementResults {
  staticPressure: number;
  annularCapacity: number;
  openHoleCapacity: number;
  casingStringCapacity: number;
  openHoleToBoc: number;
  bocToShoe: number;
  requiredPillHeight: number;
  requiredCementPillVol: number;
  totalCasingStringVol: number;
  chaseToTd: number;
  chaseExitCasing: number;
  chaseBocToShoe: number;
  chaseBocShoePlusPill: number;
  totalChase: number;
  topOfPill: number;
}

export interface TaperedResults {
  lengthDp2: number;
  openHoleLength: number;
  linerLength: number;
  totalPillVol: number;
  pillNeededAnnulus: number;
  dpVolume: number;
  mudInAnnulusAfterPumping: number;
  additionalChase: number;
  mudInDp: number;
}

export interface CalcResults {
  masp: number;
  initialApl: number;
  initialAplAnchor: number;
  drillStringCap: number;
  drillStringVolAtSpot: number;
  casingCap: number;
  casingVolAtSpot: number;
  annularCap: number;
  annularBelowShoe: number;
  annularAtSpot: number;
  openHoleCap: number;
  heightPillNoDp: number;
  totalPillVol: number;
  drillStringOpenHole: number;
  volumeBelowShoe: number;
  requiredVolAnnulus: number;
  correctedPillVol: number;
  calculatedChase: number;
  correctedChase: number;
  finalKwm: number;
  spottedKmwVol: number;
  kmwRoomWithPipe: number;
  minHeightPillWithDp: number;
  minHeightWithDp: number;
  balancedAdditionalPsi: number;
  addPpgCsg: number;
  addPpgTarget: number;
  balancedEsdCasing: number;
  esdCasingNoDp: number;
  anchorPointEsd: number;
  equalizeDumpBbl: number;
  remainingKmwInDp: number;
  airCapTopMd: number;
  resolutionHeightGain: number;
  resolutionPressureGain: number;
  pressureDifferential: number;
  pressureDifferentialSlug: number;
  staticStrippingPressure: number;
  maxDynamicSbp: number;
  maxSwabPressure: number;
  selectedTripTable: "6.75" | "7.875" | "8.5" | "other";
  tripPressures: TripPressure[];
  slugPressure: number;
  slugPillVol: number;
  strokesToPumpSlug: number;
  pillVolAtSpot: number;
  slugFits: boolean;
  slugFallOut: number;
  slugFallHeight: number;
  chaseWithSlug: number;
  slugPpgEquivalent: number;
  slugPsiEquivalent: number;
  slugApl: number;
  correctedSlugPill: number;
  totalPillVolAtSpotNoSlug: number;
  totalPillVolAtSpotWithSlug: number;
  topOfPillWithDp: number | "Surface";
  topOfPillNoDp: number;
  drillStringPillHeight: number;
  topOfPillInsideDp: number;
  kwmPlusChase: number;
  deltaSpotBackfill: number;
  bblBackfill: number;
  safevisionSlug: number;
  cement: CementResults;
  tapered: TaperedResults;
  procedurePossible: boolean;
  errorReason: string | null;
}

export interface ScheduleRow {
  step: number;
  sbp: number | "Open Choke";
  flow: number;
  volume: number;
  strokes: number;
  density: number;
  staticSbp: number;
  activityNotes: string;
  hiddenSbp: number;
}

export interface ScheduleResult {
  rows: ScheduleRow[];
  mode: PillMode;
  heavyVolume: number;
  finalVolume: number;
  finalStrokes: number;
}

export interface SteelRow {
  bitDepth: number;
  interfaceDepth: number;
  tripSpeed: number;
  surgePpg: number;
  emwStatic: number;
  emwDynamic: number;
  emwShoeStatic: number;
  sbpStatic: number;
  sbpDynamic: number;
  comment: string;
}

export interface WarningItem {
  level: "error" | "warn" | "info" | "ok";
  text: string;
}
