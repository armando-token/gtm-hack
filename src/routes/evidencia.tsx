import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Panel, StatusTag } from "@/components/gtm/AppShell";
import { CandidateTable, TrustedTable } from "@/components/gtm/EvidenceTable";
import { ErrorLine, btnPrimary } from "@/components/gtm/DemoParts";
import { useSandboxSession } from "@/hooks/use-sandbox-session";
import { PRIOR_GATES, PRIOR_RESEARCH } from "@/evaluation/history";
import { evaluateCaseFn, fieldReportFn, fullRunFn, listDemoCasesFn } from "@/lib/gtm.functions";

const casesQuery = queryOptions({ queryKey: ["demo-cases"], queryFn: () => listDemoCasesFn() });

export const Route = createFileRoute("/evidencia")({
  head: () => ({
    meta: [
      { title: "Evidence · GTM engine" },
      { name: "description", content: "Case evidence, prior sealed study, newly executed runs and the real-field cohort, each labeled by origin." },
      { property: "og:title", content: "Evidence · GTM engine" },
      { property: "og:description", content: "Case evidence, prior sealed study, newly executed runs and the real-field cohort, each labeled by origin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casesQuery),
  component: Evidence,
});

const TABS = [["case", "Case evidence"], ["prior", "Prior study"], ["new", "New run"], ["real", "Real field"]] as const;
type Tab = (typeof TABS)[number][0];

function Evidence() {
  const [tab, setTab] = useState<Tab>("case");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Evidence</h1>
        <div role="tablist" aria-label="Evidence view" className="flex flex-wrap gap-1 rounded border border-border p-1">
          {TABS.map(([v, l]) => <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={`rounded px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === v ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{l}</button>)}
        </div>
      </div>
      {tab === "case" && <CaseEvidence />}
      {tab === "prior" && <PriorStudy />}
      {tab === "new" && <NewRun />}
      {tab === "real" && <RealField />}
    </div>
  );
}

function CaseEvidence() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const { sessionId } = useSandboxSession();
  const [caseId, setCaseId] = useState(cases[0]!.case_id);
  const [asOf, setAsOf] = useState(cases[0]!.decision_time);
  const evaluate = useServerFn(evaluateCaseFn);
  const load = useMutation({ mutationFn: () => evaluate({ data: { sessionId: sessionId!, caseId, asOf } }) });
  const r = load.data;
  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Case
          <select aria-label="Case" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1 block rounded border border-input bg-card px-2 py-1.5 text-sm text-foreground">
            {cases.map((c) => <option key={c.case_id}>{c.case_id}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">As of tick
          <input aria-label="As of tick" type="number" min={0} value={asOf} onChange={(e) => setAsOf(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className="mt-1 block w-24 rounded border border-input bg-card px-2 py-1.5 font-mono text-sm text-foreground" />
        </label>
        <button disabled={!sessionId || load.isPending} onClick={() => load.mutate()} className={btnPrimary}>Load evidence</button>
      </div>
      <ErrorLine what="Evidence load" error={load.error} onRetry={() => load.mutate()} />
      {r && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Direct candidate statement (buyer text)"><CandidateTable candidates={r.candidates} /></Panel>
          <Panel title={`Server trusted source · registry v${r.registry_version}`}><p className="mb-2 text-xs">{r.trusted_source_disclosure}</p><TrustedTable records={r.trusted_records} asOf={r.as_of} /></Panel>
        </div>
      )}
    </>
  );
}

function PriorStudy() {
  return (
    <>
      <Panel title={`Prior sealed gates · historical · run ${PRIOR_GATES.run_id}`}>
        <p className="mb-2 text-xs">Fixed documented numbers. Reference HEAD <span className="font-mono">{PRIOR_GATES.reference_head.slice(0, 12)}</span>, publication <span className="font-mono">{PRIOR_GATES.publication.slice(0, 12)}</span>. Not recomputed by this app.</p>
        <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="py-1">Gate</th><th>Historical result</th><th>Interpretation</th></tr></thead>
          <tbody>{PRIOR_GATES.gates.map((g) => <tr key={g.gate} className="border-t border-border align-top"><td className="py-1 font-mono">{g.gate}</td><td className="font-mono text-foreground">{g.result}</td><td>{g.meaning}</td></tr>)}</tbody></table>
      </Panel>
      <Panel title="D01 strategy comparison · simulated payments per 100 organizations">
        <div className="space-y-2">{PRIOR_GATES.d01.map((d) => (
          <div key={d.policy} className="grid grid-cols-[12rem_1fr_5rem] items-center gap-2 text-xs">
            <span>{d.policy}</span><div className="h-3 rounded bg-background"><div className="h-3 rounded bg-muted-foreground/60" style={{ width: `${d.per100}%` }} /></div><span className="text-right font-mono text-foreground">{d.per100}</span>
          </div>))}</div>
        <p className="mt-2 text-xs">The original contingent 50.84 vs adaptive 50.46 values are <strong>simulated payments per 100</strong> in D01 (12,000 synthetic organizations) — not revenue and not real customers. The simpler contingent policy was retained.</p>
      </Panel>
      <Panel title="Operational metrics · historical">
        <p className="text-xs">14/20 timely · 12/13 requests sent with ≤1 request · <span className="text-denied">1/13 valid verified at cutoff (7.69% vs 75%)</span>. Run {PRIOR_RESEARCH.run_id}.</p>
        <p className="mt-1 text-xs">A source-coverage percentage does not mean the same fraction of opportunities is authorized to proceed: a source can prove a scope is insufficient or revoked and still count as covered.</p>
      </Panel>
    </>
  );
}

function NewRun() {
  const runFn = useServerFn(fullRunFn), fieldFn = useServerFn(fieldReportFn);
  const go = useMutation({ mutationFn: async () => ({ run: await runFn(), field: await fieldFn() }) });
  const d = go.data;
  return (
    <>
      <button className={btnPrimary} disabled={go.isPending} onClick={() => go.mutate()}>{go.isPending ? "Executing…" : "Execute and read reports"}</button>
      <ErrorLine what="Execution" error={go.error} onRetry={() => go.mutate()} />
      {d && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title={`24-case benchmark · current run ${d.run.run_id}`} status="VERIFIED">
            <ul className="font-mono text-xs">{d.run.arms.map((a) => <li key={a.arm}>{a.arm}: {a.valid}/{a.denominator} valid · {a.false_authorize}/{a.traps} false authorize · {a.pairs_ok}/{a.pairs_total} pairs</li>)}</ul>
            <p className="mt-1 text-[11px]">Synthetic cases · executed {d.run.executed_at}</p>
          </Panel>
          <Panel title={`Field metrics recomputed · simulated example ${d.field.simulated_example.batch_id}`}>
            {(() => { const m = d.field.simulated_example.metrics; return (
              <ul className="font-mono text-xs">
                <li>direct trusted coverage {m.direct_trusted_coverage.numerator}/{m.direct_trusted_coverage.denominator}</li>
                <li>visible verifiable {m.visible_verifiable_coverage.numerator}/{m.visible_verifiable_coverage.denominator}</li>
                <li>authorized at cutoff {m.authorized_at_cutoff.numerator}/{m.authorized_at_cutoff.denominator}</li>
                <li>timely verified {m.timely_verified.numerator}/{m.timely_verified.denominator}</li>
                <li>valid confirmed ≤1 request {m.single_request_resolution.numerator}/{m.single_request_resolution.denominator} (requests sent ≤1: {m.requests_sent_le_1.numerator}/{m.requests_sent_le_1.denominator})</li>
                <li>median human minutes {m.median_human_minutes}</li>
                <li>gate: {d.field.simulated_example.gate.decision}</li>
              </ul>); })()}
            <p className="mt-1 text-[11px]">Origin: simulated. Never counted as real observations.</p>
          </Panel>
        </div>
      )}
    </>
  );
}

function RealField() {
  return (
    <Panel title="Real-field cohort" status="PENDING">
      <p className="text-2xl font-semibold text-foreground">0 / 20 <span className="text-sm font-normal text-muted-foreground">observations · 0 accounts assigned</span></p>
      <p className="mt-1 text-xs">All rates unavailable (empty denominator). Pilot gate: HOLD_OBSERVATION_RESOLVE_CAUSE. <StatusTag status="PENDING" /></p>
    </Panel>
  );
}
