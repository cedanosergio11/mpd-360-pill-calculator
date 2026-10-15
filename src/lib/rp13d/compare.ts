import type { DepthKey, EcdPoint } from "./engine";

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
  /** RP 13D ECD minus the sheet ECD, ppg. Null when either side is missing. */
  difference: number | null;
}

const DEPTHS: { depth: DepthKey; label: string }[] = [
  { depth: "anchor", label: "Anchor" },
  { depth: "shoe", label: "Shoe" },
  { depth: "bit", label: "Bit" },
];

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * RP 13D ECD beside the sheet ECD at the anchor, the shoe, and the bit.
 * The sheet numbers are passed in. This does not run the sheet.
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
    };
  });
}
