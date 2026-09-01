import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

const viteBase = import.meta.env.BASE_URL;
const basepath = viteBase === "/" ? undefined : viteBase.replace(/\/$/, "");

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    ...(basepath ? { basepath } : {}),
  });
}
