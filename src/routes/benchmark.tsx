import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { Panel, StatusTag } from "@/components/gtm/AppShell";
import { ErrorLine, btn, btnPrimary } from "@/components/gtm/DemoParts";
import { PRIOR_RESEARCH } from "@/evaluation/history";
import { fullRunFn, metamorphicRunFn } from "@/lib/gtm.functions";

export const Route = createFileRoute("/benchmark")({
  head: () => ({
    meta: [
      { title: "Benchmark · GTM engine" },
      { name: "description", content: "Live 24-case comparison of exact GTM, superficial rules and a local CRM rule proxy, beside prior research." },
      { property: "og:title", content: "Benchmark · GTM engine" },
      { property: "og:description", content: "Live 24-case comparison of exact GTM, superficial rules and a local CRM rule proxy, beside prior research." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Benchmark,
});

type Run = Awaited<ReturnType<typeof fullRunFn>>;
type Meta = Awaited<ReturnType<typeof metamorphicRunFn>>;
const LABEL: Record<string, string> = { D: "D · Exact GTM", C: "C · Superficial rules (local)", B: "B · Local CRM rule proxy" };

/** Wilson 95% interval, recalculated from the shown denominator. */
function wilson(k: number, n: number) {
  if (!n) return "—";
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return `${Math.round(Math.max(0, c - h) * 100)}–${Math.round(Math.min(1, c + h) * 100)}%`;
}

function Benchmark() {
  const [view, setView] = useState<"current" | "prior">("current");
  const runFn = useServerFn(fullRunFn);
  const metaFn = useServerFn(metamorphicRunFn);
  const [run, setRun] = useState<Run | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [open, setOpen] = useState<string | null>(null);

  const execute = async () => {
    setBusy(true); setErr(null);
    try { const [r, m] = await Promise.all([runFn(), metaFn()]); setRun(r); setMeta(m); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const exportHref = run ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ ...run, metamorphic: meta }, null, 2))}` : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Benchmark · 24 canonical cases</h1>
        <div role="tablist" aria-label="View" className="flex gap-1 rounded border border-border p-1">
          {([["current", "Current run"], ["prior", "Prior research"]] as const).map(([v, l]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`rounded px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === v ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>
      </div>

      {view === "prior" ? (
        <Panel title={`Prior research · run ${PRIOR_RESEARCH.run_id}`}>
          <p className="mb-2 text-xs">Historical, fixed figures from the original benchmark (sample n=24; evaluated revision {PRIOR_RESEARCH.evaluated_revision}, published {PRIOR_RESEARCH.published_revision}). Not recomputed here.</p>
          <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="py-1">Arm</th><th>Valid</th><th>95% interval</th></tr></thead>
            <tbody className="font-mono">{PRIOR_RESEARCH.arms.map((a) => <tr key={a.arm} className="border-t border-border"><td className="py-1">{a.arm} · {a.label}</td><td>{a.valid}/{a.total}</td><td>{wilson(a.valid, a.total)}</td></tr>)}
              <tr className="border-t border-border"><td className="py-1">A · External product (Aligned DSR)</td><td colSpan={2} className="text-pending">UNTESTED — no observations, no score</td></tr>
            </tbody></table>
        </Panel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button className={btnPrimary} disabled={busy} onClick={execute}>{busy ? "Running 24 cases…" : run ? "Re-run" : "Run 24-case benchmark"}</button>
            {exportHref && <a className={btn} download={`${run!.run_id}.json`} href={exportHref}>Export current-run JSON</a>}
            {run && <span className="font-mono text-xs text-muted-foreground">{run.run_id} · n={run.denominator} · inputs {run.inputs_digest.slice(0, 12)} · {run.runtime_version}</span>}
          </div>
          <ErrorLine what="Benchmark run" error={err} onRetry={execute} />
          {!run ? <Panel title="Current run" status="UNEXECUTED">Press run to execute all three arms on the 24 public inputs.</Panel> : (
            <>
              <Panel title={`Scores · current run ${run.run_id}`} status={run.unresolved_mismatches.length ? "PARTIAL" : "VERIFIED"}>
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground"><tr><th className="py-1">Arm</th><th>Valid actions</th><th>95% interval</th><th>Target</th><th>False authorize (traps)</th><th>Target</th><th>Pair accuracy</th><th>Target</th></tr></thead>
                  <tbody className="font-mono">
                    {run.arms.map((a) => { const t = run.targets[a.arm]; const m = (x: number, y: number) => x === y ? "text-allowed" : "text-denied"; return (
                      <tr key={a.arm} className="border-t border-border">
                        <td className="py-1">{LABEL[a.arm]}{a.arm === "B" && <span className="ml-1 text-pending">PROXY</span>}</td>
                        <td>{a.valid}/{a.denominator}</td><td>{wilson(a.valid, a.denominator)}</td><td className={m(a.valid, t.valid)}>{t.valid}/24</td>
                        <td>{a.false_authorize}/{a.traps}</td><td className={m(a.false_authorize, t.false_authorize)}>{t.false_authorize}/12</td>
                        <td>{a.pairs_ok}/{a.pairs_total}</td><td className={m(a.pairs_ok, t.pairs_ok)}>{t.pairs_ok}/12</td>
                      </tr>); })}
                    <tr className="border-t border-border"><td className="py-1">A · External product</td><td colSpan={7} className="text-pending">UNTESTED — excluded from all denominators</td></tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs">{run.unresolved_mismatches.length ? `Differences from conformance targets: ${run.unresolved_mismatches.map((x) => `${x.arm} ${x.metric} ${x.actual}≠${x.target}`).join("; ")}` : "All scores match the conformance targets. Targets are oracles; the numbers above are computed from this run's rows."}</p>
                <p className="mt-1 text-[11px]">B is a local CRM rule proxy (originally modelled on a Salesforce Flow rule); it does not measure any deployed product.</p>
              </Panel>

              <Panel title="Group breakdown (valid actions, computed from case records)">
                <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="py-1">Category</th>{run.arms.map((a) => <th key={a.arm}>{a.arm}</th>)}</tr></thead>
                  <tbody className="font-mono">{run.arms[0]!.categories.map((c) => (
                    <tr key={c.category} className="border-t border-border"><td className="py-1">{c.category}</td>{run.arms.map((a) => { const x = a.categories.find((y) => y.category === c.category)!; return <td key={a.arm}>{x.valid}/{x.total}</td>; })}</tr>
                  ))}</tbody></table>
              </Panel>

              {meta && (
                <Panel title={`Metamorphic controls · ${meta.passed}/${meta.total} pass`} status={meta.failed.length ? "PARTIAL" : "VERIFIED"}>
                  <ul className="grid gap-1 font-mono text-xs md:grid-cols-2">{meta.by_check.map((c) => <li key={c.check} className={c.ok === c.n ? "text-allowed" : "text-denied"}>{c.check}: {c.ok}/{c.n}</li>)}</ul>
                  {meta.failed.map((f, i) => <p key={i} className="font-mono text-xs text-denied">{f.check} · {f.case_id} · {f.cause}</p>)}
                </Panel>
              )}

              <Panel title="Per-case trace (D arm detail; C/B observed actions)">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground"><tr><th className="py-1">Case</th><th>Variant</th><th>D action · reason</th><th>Gate</th><th>Dispatch</th><th>Mismatch</th><th>C</th><th>B</th><th></th></tr></thead>
                  <tbody className="font-mono">
                    {[...new Set(run.rows.map((r) => r.case_id))].map((id) => {
                      const d = run.rows.find((r) => r.case_id === id && r.arm === "D")!, c = run.rows.find((r) => r.case_id === id && r.arm === "C")!, b = run.rows.find((r) => r.case_id === id && r.arm === "B")!;
                      const t = d.trace!;
                      return (
                        <Fragment key={id}>
                          <tr className="border-t border-border align-top">
                            <td className="py-1">{id}</td><td>{d.variant}</td>
                            <td className={d.valid ? "text-allowed" : "text-denied"}>{d.action}<br /><span className="text-muted-foreground">{d.reason}</span></td>
                            <td>{t.gate}</td><td>{t.dispatch_attempted ? (t.dispatch_committed ? "committed" : `blocked · ${t.dispatch_reason}`) : "not attempted"}</td>
                            <td>{t.mismatch_axes.join(",") || "—"}</td>
                            <td className={c.valid ? "text-allowed" : "text-denied"}>{c.valid ? "ok" : "✗"}</td><td className={b.valid ? "text-allowed" : "text-denied"}>{b.valid ? "ok" : "✗"}</td>
                            <td><button className={btn} aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>Trace</button></td>
                          </tr>
                          {open === id && <tr><td colSpan={9}><pre className="max-h-64 overflow-auto rounded bg-background p-2 text-[10px]">{JSON.stringify({ d, c: { action: c.action, valid: c.valid }, b: { action: b.action, valid: b.valid } }, null, 2)}</pre></td></tr>}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            </>
          )}
          <p className="text-xs text-muted-foreground">The four interactive demo cases cover two pairs only; they cannot establish this 24-case score. <StatusTag status="PENDING" /> Policy simulation arrives in phase 07.</p>
        </>
      )}
    </div>
  );
}
