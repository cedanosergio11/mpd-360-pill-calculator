import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";

/**
 * Pages prerender must emit the index route, not the SPA shell.
 * The shell SSRs only `__root__` and leaves an empty suspense hole.
 * The client then hydrates AppShell, whose first paint is "Loading…"
 * (localStorage stays in an effect). That hole-vs-main mismatch is React #418.
 */
async function markup(isShell: boolean): Promise<string> {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    isServer: true,
    isShell,
  });
  await router.load();
  return renderToString(createElement(RouterProvider, { router }));
}

describe("SPA shell hydration", () => {
  it("prerenders the same Loading paint the client hydrates", async () => {
    const first = await markup(false);
    const second = await markup(false);
    expect(first).toBe(second);
    expect(first).toContain("Loading");
    expect(first).not.toContain("Well setup");
    const shell = await markup(true);
    expect(shell).not.toContain("Loading");
    expect(shell).not.toBe(first);
  });
});
