import type { Job } from "@/contract";
// EXAMPLE input data (default seed). Not a real well, client or rig.
export const exampleJob: Job = {
  schemaVersion: 1, name: "EXAMPLE Well A", savedAt: "", mode: "withDP",
  well: {
    mdTd_ft: 12500, tvdTd_ft: 10400, bitMd_ft: 12500, shoeMd_ft: 9000, shoeTvd_ft: 8700,
    anchorMd_ft: 10200, fit_ppg: 13.2, porePressure_ppg: 11.6, targetEmw_ppg: 12.5,
    casing: [{ topMd_ft: 0, bottomMd_ft: 9000, id_in: 8.835 }],
    openHoleId_in: 8.5, stringOd_in: 5, stringId_in: 4.276,
  },
  fluids: [
    { id: "mud", label: "Mud", density_ppg: 11.8, fann: { r600: 62, r300: 38, r200: 30, r100: 20, r6: 7, r3: 6 }, gel10m_lbf100ft2: 14 },
    { id: "pill", label: "Pill", density_ppg: 14.5, fann: { r600: 80, r300: 50, r200: 40, r100: 27, r6: 9, r3: 8 }, gel10m_lbf100ft2: 18 },
    { id: "kill", label: "Kill mud", density_ppg: 12.4, fann: { r600: 66, r300: 41, r200: 32, r100: 22, r6: 8, r3: 7 }, gel10m_lbf100ft2: 15 },
  ],
  column: [
    { fluidId: "mud", topMd_ft: 0, bottomMd_ft: 11200 },
    { fluidId: "pill", topMd_ft: 11200, bottomMd_ft: 12500 },
  ],
  pipeColumn: [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: 12500 }],
  trip: { speeds_ftmin: [30, 60, 90, 120], pipeEnd: "closed", clinging: 0.45, eccentricity: 0.5, sbpConn_psi: 350, sbpCirc_psi: 150, flow_gpm: 450 },
};
