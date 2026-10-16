import { isNum, round } from "@/lib/utils";

declare const bblBrand: unique symbol;
declare const ftBrand: unique symbol;
declare const bblPerFtBrand: unique symbol;

/** Oilfield barrels (42 gal). */
export type Bbl = number & { readonly [bblBrand]: "bbl" };
/** Measured depth, feet. */
export type Ft = number & { readonly [ftBrand]: "ft" };
/** Capacity, barrels per foot. */
export type BblPerFt = number & { readonly [bblPerFtBrand]: "bbl/ft" };

export function bbl(value: number): Bbl {
  return value as Bbl;
}

export function ft(value: number): Ft {
  return value as Ft;
}

export function bblPerFt(value: number): BblPerFt {
  return value as BblPerFt;
}

/**
 * Placed annulus volume, bbl.
 *
 * Sheet Inputs!H20 = ROUND(IF(H22=0, H19−H21, H19), 0).
 * H19 is the annulus share, H21 is the signed chase, H22 = MAX(H21, 0).
 * Chase ≤ 0 means the string cannot hold the inside share. That excess
 * (|H21|) is placed in the annulus, so pumped volume equals placed volume:
 * annulus = H19 + |H21|. A positive chase leaves the annulus share unchanged.
 */
export function placedAnnulusBbl(annulusShareBbl: Bbl, chaseBbl: Bbl): Bbl {
  if (!isNum(annulusShareBbl)) return bbl(Number.NaN);
  const placed = isNum(chaseBbl) && chaseBbl <= 0 ? annulusShareBbl - chaseBbl : annulusShareBbl;
  return bbl(round(placed, 0));
}

/** Top of a uniform column, ft MD: spot depth minus volume / capacity. */
export function columnTopFt(spotMdFt: Ft, volumeBbl: Bbl, capacityBblPerFt: BblPerFt): Ft {
  if (!isNum(spotMdFt) || !isNum(volumeBbl) || !isNum(capacityBblPerFt) || Math.abs(capacityBblPerFt) < 1e-12) {
    return ft(Number.NaN);
  }
  return ft(spotMdFt - volumeBbl / capacityBblPerFt);
}
