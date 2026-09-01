import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { asNum, formatNumber, isNum } from "@/lib/utils";

type Marker = {
  label: string;
  depth: number;
  color: string;
  dash: boolean;
  depthText: string;
  y: number;
  labelY: number;
};

export function Wellbore({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const spot = asNum(inputs.spotMd);
  const casing = asNum(inputs.casingMd);
  const anchor = asNum(inputs.anchorMd);
  const withSlug = inputs.pillMode === "withSlug";
  const topWith = results.topOfPillWithDp === "Surface" ? 0 : asNum(results.topOfPillWithDp);
  const topWithout = Math.max(0, results.topOfPillNoDp);
  const ready = spot > 0 && [topWith, topWithout].every(isNum);
  const depthMax = Math.max(spot || 0, casing || 0, anchor || 0);
  const topY = 40;
  const botY = 520;
  const span = botY - topY;
  const yFor = (d: number) => topY + (Math.max(0, Math.min(depthMax, d)) / (depthMax || 1)) * span;

  const raw: Omit<Marker, "y" | "labelY">[] = ready
    ? [
        {
          label: "Top of pill after equalize",
          depth: topWith,
          color: "#4d8f8a",
          dash: false,
          depthText: results.topOfPillWithDp === "Surface" ? "Surface" : `${formatNumber(topWith, 0)} ft MD`,
        },
        {
          label: "Top of pill w/o DP",
          depth: topWithout,
          color: "#c45c4a",
          dash: true,
          depthText: results.topOfPillNoDp <= 0 ? "Surface" : `${formatNumber(results.topOfPillNoDp, 0)} ft MD`,
        },
        {
          label: "Spot depth",
          depth: spot,
          color: "#e8ebe6",
          dash: false,
          depthText: `${formatNumber(spot, 0)} ft MD`,
        },
      ]
    : [];
  if (ready && isNum(casing) && casing >= 0 && casing <= depthMax) {
    raw.push({
      label: "Casing shoe",
      depth: casing,
      color: "#8a97a3",
      dash: false,
      depthText: `${formatNumber(casing, 0)} ft MD`,
    });
  }
  if (ready && isNum(anchor) && anchor >= 0 && anchor <= depthMax && Math.abs(anchor - spot) > 20) {
    raw.push({
      label: "Anchor / BOC",
      depth: anchor,
      color: "#6aa89f",
      dash: true,
      depthText: `${formatNumber(anchor, 0)} ft MD`,
    });
  }

  const markers: Marker[] = raw
    .map((m) => ({ ...m, y: yFor(m.depth), labelY: yFor(m.depth) }))
    .sort((a, b) => a.y - b.y);

  const gap = 48;
  if (markers.length) {
    let prior = 28 - gap;
    markers.forEach((m) => {
      m.labelY = Math.max(m.y, prior + gap);
      prior = m.labelY;
    });
    const overflow = markers.at(-1)!.labelY - (botY + 8);
    if (overflow > 0) markers.forEach((m) => { m.labelY -= overflow; });
    for (let i = markers.length - 2; i >= 0; i -= 1) {
      markers[i].labelY = Math.min(markers[i].labelY, markers[i + 1].labelY - gap);
    }
    const topOverflow = 28 - markers[0].labelY;
    if (topOverflow > 0) markers.forEach((m) => { m.labelY += topOverflow; });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Wellbore schematic</h3>
        <span className="text-[11px] text-muted-foreground">{withSlug ? "With slug" : "No slug"}</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 rounded-sm bg-kmw" /> Annular KMW
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 rounded-sm bg-pipe" /> {withSlug ? "Slug / KMW in DP" : "KMW in DP"}
        </span>
        <span>Surface at top · deepest plotted point at base</span>
      </div>
      {!ready ? (
        <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          Complete geometry and fluid inputs to draw pill placement.
        </div>
      ) : (
        <svg viewBox="0 0 760 560" className="h-auto w-full" role="img" aria-label="Wellbore schematic">
          <rect width="760" height="560" fill="var(--color-card)" />
          <rect x="118" y={topY} width="52" height={span} fill="#d9e2e4" />
          <rect x="230" y={topY} width="52" height={span} fill="#d9e2e4" />
          <rect x="170" y={topY} width="60" height={span} fill="#e8eef0" />
          <rect x="118" y={yFor(topWith)} width="52" height={botY - yFor(topWith)} fill="#b56a3c" />
          <rect x="230" y={yFor(topWith)} width="52" height={botY - yFor(topWith)} fill="#b56a3c" />
          <rect
            x="170"
            y={yFor(topWith)}
            width="60"
            height={botY - yFor(topWith)}
            fill={withSlug ? "#c4a15a" : "#8a5344"}
          />
          <line
            x1="114"
            y1={topY}
            x2="114"
            y2={isNum(casing) ? yFor(casing) : botY}
            stroke="#64748b"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <line
            x1="286"
            y1={topY}
            x2="286"
            y2={isNum(casing) ? yFor(casing) : botY}
            stroke="#64748b"
            strokeWidth="7"
            strokeLinecap="round"
          />
          {isNum(casing) ? (
            <>
              <line x1="114" y1={yFor(casing)} x2="102" y2={botY} stroke="#111827" strokeWidth="3.5" />
              <line x1="286" y1={yFor(casing)} x2="298" y2={botY} stroke="#111827" strokeWidth="3.5" />
            </>
          ) : null}
          <line x1="170" y1={topY} x2="170" y2={botY} stroke="#111827" strokeWidth="4" />
          <line x1="230" y1={topY} x2="230" y2={botY} stroke="#111827" strokeWidth="4" />
          <path d={`M161 ${botY} L200 ${botY + 14} L239 ${botY}`} fill="none" stroke="#111827" strokeWidth="3.5" />
          <line x1="80" y1={topY} x2="320" y2={topY} stroke="#94a3b8" strokeWidth="2" />
          <text x="20" y={topY + 4} fill="#93a09a" fontSize="11" fontWeight="600">
            Surface
          </text>
          {markers.map((m) => (
            <g key={m.label}>
              <line
                x1="110"
                y1={m.y}
                x2="290"
                y2={m.y}
                stroke={m.color}
                strokeWidth={m.dash ? 1.5 : 2.4}
                strokeDasharray={m.dash ? "6 5" : undefined}
              />
              <path
                d={`M290 ${m.y} L328 ${m.y} L338 ${m.labelY}`}
                fill="none"
                stroke={m.color}
                strokeWidth="1.2"
              />
              <rect
                x="342"
                y={m.labelY - 16}
                width="250"
                height="36"
                rx="4"
                fill="var(--color-card)"
              />
              <text x="348" y={m.labelY - 2} fill={m.color} fontSize="13" fontWeight="700">
                {m.label}
              </text>
              <text x="348" y={m.labelY + 14} fill="#93a09a" fontSize="11">
                {m.depthText}
              </text>
            </g>
          ))}
        </svg>
      )}
    </section>
  );
}
