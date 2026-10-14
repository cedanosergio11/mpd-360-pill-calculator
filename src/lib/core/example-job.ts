import type { FannReading, Job } from "./job.schema";

/** Synthetic rheology for EXAMPLE jobs. Not a field reading. */
export const EXAMPLE_FANN: FannReading = {
  r600: 80,
  r300: 48,
  r200: 36,
  r100: 24,
  r6: 9.2,
  r3: 8.2,
};

/**
 * Synthetic vertical well. Pill sits below the shoe.
 * Labeled EXAMPLE — not a client well.
 */
export function exampleJob(): Job {
  return {
    schemaVersion: 1,
    name: "EXAMPLE vertical",
    savedAt: "2026-01-01T00:00:00.000Z",
    mode: "noDP",
    well: {
      mdTd_ft: 10000,
      tvdTd_ft: 10000,
      bitMd_ft: 10000,
      shoeMd_ft: 5000,
      shoeTvd_ft: 5000,
      anchorMd_ft: 9000,
      anchorTvd_ft: 9000,
      fit_ppg: 14,
      targetEmw_ppg: 12,
      casing: [{ topMd_ft: 0, bottomMd_ft: 5000, id_in: 8.5 }],
      openHoleId_in: 8.5,
      stringOd_in: 5,
      stringId_in: 4.276,
      survey: [
        { md_ft: 5000, tvd_ft: 5000 },
        { md_ft: 9000, tvd_ft: 9000 },
        { md_ft: 10000, tvd_ft: 10000 },
      ],
    },
    fluids: [
      { id: "mud", label: "EXAMPLE mud", density_ppg: 12, fann: { ...EXAMPLE_FANN } },
      { id: "pill", label: "EXAMPLE pill", density_ppg: 16, fann: { ...EXAMPLE_FANN } },
    ],
    column: [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 7000 },
      { fluidId: "pill", topMd_ft: 7000, bottomMd_ft: 9000 },
      { fluidId: "mud", topMd_ft: 9000, bottomMd_ft: 10000 },
    ],
    trip: {
      speeds_ftmin: [40, 80],
      pipeEnd: "closed",
      clinging: 0.45,
      eccentricity: 0,
      sbpConn_psi: 0,
      sbpCirc_psi: 0,
      flow_gpm: 400,
    },
  };
}
