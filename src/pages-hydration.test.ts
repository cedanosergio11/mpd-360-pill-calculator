import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { chromium } from "playwright";
import { describe, expect, it } from "vitest";

/**
 * React #418 on the GitHub Pages build: the SPA shell (`router.isShell`)
 * SSRs only `__root__` and leaves an empty suspense hole. The client hydrates
 * AppShell, whose first paint is "Loading…" (`src/components/app-shell.tsx`).
 * Pages now prerenders `/` itself, so the HTML contains that same main.
 */
const clientDir = join(process.cwd(), "dist/client");
const indexPath = join(clientDir, "index.html");
const BASE = "/mpd-360-pill-calculator";
const EMPTY_SHELL = "<!--$--><!--$--><!--/$--><!--/$-->";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

function prerenderedHtml(): string {
  const current = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
  if (current.includes("Loading\u2026") && current.includes("<main")) return current;
  execFileSync("node", ["scripts/with-app-env.mjs", "vite", "build"], {
    cwd: process.cwd(),
    stdio: "inherit",
    timeout: 120_000,
    env: { ...process.env, GITHUB_PAGES: "1", NODE_ENV: "production" },
  });
  execFileSync("node", ["scripts/pages-fallback.mjs"], {
    cwd: process.cwd(),
    stdio: "inherit",
    timeout: 30_000,
  });
  return readFileSync(indexPath, "utf8");
}

function listen(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
      const rel =
        pathname === BASE || pathname === `${BASE}/`
          ? "index.html"
          : pathname.startsWith(`${BASE}/`)
            ? pathname.slice(BASE.length + 1)
            : "";
      if (!rel) {
        res.writeHead(404).end();
        return;
      }
      const file = normalize(join(root, rel));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await readFile(file);
      res.writeHead(200, { "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("static server has no port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${addr.port}${BASE}/`,
        close: () => new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

describe("prerendered pages hydration", () => {
  it(
    "hydrates the pages HTML without a React hydration error",
    async () => {
      const html = prerenderedHtml();
      expect(html).toContain("Loading\u2026");
      expect(html).toContain("<main");
      expect(html).not.toContain(EMPTY_SHELL);
      expect(readFileSync(join(clientDir, "404.html"), "utf8")).toContain("Loading\u2026");

      const site = await listen(clientDir);
      const browser = await chromium.launch({
        channel: "chrome",
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      const pageerrors: string[] = [];
      const hydrationNotes: string[] = [];
      try {
        const page = await browser.newPage();
        page.on("pageerror", (err) => pageerrors.push(String(err)));
        page.on("console", (msg) => {
          const text = msg.text();
          if (/hydration|did not match|minified react error #418/i.test(text)) {
            hydrationNotes.push(`${msg.type()}: ${text}`);
          }
        });
        const response = await page.goto(site.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        expect(response?.status()).toBe(200);
        await page.getByText("Well setup").waitFor({ timeout: 15_000 });
        expect(pageerrors).toEqual([]);
        expect(hydrationNotes).toEqual([]);
      } finally {
        await browser.close();
        await site.close();
      }
    },
    60_000,
  );
});
