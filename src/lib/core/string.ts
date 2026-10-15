import { annularBblFt, capBblFt } from "@/lib/utils";
import type { StringSection, Well } from "./job.schema";

export type StringVolumeKind = "capacity" | "closed" | "open";

export interface PlacedStringSection {
  topMd_ft: number;
  bottomMd_ft: number;
  length_ft: number;
  id_in: number;
  od_in: number;
  /** ID² / 1029.4. */
  capacity_bblFt: number;
  /** OD² / 1029.4. */
  closedDisplacement_bblFt: number;
  /** (OD² − ID²) / 1029.4. */
  openDisplacement_bblFt: number;
}

/** True when the job lists string sections. A single OD/ID stays on the legacy path. */
export function usesTaperedString(well: Well): boolean {
  return (well.stringSections?.length ?? 0) > 0;
}

function rates(
  section: StringSection,
): Pick<
  PlacedStringSection,
  "capacity_bblFt" | "closedDisplacement_bblFt" | "openDisplacement_bblFt"
> | null {
  if (!Number.isFinite(section.length_ft) || !(section.length_ft > 0)) return null;
  if (!Number.isFinite(section.id_in) || !(section.id_in > 0)) return null;
  if (!Number.isFinite(section.od_in) || !(section.od_in > section.id_in)) return null;
  const capacity_bblFt = capBblFt(section.id_in);
  const closedDisplacement_bblFt = capBblFt(section.od_in);
  const openDisplacement_bblFt = annularBblFt(section.od_in, section.id_in);
  if (!(capacity_bblFt > 0) || !(closedDisplacement_bblFt > 0) || !(openDisplacement_bblFt > 0)) {
    return null;
  }
  return { capacity_bblFt, closedDisplacement_bblFt, openDisplacement_bblFt };
}

/**
 * String sections placed from the surface downward.
 * No `stringSections` entry is one section of the single OD/ID over the bit depth.
 */
export function placedStringSections(well: Well): PlacedStringSection[] | null {
  if (!usesTaperedString(well)) {
    const length = well.bitMd_ft;
    if (!Number.isFinite(length) || length < 0) return null;
    const rated = rates({
      length_ft: Math.max(length, 1e-9),
      id_in: well.stringId_in,
      od_in: well.stringOd_in,
    });
    if (!rated || length === 0) {
      if (length === 0 && rated) {
        return [
          {
            topMd_ft: 0,
            bottomMd_ft: 0,
            length_ft: 0,
            id_in: well.stringId_in,
            od_in: well.stringOd_in,
            ...rated,
          },
        ];
      }
      return null;
    }
    return [
      {
        topMd_ft: 0,
        bottomMd_ft: length,
        length_ft: length,
        id_in: well.stringId_in,
        od_in: well.stringOd_in,
        ...rated,
      },
    ];
  }
  let cursor = 0;
  const placed: PlacedStringSection[] = [];
  for (const section of well.stringSections ?? []) {
    const rated = rates(section);
    if (!rated) return null;
    const topMd_ft = cursor;
    cursor += section.length_ft;
    placed.push({
      topMd_ft,
      bottomMd_ft: cursor,
      length_ft: section.length_ft,
      id_in: section.id_in,
      od_in: section.od_in,
      ...rated,
    });
  }
  return placed;
}

/** Section covering `md`. A shared boundary belongs to the deeper section. */
export function stringSectionAt(well: Well, md: number): PlacedStringSection | null {
  const sections = placedStringSections(well);
  if (!sections) return null;
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const last = i === sections.length - 1;
    const inside =
      md >= section.topMd_ft - 1e-6 &&
      (md < section.bottomMd_ft - 1e-9 || (last && md <= section.bottomMd_ft + 1e-6));
    if (inside) return section;
  }
  return null;
}

/**
 * Capacity or displacement over an MD interval, summed section by section.
 * A single pipe is `rate × length`, the same product the rest of the core already uses.
 */
export function stringVolumeBbl(
  well: Well,
  from: number,
  to: number,
  kind: StringVolumeKind,
): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (to <= from + 1e-12) return 0;
  if (!usesTaperedString(well)) {
    const rate =
      kind === "capacity"
        ? capBblFt(well.stringId_in)
        : kind === "closed"
          ? capBblFt(well.stringOd_in)
          : annularBblFt(well.stringOd_in, well.stringId_in);
    if (!(rate > 0)) return null;
    return rate * (to - from);
  }
  const sections = placedStringSections(well);
  if (!sections) return null;
  let volume = 0;
  for (const section of sections) {
    const top = Math.max(from, section.topMd_ft);
    const bottom = Math.min(to, section.bottomMd_ft);
    if (bottom <= top) continue;
    const rate =
      kind === "capacity"
        ? section.capacity_bblFt
        : kind === "closed"
          ? section.closedDisplacement_bblFt
          : section.openDisplacement_bblFt;
    volume += rate * (bottom - top);
  }
  return volume;
}

/** MD reached by walking `volume` bbl of string capacity upward from `fromMd`. */
export function mdAboveByStringCapacity(well: Well, fromMd: number, volume: number): number | null {
  if (!Number.isFinite(fromMd) || !Number.isFinite(volume) || volume < 0) return null;
  if (!usesTaperedString(well)) {
    const cap = capBblFt(well.stringId_in);
    if (!(cap > 0)) return null;
    return fromMd - volume / cap;
  }
  const sections = placedStringSections(well);
  if (!sections) return null;
  let need = volume;
  let cursor = fromMd;
  for (let i = sections.length - 1; i >= 0 && need > 1e-10; i--) {
    const section = sections[i];
    if (section.bottomMd_ft <= 0 || section.topMd_ft >= cursor - 1e-9) continue;
    const bottom = Math.min(cursor, section.bottomMd_ft);
    const top = section.topMd_ft;
    const span = bottom - top;
    if (span <= 1e-12) continue;
    const held = section.capacity_bblFt * span;
    if (held >= need - 1e-10) return bottom - need / section.capacity_bblFt;
    need -= held;
    cursor = top;
  }
  const cap = sections[0]?.capacity_bblFt;
  if (!(cap > 0)) return null;
  return cursor - need / cap;
}
