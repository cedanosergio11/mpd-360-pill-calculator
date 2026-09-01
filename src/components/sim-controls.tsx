import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, MapPin, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { SimNumberField } from "@/components/sim-number-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { bblFt, ft, ppg } from "@/lib/pill/format";
import { useSimulator } from "@/lib/pill/store";
import type { PillModel, PipeEnd, WellState } from "@/lib/pill/types";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col rounded-md bg-secondary p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-sm px-2 text-xs font-medium transition-colors duration-150",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SimToolbar({
  state,
  model,
  inputs,
  results,
}: {
  state: WellState;
  model: PillModel;
  inputs: WellInputs;
  results: CalcResults;
}) {
  const sim = useSimulator();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Move pipe
          </div>
          <div className="mt-1 font-mono text-2xl tabular-nums leading-none text-foreground">
            {ft(state.pipeDepth)}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Segmented<"as-pumped" | "equalized">
            value={sim.equalized ? "equalized" : "as-pumped"}
            options={[
              { value: "as-pumped", label: "As pumped" },
              { value: "equalized", label: "Equalized" },
            ]}
            onChange={(value) => sim.setEqualized(value === "equalized", inputs, results)}
          />
          <Segmented<PipeEnd>
            value={state.pipeEnd}
            options={[
              { value: "closed", label: "Float" },
              { value: "open", label: "Open" },
            ]}
            onChange={sim.setPipeEnd}
          />
          <div className="flex h-11 items-center justify-between gap-2 rounded-md border border-border px-3">
            <Label htmlFor="auto-backfill" className="text-xs text-foreground">
              Trip Tank On
            </Label>
            <Switch
              id="auto-backfill"
              checked={state.autoBackfill}
              onCheckedChange={sim.setAutoBackfill}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="h-11 w-full sm:w-auto"
            onClick={() => {
              sim.placeFromProcedure(inputs, results);
              toast.success("Pill reset from procedure");
            }}
          >
            <RotateCcw className="size-4" />
            From procedure
          </Button>
        </div>
      </div>
      <input
        className="mt-4"
        type="range"
        min={0}
        max={state.wellDepth}
        step={50}
        value={state.pipeDepth}
        aria-label="Pipe depth"
        onChange={(event) => sim.setPipeDepth(Number(event.target.value), state)}
      />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          variant="secondary"
          data-action="bump-up-500"
          onClick={() => sim.bumpPipe(-500, state)}
        >
          <ArrowUp className="size-4" />
          Up 500
        </Button>
        <Button variant="secondary" onClick={() => sim.bumpPipe(-100, state)}>
          <ArrowUp className="size-4" />
          Up 100
        </Button>
        <Button variant="secondary" onClick={() => sim.bumpPipe(100, state)}>
          <ArrowDown className="size-4" />
          Down 100
        </Button>
        <Button
          variant="secondary"
          data-action="bump-down-500"
          onClick={() => sim.bumpPipe(500, state)}
        >
          <ArrowDown className="size-4" />
          Down 500
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {sim.equalized
          ? "Equalized: air cap at 14.7 psi · KMW in the DP sits on the float and drains on POOH · nothing comes back in"
          : state.pipeEnd === "closed"
            ? "As pumped until you move the pipe — then it equalizes (air cap) and KMW drains through the float on POOH"
            : "Open end"}{" "}
        · displacement {bblFt(model.pipeBblFt)} · annulus {bblFt(model.annularBblFt)} ·
        arrow keys move 100 ft, Shift 500 ft
      </p>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium tracking-wide text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function SimPlacePanel({
  state,
}: {
  state: WellState;
}) {
  const sim = useSimulator();

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <Section title="Place KMW pill" action={<Badge>{ppg(sim.draftMw)}</Badge>}>
        <div className="grid grid-cols-2 gap-3">
          <SimNumberField
            id="pill-top"
            label="Top depth"
            suffix="ft"
            value={sim.draftTop}
            min={0}
            max={state.wellDepth - 1}
            onCommit={(top) => sim.setDraftTop(top, state)}
          />
          <SimNumberField
            id="pill-bottom"
            label="Bottom depth"
            suffix="ft"
            value={sim.draftBottom}
            min={1}
            max={state.wellDepth}
            onCommit={(bottom) => sim.setDraftBottom(bottom, state)}
          />
        </div>
        <SimNumberField
          id="pill-volume"
          label="Volume"
          suffix="bbl"
          hint="Annular volume after pumping. String KMW is held by the float."
          value={sim.draftVolume}
          min={0.1}
          step={0.1}
          digits={1}
          onCommit={(volume) => sim.setDraftVolume(volume, state)}
        />
        <div>
          <Label className="mb-1.5 flex items-baseline justify-between">
            <span>Pill weight</span>
            <span className="font-mono text-foreground tabular-nums">{ppg(sim.draftMw)}</span>
          </Label>
          <input
            type="range"
            min={10}
            max={22}
            step={0.5}
            value={sim.draftMw}
            aria-label="Pill mud weight"
            onChange={(event) => sim.setDraftMw(Number(event.target.value))}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {ft(Math.max(0, sim.draftBottom - sim.draftTop))} interval ·{" "}
          {sim.draftVolume.toFixed(1)} bbl at current geometry
        </p>
        {sim.pillError ? (
          <p className="text-xs text-destructive" role="alert">
            {sim.pillError}
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={Boolean(sim.pillError)}
          onClick={() => {
            if (sim.placePill(state)) toast.success("Pill placed at current pipe depth");
          }}
        >
          <MapPin className="size-4" />
          Place pill from top to bottom
        </Button>
      </Section>
    </div>
  );
}
