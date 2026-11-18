import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Panel, StatusTag } from "@/components/gtm/AppShell";
import { ErrorLine, btnPrimary, field } from "@/components/gtm/DemoParts";
import { PRIOR_RESEARCH } from "@/evaluation/history";
import { fourCaseRunFn } from "@/lib/gtm.functions";
import { SimulationPanel } from "@/components/gtm/SimulationPanel";
import { EvidenceBundle } from "@/components/gtm/EvidenceBundle";

export const Route = createFileRoute("/experiments")({
  head: () => ({
    meta: [
      { title: "Experiments · GTM engine" },
      { name: "description", content: "Live four-case comparison of exact GTM against superficial rules and a local CRM proxy." },
      { property: "og:title", content: "Experiments · GTM engine" },
      { property: "og:description", content: "Live four-case comparison of exact GTM against superficial rules and a local CRM proxy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Experiments,
});

type Run = Awaited<ReturnType<typeof fourCaseRunFn>>;
const ARM_LABEL: Record<string, string> = { D: "D · Exact GTM", C: "C · Superficial rules", B: "B · Local Boolean proxy" };
const BRANCHES = ["allowed", "clarified", "alternative", "denied", "unknown", "pending"] as const;

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: "ok" | "bad" | "hist" }) {
  const pct = total ? (value / total) * 100 : 0;
  const c = tone === "ok" ? "bg-allowed" : tone === "bad" ? "bg-denied" : "bg-muted-foreground/50";
  return (
    <div className="grid grid-cols-[11rem_1fr_4rem] items-center gap-2 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <div className="h-4 rounded bg-background" role="img" aria-label={`${label}: ${value} of ${total}`}><div className={`h-4 rounded ${c} ${tone === "hist" ? "bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,var(--background)_4px,var(--background)_8px)]" : ""}`} style={{ width: `${pct}%` }} /></div>
      <span className="text-right font-mono text-foreground">{value}/{total}</span>
    </div>
  );
}

function Experiments() {
  const runFn = useServerFn(fourCaseRunFn);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const run = runs.find((r) => r.run_id === sel) ?? null;

  const execute = async () => {
    setBusy(true); setErr(null);
    try { const r = await runFn(); setRuns((x) => [r, ...x]); setSel(r.run_id); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const d = run?.rows.filter((r) => r.arm === "D") ?? [];
  const branchCounts = BRANCHES.map((b) => ({ b, n: d.filter((r) => r.branch === b).length }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-semibold">Experiments</h1>
        <label className="text-xs text-muted-foreground">Current run
          <select aria-label="Current run" className={field} value={sel ?? ""} onChange={(e) => setSel(e.target.value)} disabled={!runs.length}>
            {!runs.length && <option value="">no run yet</option>}
            {runs.map((r) => <option key={r.run_id} value={r.run_id}>{r.run_id} · {r.executed_at.slice(11, 19)}Z</option>)}
          </select>
        </label>
        <button className={btnPrimary} disabled={busy} onClick={execute}>{busy ? "Running…" : "Run four-case comparison"}</button>
      </div>
      <ErrorLine what="Four-case run" error={err} onRetry={execute} />
      <p className="text-xs text-muted-foreground">Four canonical cases (CF-01A/B scope, CF-02A/B revocation). The full 24-case scorecard runs in phase 05. All payments and accounts are synthetic.</p>

      {run ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={`Valid actions · run ${run.run_id} · n=${run.denominator}`} status="VERIFIED">
              <div className="space-y-2">{run.arms.map((a) => <Bar key={a.arm} label={ARM_LABEL[a.arm]!} value={a.valid} total={a.denominator} tone="ok" />)}</div>
            </Panel>
            <Panel title={`False authorize on traps · n=${run.arms[0]!.traps}`}>
              <div className="space-y-2">{run.arms.map((a) => <Bar key={a.arm} label={ARM_LABEL[a.arm]!} value={a.false_authorize} total={a.traps} tone="bad" />)}</div>
            </Panel>
            <Panel title={`Pair success · n=${run.arms[0]!.pairs_total} pairs`}>
              <div className="space-y-2">{run.arms.map((a) => <Bar key={a.arm} label={ARM_LABEL[a.arm]!} value={a.pairs_ok} total={a.pairs_total} tone="ok" />)}</div>
            </Panel>
            <Panel title="Category breakdown (valid)">
              <div className="space-y-2">{run.arms.flatMap((a) => a.categories.map((c) => <Bar key={a.arm + c.category} label={`${a.arm} · ${c.category}`} value={c.valid} total={c.total} tone="ok" />))}</div>
            </Panel>
          </div>

          <Panel title={`D outcome branches · run ${run.run_id} · denominator ${run.denominator}`}>
            <div className="flex h-8 overflow-hidden rounded border border-border" role="img" aria-label={branchCounts.map((x) => `${x.b} ${x.n}`).join(", ")}>
              {branchCounts.filter((x) => x.n).map((x) => (
                <div key={x.b} style={{ flex: x.n }} className={`flex items-center justify-center border-r border-background font-mono text-[11px] ${x.b === "allowed" ? "bg-allowed/30 text-allowed" : x.b === "denied" ? "bg-denied/30 text-denied" : "bg-pending/20 text-pending"}`}>{x.b} {x.n}</div>
              ))}
            </div>
            <p className="mt-2 font-mono text-xs">{branchCounts.map((x) => `${x.b} ${x.n}`).join(" + ")} = {branchCounts.reduce((s, x) => s + x.n, 0)} / {run.denominator} {branchCounts.reduce((s, x) => s + x.n, 0) === run.denominator ? "✓ reconciles" : "✗ does not reconcile"}</p>
            <p className="mt-1 text-xs">A blocked commercial path may retain an eligible sandbox or pilot action. No revenue effect is estimated here.</p>
          </Panel>

          <Panel title="Exact values">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr><th className="py-1">Case</th><th>Arm</th><th>Observed action</th><th>Reason</th><th>Branch</th><th>Valid</th><th>False authorize</th></tr></thead>
              <tbody className="font-mono">
                {run.rows.map((r) => (
                  <tr key={r.case_id + r.arm} className="border-t border-border">
                    <td className="py-1">{r.case_id}</td><td>{r.arm}</td><td className="break-all">{r.action}</td><td>{r.reason}</td><td>{r.branch}</td>
                    <td className={r.valid ? "text-allowed" : "text-denied"}>{r.valid ? "yes" : "no"}</td><td className={r.false_authorize ? "text-denied" : ""}>{r.false_authorize ? "YES" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px]">run_id {run.run_id} · contract {run.contract_version} · executed {run.executed_at} · baseline limitations: {run.baseline_limitations.join("; ")}. B is a local proxy and does not measure any deployed CRM product.</p>
          </Panel>
        </>
      ) : <Panel title="No current run">Press “Run four-case comparison” to execute the live engine and comparators.</Panel>}

      <Panel title={`Historical reference · run ${PRIOR_RESEARCH.run_id} (24-case sample)`}>
        <p className="mb-2 text-xs">Hatched bars = historical reference, not this session. Original sample of 24 cases, revision {PRIOR_RESEARCH.evaluated_revision}.</p>
        <div className="space-y-2">{PRIOR_RESEARCH.arms.map((a) => <Bar key={a.arm} label={`${a.arm} · ${a.label} (historical)`} value={a.valid} total={a.total} tone="hist" />)}</div>
      </Panel>

      <SimulationPanel />
      <EvidenceBundle />
    </div>
  );
}
