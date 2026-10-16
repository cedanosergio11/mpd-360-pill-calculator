import { useMemo } from "react";
import { bitTvd } from "@/lib/calc/depth";
import type { CalcResults, WellInputs } from "@/lib/calc/types";
import { calcRp13d, compareEcd } from "@/lib/rp13d";
import { asNum, formatExact, isNum } from "@/lib/utils";

const NEEDS_SURVEY = "needs survey to bit";
const NO_SHEET_BIT = "no sheet value at bit";

/**
 * RP 13D beside the sheet ECD. The sheet has no Fann readings, so this
 * does not invent dials. `trips` stays on the result and is not rendered.
 * The bit row keys off `bitTvd === null`, not the calc result code.
 */
export function Rp13dView({ inputs, results }: { inputs: WellInputs; results: CalcResults }) {
  const { rows, note, bitSurveyTvd } = useMemo(() => {
    const bitSurveyTvd = bitTvd(inputs);
    const rp = calcRp13d(rpInputs(inputs, bitSurveyTvd));
    return {
      bitSurveyTvd,
      note: rp.reason,
      rows: compareEcd(rp.ecd, {
        currentMw: asNum(inputs.currentMw),
        initialAplAnchor: results.initialAplAnchor,
        anchorTvd: asNum(inputs.anchorTvd),
        shoeTvd: asNum(inputs.casingTvd),
        shoe: results.esdCasingNoDp,
      }),
    };
  }, [inputs, results]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">RP 13D ECD</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Anchor uses the sheet annular friction. The shoe uses the static ESD. The bit has no sheet ECD.
      </p>
      {note ? <p className="mt-3 text-sm text-muted-foreground">{note}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="py-1.5 pr-3 font-medium">Depth</th>
              <th className="py-1.5 pr-3 font-medium">Sheet</th>
              <th className="py-1.5 pr-3 font-medium">Basis</th>
              <th className="py-1.5 pr-3 font-medium">RP 13D</th>
              <th className="py-1.5 font-medium">Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.depth} className="border-t border-border" data-rp13d-depth={row.depth}>
                <td className="py-2 pr-3">{row.label}</td>
                <td className="py-2 pr-3 font-mono tabular-nums">{ppg(row.sheetEcd)}</td>
                <td className="py-2 pr-3 uppercase">{row.sheetBasis}</td>
                <td className="py-2 pr-3 font-mono tabular-nums" data-rp13d-column="ecd">
                  {row.depth === "bit" ? bitEcdCell(bitSurveyTvd, row.rp13dEcd) : ppg(row.rp13dEcd)}
                </td>
                <td className="py-2 font-mono tabular-nums" data-rp13d-column="difference">
                  {row.depth === "bit" ? bitDifferenceCell(bitSurveyTvd) : ppg(row.difference)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function rpInputs(inputs: WellInputs, surveyed: number | null) {
  return {
    fann600: Number.NaN,
    fann300: Number.NaN,
    fann200: Number.NaN,
    fann100: Number.NaN,
    fann6: Number.NaN,
    fann3: Number.NaN,
    mw: asNum(inputs.currentMw),
    flowGpm: asNum(inputs.initialFlowRate),
    pipeOd: asNum(inputs.odDp),
    pipeId: asNum(inputs.idDp),
    casingId: asNum(inputs.idCasing),
    casingMd: asNum(inputs.casingMd),
    casingTvd: asNum(inputs.casingTvd),
    openHoleDia: asNum(inputs.openHoleDia),
    anchorMd: asNum(inputs.anchorMd),
    anchorTvd: asNum(inputs.anchorTvd),
    bitMd: asNum(inputs.currentDepthMd),
    bitTvd: surveyed ?? Number.NaN,
  };
}

/** Bit cells follow the survey TVD. A null TVD is not the calc result code. */
export function bitEcdCell(tvd: number | null, ecd: number | null): string {
  if (tvd === null) return NEEDS_SURVEY;
  const ecdText = isNum(ecd) ? `${formatExact(ecd, 2)} ppg` : "—";
  return `${ecdText} ${NO_SHEET_BIT}`;
}

export function bitDifferenceCell(tvd: number | null): string {
  if (tvd === null) return NEEDS_SURVEY;
  return NO_SHEET_BIT;
}

function ppg(value: number | null): string {
  return isNum(value) ? `${formatExact(value, 2)} ppg` : "—";
}
