import type { Job } from "@/contract";
import { exampleJob } from "@/lib/example-job";
import { exampleB } from "@/lib/example-b";
const exampleBNoTarget: Job = (() => {
  const j = structuredClone(exampleB);
  j.name = "EXAMPLE B, no anchor target, SBP 325";
  delete j.well.targetEmw_ppg;
  j.trip.sbpConn_psi = 325;
  return j;
})();
export const seeds: { id: string; label: string; job: Job }[] = [
  { id: "a", label: "EXAMPLE Well A", job: exampleJob },
  { id: "b", label: "EXAMPLE B, 8045 ft shoe, pill trip-in", job: exampleB },
  { id: "b0", label: "EXAMPLE B, no anchor target, SBP 325", job: exampleBNoTarget },
];
