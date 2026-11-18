import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Panel } from "@/components/gtm/AppShell";
import { CandidateTable, TrustedTable } from "@/components/gtm/EvidenceTable";
import { useSandboxSession } from "@/hooks/use-sandbox-session";
import { PRIOR_RESEARCH } from "@/evaluation/history";
import { evaluateCaseFn, listDemoCasesFn } from "@/lib/gtm.functions";

const casesQuery = queryOptions({ queryKey: ["demo-cases"], queryFn: () => listDemoCasesFn() });

export const Route = createFileRoute("/evidencia")({
  head: () => ({
    meta: [
      { title: "Evidence · GTM engine" },
      { name: "description", content: "Candidate statements, trusted records, provenance and point-in-time visibility." },
      { property: "og:title", content: "Evidence · GTM engine" },
      { property: "og:description", content: "Candidate statements, trusted records, provenance and point-in-time visibility." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casesQuery),
  component: Evidence,
});

function Evidence() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const { sessionId } = useSandboxSession();
  const [caseId, setCaseId] = useState(cases[0]!.case_id);
  const [asOf, setAsOf] = useState(cases[0]!.decision_time);
  const evaluate = useServerFn(evaluateCaseFn);
  const load = useMutation({ mutationFn: () => evaluate({ data: { sessionId: sessionId!, caseId, asOf } }) });
  const r = load.data;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Evidence</h1>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted-foreground">Case
          <select aria-label="Case" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1 block rounded border border-input bg-card px-2 py-1.5 text-sm text-foreground">
            {cases.map((c) => <option key={c.case_id}>{c.case_id}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">As of tick
          <input aria-label="As of tick" type="number" min={0} value={asOf} onChange={(e) => setAsOf(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className="mt-1 block w-24 rounded border border-input bg-card px-2 py-1.5 font-mono text-sm text-foreground" />
        </label>
        <button disabled={!sessionId || load.isPending} onClick={() => load.mutate()} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Load evidence</button>
      </div>
      {r && (
        <>
          <Panel title={`Trusted records · registry v${r.registry_version}`}><p className="mb-2 text-xs">{r.trusted_source_disclosure}</p><TrustedTable records={r.trusted_records} asOf={r.as_of} /></Panel>
          <Panel title="Candidate statements"><CandidateTable candidates={r.candidates} /></Panel>
        </>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Prior research">
          Historical · run <span className="font-mono">{PRIOR_RESEARCH.run_id}</span> · revision <span className="font-mono">{PRIOR_RESEARCH.evaluated_revision}</span>
        </Panel>
        <Panel title="Real-field cohort" status="PENDING">
          Real commercial records: <span className="font-mono text-foreground">0/20</span>. Gate decision: HOLD.
        </Panel>
      </div>
    </div>
  );
}
