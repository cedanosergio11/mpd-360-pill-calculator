import type { Job } from "@/contract";
import { exampleJob } from "@/lib/example-job";
import { exampleB, exampleC } from "@/lib/example-b";
const exampleBNoTarget: Job = (() => {
  const j = structuredClone(exampleB);
  j.name = "EXAMPLE, no anchor target, SBP 325";
  delete j.well.targetEmw_ppg;
  j.trip.sbpConn_psi = 325;
  return j;
})();
export const seeds: { id: string; label: string; job: Job }[] = [
  { id: "a", label: "EXAMPLE Well A", job: exampleJob },
  { id: "b", label: "EXAMPLE, pill trip-in", job: exampleB },
  { id: "b0", label: "EXAMPLE, no anchor target, SBP 325", job: exampleBNoTarget },
  { id: "c", label: "EXAMPLE, SBP 550", job: exampleC },
];
