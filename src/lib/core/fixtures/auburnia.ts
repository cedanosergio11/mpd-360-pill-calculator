import { EXAMPLE_FANN } from "../example-job";
import type { Job, PillMode } from "../job.schema";

/**
 * Auburnia geometry already in the repo (`src/lib/calc/examples.ts`), copied
 * here so the core tests do not import the old engine.
 * Pill top 7951 MD is the legacy pipe-out top. TD TVD extends the spot→anchor
 * slope — the workbook has no TD TVD. Fann is synthetic EXAMPLE.
 */
export function auburniaJob(mode: PillMode): Job {
  const top = 7951;
  const spot = 11681;
  const spotTvd = 11322;
  const td = 18359;
  const anchorMd = 12675;
  const anchorTvd = 11912;
  const shoeMd = 10785;
  const shoeTvd = 10426;
  const tvdTd = anchorTvd + ((td - anchorMd) * (anchorTvd - spotTvd)) / (anchorMd - spot);
  return {
    schemaVersion: 1,
    name: "AUBURNIA 20-17 HC #4 ALT",
    savedAt: "2026-08-10T00:00:00.000Z",
    mode,
    well: {
      mdTd_ft: td,
      tvdTd_ft: tvdTd,
      bitMd_ft: td,
      shoeMd_ft: shoeMd,
      shoeTvd_ft: shoeTvd,
      anchorMd_ft: anchorMd,
      anchorTvd_ft: anchorTvd,
      fit_ppg: 17.5,
      targetEmw_ppg: 16.3,
      casing: [{ topMd_ft: 0, bottomMd_ft: shoeMd, id_in: 6.875 }],
      openHoleId_in: 6.75,
      stringOd_in: 4.5,
      stringId_in: 3.826,
      survey: [
        { md_ft: shoeMd, tvd_ft: shoeTvd },
        { md_ft: spot, tvd_ft: spotTvd },
        { md_ft: anchorMd, tvd_ft: anchorTvd },
        { md_ft: td, tvd_ft: tvdTd },
      ],
    },
    fluids: [
      { id: "mud", label: "mud", density_ppg: 15.3, fann: { ...EXAMPLE_FANN } },
      { id: "pill", label: "pill", density_ppg: 18.5, fann: { ...EXAMPLE_FANN } },
    ],
    column: [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: top },
      { fluidId: "pill", topMd_ft: top, bottomMd_ft: spot },
      { fluidId: "mud", topMd_ft: spot, bottomMd_ft: td },
    ],
    pipeColumn: [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: td }],
    trip: {
      speeds_ftmin: [40, 80, 200],
      pipeEnd: "closed",
      clinging: 0.45,
      eccentricity: 0,
      sbpConn_psi: 681,
      sbpCirc_psi: 0,
      flow_gpm: 242,
    },
  };
}
