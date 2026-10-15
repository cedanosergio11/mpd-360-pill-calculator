import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("../..", import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "rp13d") continue;
      out.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

describe("RP 13D stays off the sheet", () => {
  it("no sheet module imports rp13d", () => {
    const importFrom = /(?:from|import)\s*\(?\s*["'][^"']*rp13d[^"']*["']/;
    const hits = sourceFiles(SRC).filter((path) => importFrom.test(readFileSync(path, "utf8")));
    expect(hits).toEqual([]);
  });

  it("the rp13d module does not import the sheet", () => {
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const sheetImport = /from\s+["'](?:@\/lib\/calc|@\/components|[^"']*\/calc\/|[^"']*\/components\/)/;
    const hits = readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .filter((name) => sheetImport.test(readFileSync(join(dir, name), "utf8")));
    expect(hits).toEqual([]);
  });
});
