import type { Job } from "@/contract";
// EXAMPLE B: values copied from core fixtures/lock-sub.ts case B (lockSubDryJob("noDP", "8033")).
// Names stripped for the public preview. Fann is core's synthetic EXAMPLE_FANN. Not a field job.
const FANN = { r600: 80, r300: 48, r200: 36, r100: 24, r6: 9.2, r3: 8.2 };
export const exampleB: Job = {
  schemaVersion: 1, name: "EXAMPLE B, 8045 ft shoe, pill trip-in", savedAt: "", mode: "noDP",
  well: {
    mdTd_ft: 10530, tvdTd_ft: 10516, bitMd_ft: 10480, shoeMd_ft: 8045, shoeTvd_ft: 8033,
    anchorMd_ft: 10480, anchorTvd_ft: 10466, fit_ppg: 12.6, targetEmw_ppg: 12,
    casing: [{ topMd_ft: 0, bottomMd_ft: 8045, id_in: 12.515 }],
    openHoleId_in: 12.25, stringOd_in: 5.5, stringId_in: 4.778,
    survey: [
      { md_ft: 3199, tvd_ft: 3187 }, { md_ft: 8045, tvd_ft: 8033 }, { md_ft: 8060, tvd_ft: 8046 },
      { md_ft: 10480, tvd_ft: 10466 }, { md_ft: 10530, tvd_ft: 10516 },
    ],
  },
  fluids: [
    { id: "mud", label: "EXAMPLE mud", density_ppg: 11.4, fann: { ...FANN } },
    { id: "pill", label: "EXAMPLE pill", density_ppg: 14, fann: { ...FANN } },
  ],
  column: [
    { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 8060 },
    { fluidId: "pill", topMd_ft: 8060, bottomMd_ft: 10480 },
    { fluidId: "mud", topMd_ft: 10480, bottomMd_ft: 10530 },
  ],
  pipeColumn: [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: 10480 }],
  // EXAMPLE triplex pump, from MPGenie's strokes-example-b.expected.json basis.
  pump: { linerIn: 6, strokeIn: 12, efficiency: 0.97, spm: 40 },
  trip: { speeds_ftmin: [40, 80, 100, 150, 200, 250, 300], pipeEnd: "closed", clinging: 0.45, eccentricity: 0, sbpConn_psi: 325, sbpCirc_psi: 0, flow_gpm: 300, standLength_ft: 93 },
};

/** EXAMPLE C matches EXAMPLE B except connection SBP is 550 psi, so planned SBP exceeds MASP. Stand length is seeded at 93 ft. */
export const exampleC: Job = (() => {
  const job = structuredClone(exampleB);
  job.name = "EXAMPLE C, 8045 ft shoe, pill trip-in, SBP 550";
  job.trip.sbpConn_psi = 550;
  job.trip.standLength_ft = 93;
  return job;
})();

/** EXAMPLE D matches EXAMPLE C with a two-section string. Top pipe is the C OD/ID; the bottom 2,000 ft is 4.0 in OD / 3.34 in ID. */
export const exampleD: Job = (() => {
  const job = structuredClone(exampleC);
  job.name = "EXAMPLE D (tapered)";
  job.well.stringSections = [
    { length_ft: 8480, od_in: 5.5, id_in: 4.778 },
    { length_ft: 2000, od_in: 4, id_in: 3.34 },
  ];
  return job;
})();
