/**
 * MOCK ONLY — NOT CONTRACT OUTPUT. Adds the upcoming `exceedances` / `shoeCheck` fields to a real
 * emwProfile() result so the UI can be tested before core ships them. Never imported by app code.
 */
import { emwProfile } from "@/contract";
import type { Job } from "@/contract";
import type { EmwExceedance, EmwShoeCheck, Ok } from "@/components/emw";

const LINES = ["static", "staticSbp", "ecd"] as const;
export function mockProfile(job: Job, exceedances: EmwExceedance[]): Ok {
  const r = emwProfile(job);
  if (!r.ok) throw new Error("mock needs an ok profile");
  const shoe = r.stations.find((s) => s.label === "shoe")!;
  const fit = r.limits.fit_ppg;
  const shoeCheck: EmwShoeCheck[] = (["inPlace", "spotted"] as const).flatMap((st) => LINES.map((line) => {
    const emw = shoe.emw[st][line];
    const margin_ppg = Number((fit - emw).toFixed(6));
    const margin_psi = Number(((fit - emw) * 0.052 * shoe.tvd_ft).toFixed(2));
    return { line, pillState: st, emw_ppg: Number(emw.toFixed(6)), fit_ppg: fit, margin_ppg, margin_psi, over: emw >= fit };
  }));
  return { ...(r as Ok), exceedances, shoeCheck };
}
