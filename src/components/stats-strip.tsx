import { bbl, ft, ppg2, psi, signedFt } from "@/lib/pill/format";
import { emwAt, hydrostaticLayers, pressureAt, tvdFn } from "@/lib/pill/hydrostatic";
import type { PillModel, WellState } from "@/lib/pill/types";

type Props = {
  state: WellState;
  model: PillModel;
  equalized?: boolean;
  anchorMd?: number | null;
};

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-xs font-medium tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-medium tracking-tight text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

export function StatsStrip({ state, model, equalized = false, anchorMd = null }: Props) {
  const tripDetail =
    model.pipeDelta > 0
      ? "Run below placement point"
      : model.pipeDelta < 0
        ? model.pipeDelta > 0
          ? `Run in · trip tank gain ${model.tripTankGain.toFixed(1)} bbl`
          : `Pulled · trip tank fill ${model.backfillVolume.toFixed(1)} bbl`
        : "At placement depth";

  const layers = hydrostaticLayers(state, model);
  const toTvd = tvdFn(state);
  const emwDepth =
    anchorMd != null && Number.isFinite(anchorMd) && anchorMd > 0 ? anchorMd : state.wellDepth;
  const anchorEmw = emwAt(emwDepth, layers, toTvd, state.baseMw);
  const anchorPsi = pressureAt(emwDepth, layers, toTvd, state.baseMw);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat
        label="Annular pill"
        value={bbl(model.annularKmwVolume)}
        detail={`${ft(model.pillTop).replace(" ft", "")}–${ft(model.pillBottom)}`}
      />
      <Stat
        label="KMW in string"
        value={bbl(model.pipeKmwInHole)}
        detail={
          model.pipeKmwInHole > 0.05
            ? model.pipeChaseInHole > 0.05
              ? `Chase ${bbl(model.pipeChaseInHole)} on KMW to bit`
              : model.pipeKmwTop > 80
                ? `Air to ${ft(model.pipeKmwTop)} · KMW to bit`
                : `Float holding from ${ft(model.pipeKmwTop)} to bit`
            : "String displaced / empty of KMW"
        }
      />
      <Stat
        label="Pipe movement"
        value={signedFt(model.pipeDelta)}
        detail={tripDetail}
      />
      <Stat
        label="Anchor point EMW"
        value={ppg2(anchorEmw)}
        detail={`${psi(anchorPsi)} at ${ft(emwDepth)}`}
      />
    </div>
  );
}
