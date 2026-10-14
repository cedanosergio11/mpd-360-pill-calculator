import { EXAMPLE_FANN } from "../example-job";
import type { Job, PillMode } from "../job.schema";

/** Which shoe the Lock Sub fixture is evaluated at. */
export type LockShoe = "3187" | "8033";

const BIT = 10480;
const TD = 10530;
const PILL_TOP = 8060;

/** Pipe-side inventory from the existing Lock Sub procedure (annulus / KMW / chase). */
export const LOCK_SUB_PIPE = {
  annulusBbl: 282,
  pipeKmwBbl: 71.33470953953758,
  pipeChaseBbl: 161.08310308917814,
};

function shoeOf(shoe: LockShoe) {
  if (shoe === "8033") return { md: 8045, tvd: 8033 };
  return { md: 3199, tvd: 3187 };
}

function base(mode: PillMode, shoe: LockShoe): Omit<Job, "column" | "pipeColumn"> {
  const shoePoint = shoeOf(shoe);
  return {
    schemaVersion: 1,
    name: "Lock Sub 1H",
    savedAt: "2026-10-05T00:00:00.000Z",
    mode,
    well: {
      mdTd_ft: TD,
      tvdTd_ft: 10516,
      bitMd_ft: BIT,
      shoeMd_ft: shoePoint.md,
      shoeTvd_ft: shoePoint.tvd,
      anchorMd_ft: BIT,
      anchorTvd_ft: 10466,
      fit_ppg: 12.6,
      targetEmw_ppg: 12,
      casing: [{ topMd_ft: 0, bottomMd_ft: shoePoint.md, id_in: 12.515 }],
      openHoleId_in: 12.25,
      stringOd_in: 5.5,
      stringId_in: 4.778,
      survey: [
        { md_ft: 3199, tvd_ft: 3187 },
        { md_ft: 8045, tvd_ft: 8033 },
        { md_ft: 8060, tvd_ft: 8046 },
        { md_ft: BIT, tvd_ft: 10466 },
        { md_ft: TD, tvd_ft: 10516 },
      ],
    },
    fluids: [
      { id: "mud", label: "mud", density_ppg: 11.4, fann: { ...EXAMPLE_FANN } },
      { id: "pill", label: "pill", density_ppg: 14, fann: { ...EXAMPLE_FANN } },
    ],
    trip: {
      speeds_ftmin: [40, 80, 100, 150, 200, 250, 300],
      pipeEnd: "closed",
      clinging: 0.45,
      eccentricity: 0,
      sbpConn_psi: 325,
      sbpCirc_psi: 0,
      flow_gpm: 300,
    },
  };
}

/**
 * Case B. Pipe-out pill (2420 ft, 352.78 bbl) and a dry string.
 * Fann is synthetic EXAMPLE. TD TVD is the repo anchor tie — the sheet has no TD TVD.
 */
export function lockSubDryJob(mode: PillMode, shoe: LockShoe = "3187"): Job {
  const shell = base(mode, shoe);
  return {
    ...shell,
    column: [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: PILL_TOP },
      { fluidId: "pill", topMd_ft: PILL_TOP, bottomMd_ft: BIT },
      { fluidId: "mud", topMd_ft: BIT, bottomMd_ft: TD },
    ],
    pipeColumn: [{ fluidId: "mud", topMd_ft: 0, bottomMd_ft: BIT }],
  };
}

/**
 * Case A. Annulus holds 282 bbl of pill; the string holds the KMW and the mud chase.
 * Spot is through the pipe, so the float U-tube applies. Open-hole annular capacity
 * is 12.25 in (2422.9 ft for 282 bbl).
 */
export function lockSubSpotJob(shoe: LockShoe): Job {
  const annOh = (12.25 ** 2 - 5.5 ** 2) / 1029.4;
  const bore = 4.778 ** 2 / 1029.4;
  const annTop = BIT - LOCK_SUB_PIPE.annulusBbl / annOh;
  const kmwTop = BIT - LOCK_SUB_PIPE.pipeKmwBbl / bore;
  const shell = base("withDP", shoe);
  return {
    ...shell,
    column: [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: annTop },
      { fluidId: "pill", topMd_ft: annTop, bottomMd_ft: BIT },
      { fluidId: "mud", topMd_ft: BIT, bottomMd_ft: TD },
    ],
    pipeColumn: [
      { fluidId: "mud", topMd_ft: 0, bottomMd_ft: kmwTop },
      { fluidId: "pill", topMd_ft: kmwTop, bottomMd_ft: BIT },
    ],
  };
}
