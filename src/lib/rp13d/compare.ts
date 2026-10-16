import type { DepthKey, EcdPoint } from "./engine";

/**
 * Annular friction is taken from surface down to the point, then
 * ECD = currentMw + frictionPsi / (0.052 * TVD).
 *
 * At the anchor the sheet's friction is `initialAplAnchor`
 * (SafeVision no-slug turned into psi). At the shoe the sheet has no
 * friction from surface to the shoe — `initialAplAnchor` is not scaled
 * onto the shoe TVD. The shoe then uses the static ESD. The bit has no
 * sheet ECD and stays empty.
 */
export type SheetBasis = "esd" | "ecd";

export interface SheetEcd {
  /** Static ESD fallbacks. The bit value is not used. */
  anchor?: number | null;
  shoe?: number | null;
  bit?: number | null;
  currentMw?: number | null;
  /** Annular friction from surface to the anchor, psi. */
  initialAplAnchor?: number | null;
  anchorTvd?: number | null;
  /**
   * Annular friction from surface to the shoe, psi.
   * Omit it when the sheet has no such number. Do not pass the anchor APL here.
   */
  shoeFrictionPsi?: number | null;
  shoeTvd?: number | null;
}

export interface EcdComparison {
  depth: DepthKey;
  label: string;
  rp13dEcd: number | null;
  sheetEcd: number | null;
  /** Why this row has no RP 13D ECD. The bit past the survey is "needs survey to bit". */
  reason: string | null;
  /**
   * RP 13D ECD minus the sheet value, ppg. Null when either side is missing.
   * With `sheetBasis: "esd"` this is RP 13D ECD minus sheet ESD.
   * With `sheetBasis: "ecd"` this is RP 13D ECD minus the sheet circulating ECD
   * (`currentMw + friction to that point / (0.052 * TVD)`).
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

/** currentMw + frictionPsi / (0.052 * TVD). Null when any input cannot be used. */
export function sheetCirculatingEcd(mw: unknown, frictionPsi: unknown, tvd: unknown): number | null {
  if (!finite(mw) || !finite(frictionPsi) || !finite(tvd) || !(tvd > 0)) return null;
  return mw + frictionPsi / (PSI_PER_PPG_FT * tvd);
}

function fallback(value: unknown): { value: number | null; basis: SheetBasis } {
  return { value: finite(value) ? value : null, basis: "esd" };
}

function sheetAt(depth: DepthKey, sheet: SheetEcd): { value: number | null; basis: SheetBasis } {
  if (depth === "bit") return { value: null, basis: "esd" };
  if (depth === "anchor") {
    const circulating = sheetCirculatingEcd(sheet.currentMw, sheet.initialAplAnchor, sheet.anchorTvd);
    if (circulating != null) return { value: circulating, basis: "ecd" };
    return fallback(sheet.anchor);
  }
  const circulating = sheetCirculatingEcd(sheet.currentMw, sheet.shoeFrictionPsi, sheet.shoeTvd);
  if (circulating != null) return { value: circulating, basis: "ecd" };
  return fallback(sheet.shoe);
}

/**
 * RP 13D ECD beside the sheet value at the anchor, the shoe, and the bit.
 * The sheet numbers are passed in. This does not run the sheet.
 * The anchor uses `currentMw + initialAplAnchor / (0.052 * anchorTVD)`.
 * The shoe uses `currentMw + shoeFrictionPsi / (0.052 * shoeTVD)` only when
 * that friction is supplied. Otherwise the shoe is the static ESD.
 * The bit stays empty.
 */
export function compareEcd(
  points: Pick<EcdPoint, "depth" | "ecd" | "reason">[],
  sheet: SheetEcd,
): EcdComparison[] {
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
      reason: rp?.reason ?? null,
    };
  });
}
