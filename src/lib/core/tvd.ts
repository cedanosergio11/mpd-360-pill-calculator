import type { Well } from "./job.schema";

const TIE_FT = 0.5;

interface Tie {
  md: number;
  tvd: number;
}

/**
 * TVD profile.
 * Survey stations are piecewise-linear. With no survey, TVD is linear on
 * (md / mdTd) * tvdTd, with the supplied shoe and anchor TVDs kept as ties
 * so an entered shoe TVD is not replaced.
 * Does not clamp TVD to MD — a TVD above MD stays visible for TVD_GT_MD.
 */
export function surveyTies(well: Well): Tie[] {
  const ties: Tie[] = [{ md: 0, tvd: 0 }];
  const add = (md: number, tvd: number, override: boolean) => {
    if (!Number.isFinite(md) || !Number.isFinite(tvd) || md <= 0) return;
    const idx = ties.findIndex((tie) => Math.abs(tie.md - md) <= TIE_FT);
    if (idx >= 0) {
      if (override) ties[idx] = { md, tvd };
      return;
    }
    ties.push({ md, tvd });
  };
  for (const station of well.survey ?? []) add(station.md_ft, station.tvd_ft, false);
  add(well.shoeMd_ft, well.shoeTvd_ft, true);
  if (well.anchorTvd_ft != null && Number.isFinite(well.anchorTvd_ft)) {
    add(well.anchorMd_ft, well.anchorTvd_ft, true);
  }
  add(well.mdTd_ft, well.tvdTd_ft, true);
  ties.sort((a, b) => a.md - b.md);
  return ties;
}

/**
 * Piecewise-linear TVD from survey stations only.
 * Shoe, anchor, and TD ties are not used, so a stale TVD cannot pull the result.
 * `null` when `md` is past the last survey station. This does not extrapolate.
 * With no survey, `null` — there is no station to interpolate.
 */
export function surveyTvdAt(well: Well, md: number): number | null {
  if (!Number.isFinite(md)) return null;
  if (md <= 0) return 0;
  const stations = (well.survey ?? [])
    .filter((station) => Number.isFinite(station.md_ft) && Number.isFinite(station.tvd_ft) && station.md_ft >= 0)
    .map((station) => ({ md_ft: station.md_ft, tvd_ft: station.tvd_ft }))
    .sort((a, b) => a.md_ft - b.md_ft);
  if (stations.length === 0) return null;
  const last = stations[stations.length - 1];
  if (md > last.md_ft + 1e-4) return null;
  return tvdAt(
    {
      ...well,
      survey: stations,
      shoeMd_ft: Number.NaN,
      shoeTvd_ft: Number.NaN,
      anchorTvd_ft: undefined,
      mdTd_ft: Number.NaN,
      tvdTd_ft: Number.NaN,
    },
    md,
  );
}

/** Deepest survey station, or null when the well has none. */
export function lastSurveyMd(well: Well): number | null {
  let last: number | null = null;
  for (const station of well.survey ?? []) {
    if (!Number.isFinite(station.md_ft)) continue;
    if (last == null || station.md_ft > last) last = station.md_ft;
  }
  return last;
}

export function tvdAt(well: Well, md: number): number | null {
  if (!Number.isFinite(md)) return null;
  if (md <= 0) return 0;
  const ties = surveyTies(well);
  if (ties.length < 2) return null;
  if (md <= ties[0].md) {
    const first = ties[0];
    if (first.md <= 0) return first.tvd;
    return (md / first.md) * first.tvd;
  }
  for (let i = 1; i < ties.length; i++) {
    const a = ties[i - 1];
    const b = ties[i];
    if (md <= b.md + 1e-6) {
      const span = b.md - a.md;
      if (span <= 1e-9) return b.tvd;
      const t = (md - a.md) / span;
      return a.tvd + t * (b.tvd - a.tvd);
    }
  }
  const last = ties[ties.length - 1];
  const prev = ties[ties.length - 2];
  const span = last.md - prev.md;
  const slope = span > 1e-6 ? (last.tvd - prev.tvd) / span : last.md > 0 ? last.tvd / last.md : 1;
  return last.tvd + slope * (md - last.md);
}

export function resolvedAnchorTvd(well: Well): number | null {
  if (well.anchorTvd_ft != null && Number.isFinite(well.anchorTvd_ft)) return well.anchorTvd_ft;
  return tvdAt(well, well.anchorMd_ft);
}

export function onSurveyStation(well: Well, md: number): boolean {
  return (well.survey ?? []).some((station) => Math.abs(station.md_ft - md) <= TIE_FT);
}

export function interpolationHow(well: Well): "linear when no survey" | "from survey" {
  return (well.survey?.length ?? 0) > 0 ? "from survey" : "linear when no survey";
}
