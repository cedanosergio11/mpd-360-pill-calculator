import type { Job } from "./job.schema";

/**
 * Canonical JSON: sorted keys, undefined omitted, arrays keep their order.
 * Used so `inputHash` does not depend on object insertion order.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

/** FNV-1a 64-bit, hex. Stable across processes; no Node crypto so the core stays browser-safe. */
export function fnv1a64(text: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

/** Stable hash of the job JSON excluding `savedAt`. */
export function inputHash(job: Job): string {
  const { savedAt: _savedAt, ...rest } = job;
  return fnv1a64(stableStringify(rest));
}
