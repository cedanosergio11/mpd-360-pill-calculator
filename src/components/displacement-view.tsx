import type { CalcResults, WellInputs } from "@/lib/calc/types";
import type { RihFitStage } from "@/lib/calc/rih-fit";
import { buildRihFitStops } from "@/lib/calc/rih-fit";
import { formatExact, formatNumber, isNum } from "@/lib/utils";

type Mark = { d: number; label: string; kind: "top" | "stop" | "shoe" };

function marksFor(pillBase: number, stages: RihFitStage[]): Mark[] {
  const byDepth = new Map<number, Mark>();
  const put = (m: Mark) => {
    const key = Math.round(m.d);
    const prev = byDepth.get(key);
    if (!prev || m.kind === "stop") byDepth.set(key, { ...m, d: key });
  };
  if (isNum(pillBase)) put({ d: pillBase, label: `shoe ${formatNumber(pillBase, 0)}`, kind: "shoe" });
  for (const s of stages) {
    put({ d: s.pillTop, label: `top ${formatNumber(s.pillTop, 0)}`, kind: "top" });
    if (!s.canReachBase && isNum(s.stopBit)) {
      put({
        d: s.stopBit,
        label: `stop ${s.index}  ${formatNumber(s.stopBit, 0)}`,
        kind: "stop",
      });
    }
  }
  return [...byDepth.values()].sort((a, b) => a.d - b.d);
}

export function DisplacementView({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const plan = buildRihFitStops(inputs, results);
  const fit = plan.fit;
  const stages = plan.stages;
  const firstTop = stages[0]?.pillTop;
  const stageCount = stages.length;
  const title =
    stageCount > 0
      ? `RIH - minimum ${stageCount} ${stageCount === 1 ? "stage" : "stages"} needed`
      : "RIH - minimum stages needed";
  const marks = marksFor(plan.pillBase, stages);
  const dMin = marks.length ? Math.max(0, Math.min(...marks.map((m) => m.d)) - 800) : 0;
  const dMax = isNum(plan.pillBase) && plan.pillBase > dMin ? plan.pillBase : dMin + 1;
  const pct = (d: number) => `${((Math.min(dMax, Math.max(dMin, d)) - dMin) / (dMax - dMin)) * 100}%`;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              Closed-end / float. Pipe out, run until hydrostatic at the shoe hits FIT, circulate
              extra KMW (new top = bit), repeat. Static only — no surge.
            </p>
          </div>
          <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Closed-end
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="FIT" value={`${formatExact(fit, 2)} ppge`} />
          <Mini
            label="Pill"
            value={
              isNum(firstTop) && isNum(plan.pillBase)
                ? `${formatNumber(firstTop, 0)}–${formatNumber(plan.pillBase, 0)} ft`
                : "—"
            }
          />
          <Mini label="Stops" value={String(stages.filter((s) => !s.canReachBase).length || "—")} />
          <Mini label="Mode" value="Static shoe ESD" />
        </div>

        {stages.length === 0 ? (
          <p className="mt-4 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
            Need FIT, DP OD, casing ID, and a no-DP pill top.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(200px,260px)_1fr]">
            <div className="overflow-x-auto rounded-xl border border-border bg-background/40 p-3">
              <div className="relative h-64 sm:h-[28rem]">
                <div className="absolute inset-y-0 left-16 right-3 overflow-hidden rounded-full border border-border">
                  <div className="absolute inset-0 bg-fluid/70" />
                  {isNum(firstTop) ? (
                    <div
                      className="absolute inset-x-0 bg-kmw"
                      style={{ top: pct(firstTop), bottom: 0 }}
                    />
                  ) : null}
                </div>
                {marks.map((m) => (
                  <div
                    key={`${m.kind}-${m.d}`}
                    className="absolute left-0 right-3 flex items-center gap-2"
                    style={{ top: pct(m.d), transform: "translateY(-50%)" }}
                  >
                    <span
                      className={`w-14 text-right font-mono text-[10px] tabular-nums leading-tight ${
                        m.kind === "stop" ? "font-semibold text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {m.label}
                    </span>
                    <span
                      className={`h-px flex-1 ${
                        m.kind === "stop"
                          ? "bg-danger"
                          : m.kind === "shoe"
                            ? "bg-foreground/50"
                            : "bg-border"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <ol className="space-y-2">
              {stages.map((s) => (
                <li
                  key={s.index}
                  className={`rounded-xl border px-3 py-2.5 text-sm ${
                    s.canReachBase ? "border-border" : "border-danger/40"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {s.canReachBase ? `Stage ${s.index} — to shoe` : `Stop ${s.index}`}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      pill {formatNumber(s.pillTop, 0)}–{formatNumber(s.pillBase, 0)} ft
                    </span>
                  </div>
                  {s.canReachBase ? (
                    <p className="mt-1 text-sm">
                      RIH to the shoe — remaining pill stays under FIT
                      {isNum(s.shoeEsdAtStop) ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({formatExact(s.shoeEsdAtStop, 2)} ppge)
                        </span>
                      ) : null}
                      .
                    </p>
                  ) : (
                    <p className="mt-1 text-sm">
                      Stop at{" "}
                      <span className="font-mono font-medium tabular-nums">
                        {formatNumber(s.stopBit ?? 0, 0)} ft
                      </span>{" "}
                      bit — shoe {formatExact(s.shoeEsdAtStop, 2)} ppge. Circulate extra KMW so the
                      next pill top is that bit depth.
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className="mt-3 text-[11px] text-muted-foreground">
          Static steel displacement of a KMW column. Open-ended fill is deeper — don’t use it unless
          the pipe is taking fluid. Surge hits FIT earlier if they RIH fast. Verify the last rate in
          SafeVision before issuing.
        </p>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
