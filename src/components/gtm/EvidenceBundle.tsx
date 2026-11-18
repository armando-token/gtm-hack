import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Panel } from "@/components/gtm/AppShell";
import { ErrorLine, btn, btnPrimary } from "@/components/gtm/DemoParts";
import { fullRunFn, metamorphicRunFn, fieldReportFn } from "@/lib/gtm.functions";
import { DEFAULT_SIM, runSimulation, seedManifest } from "@/domain/sim/runner";
import { DATA_ORIGIN, FIDELITY, PENDING_COMPONENTS, RECORDED_TESTS } from "@/evaluation/handoff";
import { PROTOCOL_STATUS } from "@/components/gtm/SimulationPanel";

export function EvidenceBundle() {
  const full = useServerFn(fullRunFn), meta = useServerFn(metamorphicRunFn), field = useServerFn(fieldReportFn);
  const [href, setHref] = useState<{ url: string; name: string; summary: string } | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<unknown>(null);
  const build = async () => {
    setBusy(true); setErr(null);
    try {
      const [scorecard, metamorphic, fieldReport] = await Promise.all([full(), meta(), field()]);
      const sim = (await runSimulation({ ...DEFAULT_SIM, worlds: 6 })).report!;
      const bundle = { kind: "gtm-event-evidence", built_at: new Date().toISOString(), scorecard, metamorphic, simulation: sim, protocol_manifest: { seeds: seedManifest(DEFAULT_SIM), protocol_status: PROTOCOL_STATUS }, field: fieldReport, backend_tests: RECORDED_TESTS, data_origin: DATA_ORIGIN, fidelity: FIDELITY, pending: PENDING_COMPONENTS };
      const s = scorecard as unknown as { run_id?: string };
      setHref({ url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(bundle, null, 2))}`, name: `gtm-evidence-${s.run_id ?? sim.run_id}.json`, summary: `benchmark ${s.run_id ?? "?"} · simulation ${sim.run_id}` });
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Panel title="Current result · event evidence" status="PARTIAL">
      <div className="grid gap-2 text-xs md:grid-cols-4">
        {Object.entries(FIDELITY).filter(([k]) => k !== "reasons").map(([k, v]) => (
          <div key={k} className="rounded border border-border p-2"><p className="text-muted-foreground">{k}</p><p className={`font-mono ${v ? "text-allowed" : "text-pending"}`}>{String(v)}</p></div>
        ))}
      </div>
      <ul className="mt-2 list-disc pl-5 text-xs">{PENDING_COMPONENTS.map((p) => <li key={p.id}><span className="font-mono">{p.id}</span> pending: {p.what} — {p.impact}</li>)}</ul>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className={btnPrimary} disabled={busy} onClick={build}>{busy ? "Running fresh checks…" : "Build evidence bundle"}</button>
        {href && <a className={btn} href={href.url} download={href.name}>Download evidence JSON</a>}
        {href && <span className="font-mono text-[11px]">{href.summary}</span>}
      </div>
      <ErrorLine what="Evidence bundle" error={err} onRetry={build} />
    </Panel>
  );
}
