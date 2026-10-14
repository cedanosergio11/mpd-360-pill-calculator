// Dotted-path helpers ("fluids[1].fann.r300") shared by fields and issue lookup.
export function parsePath(path: string): (string | number)[] {
  return path.split(".").flatMap((seg) => {
    const m = [...seg.matchAll(/([^[\]]+)|\[(\d+)\]/g)];
    return m.map((x) => (x[2] !== undefined ? Number(x[2]) : x[1]));
  });
}
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const k of parsePath(path)) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return cur;
}
export function setPath<T>(obj: T, path: string, value: unknown): T {
  const keys = parsePath(path);
  const clone = structuredClone(obj) as Record<string | number, unknown>;
  let cur = clone;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) { if (value === undefined) delete cur[k]; else cur[k] = value; return; }
    if (cur[k] == null) cur[k] = typeof keys[i + 1] === "number" ? [] : {};
    cur = cur[k] as Record<string | number, unknown>;
  });
  return clone as T;
}
