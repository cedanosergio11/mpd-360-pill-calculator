import type { DepthKey, EcdPoint } from "./engine";

/**
 * Sheet circulating ECD at a depth is `currentMw + initialAplAnchor / (0.052 * TVD)`.
 * At the anchor that is the SafeVision no-slug ECD the sheet already stored as APL.
 * At the shoe it is the same APL spread over the shoe TVD. The bit has no sheet ECD.
 * When MW, APL, or TVD cannot produce that number, the row falls back to static ESD.
 */
export type SheetBasis = "esd" | "ecd";

export interface SheetEcd {
  /** Static ESD fallbacks. */
  anchor?: number | null;
  shoe?: number | null;
  bit?: number | null;
  currentMw?: number | null;
  initialAplAnchor?: number | null;
  anchorTvd?: number | null;
  shoeTvd?: number | null;
}

export interface EcdComparison {
  depth: DepthKey;
  label: string;
  rp13dEcd: number | null;
  sheetEcd: number | null;
  /**
   * RP 13D ECD minus the sheet value, ppg. Null when either side is missing.
   * With `sheetBasis: "esd"` this is RP 13D ECD minus sheet ESD.
   * With `sheetBasis: "ecd"` this is RP 13D ECD minus the sheet circulating ECD
   * (`currentMw + initialAplAnchor / (0.052 * TVD)`).
   */
  difference: number | null;
  sheetBasis: SheetBasis;
}

const DEPTHS: { depth: DepthKey; label: string }[] = [
  { depth: "anchor", label: "Anchor" },
  { depth: "shoe", label: "Shoe" },
  { depth: "bit", label: "Bit" },
];

const PSI_PER_PPG_FT = 0.052;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Sheet ECD = currentMw + initialAplAnchor / (0.052 * TVD). Null when it cannot be computed. */
export function sheetCirculatingEcd(mw: unknown, apl: unknown, tvd: unknown): number | null {
  if (!finite(mw) || !finite(apl) || !finite(tvd) || !(tvd > 0)) return null;
  return mw + apl / (PSI_PER_PPG_FT * tvd);
}

function sheetAt(depth: DepthKey, sheet: SheetEcd): { value: number | null; basis: SheetBasis } {
  const tvd = depth === "anchor" ? sheet.anchorTvd : depth === "shoe" ? sheet.shoeTvd : null;
  const circulating = depth === "bit" ? null : sheetCirculatingEcd(sheet.currentMw, sheet.initialAplAnchor, tvd);
  if (circulating != null) return { value: circulating, basis: "ecd" };
  return { value: finite(sheet[depth]) ? sheet[depth] : null, basis: "esd" };
}

/**
 * RP 13D ECD beside the sheet value at the anchor, the shoe, and the bit.
 * The sheet numbers are passed in. This does not run the sheet.
 * Anchor and shoe use `currentMw + initialAplAnchor / (0.052 * TVD)` when that
 * can be computed (`sheetBasis: "ecd"`). Otherwise the static ESD (`sheetBasis: "esd"`).
 */
export function compareEcd(points: Pick<EcdPoint, "depth" | "ecd">[], sheet: SheetEcd): EcdComparison[] {
  return DEPTHS.map(({ depth, label }) => {
    const rp = points.find((point) => point.depth === depth);
    const rp13dEcd = rp && finite(rp.ecd) ? rp.ecd : null;
    const sheetSide = sheetAt(depth, sheet);
    const sheetEcd = sheetSide.value;
    return {
      depth,
      label,
      rp13dEcd,
      sheetEcd,
      difference: rp13dEcd != null && sheetEcd != null ? rp13dEcd - sheetEcd : null,
      sheetBasis: sheetSide.basis,
    };
  });
}
