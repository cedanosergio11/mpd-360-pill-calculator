import type { HydroLayer, PillModel, SurveyPoint, WellState } from "./types";

export const PSI_PER_PPG_FT = 0.052;
export const ATMOSPHERIC_PSI = 14.7;

export type EmwPoint = {
  depth: number;
  tvd: number;
  pressure: number;
  emw: number;
  localMw: number;
  layer: string;
};

export type TvdFn = (md: number) => number;

export function tvdAt(survey: SurveyPoint[] | undefined, md: number): number {
  if (!(md > 0)) return 0;
  const pts = (survey ?? [])
    .filter((p) => Number.isFinite(p.md) && Number.isFinite(p.tvd) && p.md >= 0)
    .sort((a, b) => a.md - b.md);
  if (pts.length === 0) return md;

  if (md <= pts[0].md) {
    const first = pts[0];
    if (first.md <= 0) return Math.min(md, Math.max(0, first.tvd));
    return Math.max(0, Math.min(md, (md / first.md) * first.tvd));
  }

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (md <= b.md) {
      const t = (md - a.md) / Math.max(1e-9, b.md - a.md);
      const tvd = a.tvd + t * (b.tvd - a.tvd);
      return Math.max(0, Math.min(md, tvd));
    }
  }

  const last = pts[pts.length - 1];
  const prev = pts.length > 1 ? pts[pts.length - 2] : { md: 0, tvd: 0 };
  const span = last.md - prev.md;
  const slope = span > 1e-6 ? (last.tvd - prev.tvd) / span : 1;
  const tvd = last.tvd + Math.max(0, Math.min(1, slope)) * (md - last.md);
  return Math.max(0, Math.min(md, tvd));
}

export function tvdFn(state: Pick<WellState, "survey">): TvdFn {
  return (md) => tvdAt(state.survey, md);
}

export function hydrostaticLayers(
  state: WellState,
  model: PillModel,
): HydroLayer[] {
  const layers: HydroLayer[] = [];
  let cursor = 0;

  const push = (bottom: number, mw: number, name: string) => {
    if (bottom <= cursor + 0.05) return;
    layers.push({ top: cursor, bottom, mw, name });
    cursor = bottom;
  };

  if (model.fluidDrop > 0) push(model.fluidDrop, 0, "Empty");
  if (model.fillZoneDepth > cursor) {
    push(model.fillZoneDepth, state.baseMw, "Fill zone");
  }
  if (model.pillTop > cursor) push(model.pillTop, state.baseMw, "Base fluid");
  if (model.pillBottom > cursor) {
    push(model.pillBottom, state.pillMw, "KMW pill");
  }
  if (state.wellDepth > cursor) {
    push(state.wellDepth, state.baseMw, "Base fluid");
  }
  return layers;
}

export function pressureAt(
  depth: number,
  layers: HydroLayer[],
  tvdOf: TvdFn = (d) => d,
  baseMw?: number,
) {
  const tvd = Math.max(0, tvdOf(Math.max(0, depth)));
  if (baseMw != null && baseMw > 0) {
    // Sheet convention: base fluid on TVD, KMW extra on MD height.
    let extraMd = 0;
    for (const layer of layers) {
      if (depth <= layer.top) break;
      const top = layer.top;
      const bottom = Math.min(depth, layer.bottom);
      if (bottom > top) extraMd += (layer.mw - baseMw) * (bottom - top);
    }
    return baseMw * PSI_PER_PPG_FT * tvd + extraMd * PSI_PER_PPG_FT;
  }
  let psi = 0;
  for (const layer of layers) {
    if (depth <= layer.top) break;
    const top = layer.top;
    const bottom = Math.min(depth, layer.bottom);
    if (bottom <= top) continue;
    const h = Math.max(0, tvdOf(bottom) - tvdOf(top));
    if (h > 0) psi += layer.mw * PSI_PER_PPG_FT * h;
  }
  return psi;
}

export function layerAt(depth: number, layers: HydroLayer[]) {
  return (
    layers.find((layer) => depth >= layer.top && depth <= layer.bottom) ??
    layers[layers.length - 1] ??
    null
  );
}

/** Static equivalent mud weight. Pressure uses TVD; extra KMW height is MD (Excel). */
export function emwAt(
  depth: number,
  layers: HydroLayer[],
  tvdOf: TvdFn = (d) => d,
  baseMw?: number,
) {
  const tvd = tvdOf(depth);
  if (!(tvd > 0)) {
    return layerAt(0, layers)?.mw ?? 0;
  }
  return pressureAt(depth, layers, tvdOf, baseMw) / (PSI_PER_PPG_FT * tvd);
}

export function sampleEmwProfile(
  wellDepth: number,
  layers: HydroLayer[],
  tvdOf: TvdFn = (d) => d,
  baseMw?: number,
  stepCount = 240,
): EmwPoint[] {
  const depths = new Set<number>([0, wellDepth]);
  const step = Math.max(2, wellDepth / stepCount);
  for (let d = step; d < wellDepth; d += step) depths.add(d);
  for (const layer of layers) {
    depths.add(layer.top);
    depths.add(Math.min(wellDepth, layer.top + 0.05));
    depths.add(layer.bottom);
    depths.add(Math.max(0, layer.bottom - 0.05));
  }

  return [...depths]
    .filter((d) => d >= 0 && d <= wellDepth)
    .sort((a, b) => a - b)
    .map((depth) => {
      const layer = layerAt(depth, layers);
      const pressure = pressureAt(depth, layers, tvdOf, baseMw);
      const tvd = tvdOf(depth);
      return {
        depth,
        tvd,
        pressure,
        emw: emwAt(depth, layers, tvdOf, baseMw),
        localMw: layer?.mw ?? 0,
        layer: layer?.name ?? "",
      };
    });
}

export function niceTicks(min: number, max: number, target = 6): number[] {
  const span = max - min;
  if (!(span > 0) || !Number.isFinite(span)) return [min];
  const raw = span / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / mag;
  const step = residual >= 5 ? 5 * mag : residual >= 2 ? 2 * mag : mag;
  const start = Math.ceil((min - 1e-9) / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + 1e-6; v += step) {
    ticks.push(Number(v.toFixed(8)));
  }
  if (ticks[0] !== min) ticks.unshift(min);
  if (ticks[ticks.length - 1] !== max) ticks.push(max);
  return ticks;
}
