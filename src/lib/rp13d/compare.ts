import type { DepthKey, EcdPoint } from "./engine";

/**
 * 1.0.7.1 does not compute a circulating ECD at the anchor, the shoe, or the bit.
 * The anchor "ECD" on the sheet is the SafeVision value typed in (`safevisionNoSlug`).
 * `initialApl` only turns that input into psi, and `safevisionSlug` adds the slug
 * fallout to the same input. The shoe figures (`esdCasingNoDp`, `balancedEsdCasing`)
 * are static ESD. The bit has no ECD. The number beside RP 13D is that static ESD.
 */
export type SheetBasis = "esd" | "ecd";

export interface SheetEcd {
  anchor?: number | null;
  shoe?: number | null;
  bit?: number | null;
}

export interface EcdComparison {
  depth: DepthKey;
  label: string;
  rp13dEcd: number | null;
  sheetEcd: number | null;
  /**
   * RP 13D ECD minus the sheet value, ppg. Null when either side is missing.
   * With `sheetBasis: "esd"` this is RP 13D ECD minus sheet ESD.
   * With `sheetBasis: "ecd"` it would be RP 13D ECD minus the sheet's circulating ECD.
   */
  difference: number | null;
  /** `esd` while the sheet has no circulating ECD at this depth. */
  sheetBasis: SheetBasis;
}

const DEPTHS: { depth: DepthKey; label: string }[] = [
  { depth: "anchor", label: "Anchor" },
  { depth: "shoe", label: "Shoe" },
  { depth: "bit", label: "Bit" },
];

/** Every depth on the 1.0.7.1 sheet. There is no circulating ECD to prefer. */
const SHEET_BASIS: SheetBasis = "esd";

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * RP 13D ECD beside the sheet value at the anchor, the shoe, and the bit.
 * The sheet numbers are passed in. This does not run the sheet.
 * Difference is RP 13D ECD minus sheet ESD, because `sheetBasis` is `esd`.
 */
export function compareEcd(points: Pick<EcdPoint, "depth" | "ecd">[], sheet: SheetEcd): EcdComparison[] {
  return DEPTHS.map(({ depth, label }) => {
    const rp = points.find((point) => point.depth === depth);
    const rp13dEcd = rp && finite(rp.ecd) ? rp.ecd : null;
    const sheetEcd = finite(sheet[depth]) ? sheet[depth] : null;
    return {
      depth,
      label,
      rp13dEcd,
      sheetEcd,
      difference: rp13dEcd != null && sheetEcd != null ? rp13dEcd - sheetEcd : null,
      sheetBasis: SHEET_BASIS,
    };
  });
}
