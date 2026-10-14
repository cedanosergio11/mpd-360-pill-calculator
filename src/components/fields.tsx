import type { ReactNode } from "react";
import type { Issue } from "@/contract";
import { getPath } from "@/lib/paths";
import { issuesFor, useStore } from "@/lib/store";

export function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {issues.map((i, k) => (
        <li key={k} data-issue-field={i.field} className={`text-[11px] leading-snug ${i.level === "error" ? "text-danger" : "text-warn"}`}>
          {i.level === "error" ? "✖" : "▲"} {i.message} <span className="font-mono opacity-70">[{i.code}]</span>
        </li>
      ))}
    </ul>
  );
}

export function NumField({ path, label, unit, optional }: { path: string; label: string; unit: string; optional?: boolean }) {
  const job = useStore((s) => s.job);
  const set = useStore((s) => s.set);
  const issues = issuesFor(useStore((s) => s.result?.issues), path);
  const v = getPath(job, path);
  const err = issues.some((i) => i.level === "error");
  return (
    <label className="block min-w-0">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}{optional && " (opt)"}</span>
      <div className={`mt-0.5 flex items-center rounded-md border bg-background ${err ? "border-danger" : "border-input"}`}>
        <input
          inputMode="decimal" data-path={path}
          className="w-full min-w-0 bg-transparent px-2 py-1.5 font-mono text-sm outline-none"
          value={typeof v === "number" && Number.isFinite(v) ? String(v) : ""}
          onChange={(e) => { const t = e.target.value.trim(); set(path, t === "" ? (optional ? undefined : NaN) : Number(t)); }}
        />
        <span className="shrink-0 pr-2 font-mono text-[11px] text-muted-foreground">{unit}</span>
      </div>
      <IssueList issues={issues} />
    </label>
  );
}

export function Card({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">{title}</h2>{right}</div>
      {children}
    </section>
  );
}

export const Grid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;

export const fmt = (v: number | null | undefined, unit: string, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)} ${unit}`;
