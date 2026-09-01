import type { ReactNode } from "react";
import { bbl, ft, ppg, ppg2, psi } from "@/lib/pill/format";
import { emwAt, hydrostaticLayers, pressureAt, tvdFn } from "@/lib/pill/hydrostatic";
import { volumeBelowDepth } from "@/lib/pill/physics";
import type { PillModel, WellState } from "@/lib/pill/types";

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-medium tracking-wide text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-xs tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function AnalysisPanels({
  state,
  model,
}: {
  state: WellState;
  model: PillModel;
}) {
  const layers = hydrostaticLayers(state, model);
  const toTvd = tvdFn(state);
  const volumeBelowPipe = volumeBelowDepth(state, state.pipeDepth, state.pipeDepth);
  const annulusToPipe = model.annularBblFt * state.pipeDepth;
  const points = [
    { label: "Surface", depth: 0 },
    { label: "Pill top", depth: model.pillTop },
    { label: "Pill bottom", depth: model.pillBottom },
    { label: "Pipe shoe", depth: state.pipeDepth },
    { label: "TD", depth: state.wellDepth },
  ];
  const tdEmw = emwAt(state.wellDepth, layers, toTvd, state.baseMw);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Panel title="Volume balance">
        <Row label="Annular capacity" value={`${model.annularBblFt.toFixed(4)} bbl/ft`} />
        <Row label="Pipe displacement" value={`${model.pipeBblFt.toFixed(4)} bbl/ft`} />
        <Row label="Open hole" value={`${model.openHoleBblFt.toFixed(4)} bbl/ft`} />
        <Row label="Annulus to shoe" value={bbl(annulusToPipe, 2)} />
        <Row label="Open hole below shoe" value={bbl(volumeBelowPipe, 2)} />
        <Row label="Placed annular pill" value={bbl(model.annularKmwVolume)} />
        {model.kmwBackfillRequired > 0.5 ? (
          <Row
            label="KMW backfill POOH"
            value={`${bbl(model.kmwBackfillApplied)} of ${bbl(model.kmwBackfillRequired)}`}
          />
        ) : null}
        <Row label="KMW remaining in string" value={bbl(model.pipeKmwInHole)} />
        <Row
          label="Total KMW after pumping"
          value={bbl(state.pillVolume + model.pipeKmwInHole)}
        />
        <Row
          label={model.pipeDelta > 0 ? "Trip tank gain" : "Trip tank fill"}
          value={bbl(model.pipeDelta > 0 ? model.tripTankGain : model.backfillVolume)}
        />
        <Row label="Fill zone (contiguous)" value={bbl(model.fillZoneVolume)} />
        {state.pipeEnd === "open" ? (
          <Row label="Pipe-bore contribution" value={bbl(model.pipeFluidVolume)} />
        ) : null}
        <Row
          label="POOH 1,000 ft fill"
          value={bbl(model.pipeBblFt * 1000)}
        />
      </Panel>
      <Panel title="Hydrostatic snapshot">
        {points.map((point) => (
          <Row
            key={point.label}
            label={`${point.label} · ${ft(point.depth)}`}
            value={`${psi(pressureAt(point.depth, layers, toTvd, state.baseMw))} · ${ppg2(emwAt(point.depth, layers, toTvd, state.baseMw))}`}
          />
        ))}
        <Row label="Bottomhole EMW" value={ppg2(tdEmw)} />
        <div className="mt-3 grid gap-1.5">
          {layers.map((layer) => (
            <div
              key={`${layer.name}-${layer.top}`}
              className="flex items-baseline justify-between gap-3 text-xs"
            >
              <span className="text-muted-foreground">
                {ft(layer.top)}–{ft(layer.bottom)} · {layer.name}
              </span>
              <span className="font-mono tabular-nums text-muted-foreground">{ppg(layer.mw)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
