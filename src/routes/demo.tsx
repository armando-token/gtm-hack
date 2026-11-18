import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Panel, StatusTag } from "@/components/gtm/AppShell";
import { CandidateTable, TrustedTable } from "@/components/gtm/EvidenceTable";
import { useSandboxSession } from "@/hooks/use-sandbox-session";
import { evaluateCaseFn, listDemoCasesFn, verifyPermissionFn } from "@/lib/gtm.functions";

const casesQuery = queryOptions({ queryKey: ["demo-cases"], queryFn: () => listDemoCasesFn() });

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Decision workbench · GTM engine" },
      { name: "description", content: "Evaluate a commercial step against exact, trusted buyer authorization." },
      { property: "og:title", content: "Decision workbench · GTM engine" },
      { property: "og:description", content: "Evaluate a commercial step against exact, trusted buyer authorization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casesQuery),
  component: Demo,
});

const usd = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(minor / 100);

function Demo() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const { sessionId, reset } = useSandboxSession();
  const [caseId, setCaseId] = useState(cases[0]!.case_id);
  const selected = cases.find((c) => c.case_id === caseId)!;
  const [asOf, setAsOf] = useState(selected.decision_time);
  const evaluate = useServerFn(evaluateCaseFn);
  const verify = useServerFn(verifyPermissionFn);
  const run = useMutation({ mutationFn: (v: { caseId: string; asOf: number }) => evaluate({ data: { sessionId: sessionId!, ...v } }) });
  const check = useMutation({ mutationFn: (ref: string) => verify({ data: { sessionId: sessionId!, caseId, asOf, ref } }) });

  useEffect(() => {
    setAsOf(selected.decision_time);
    run.reset();
    check.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, sessionId]);

  const r = run.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="mr-auto text-xl font-semibold">Decision workbench</h1>
        <label className="text-xs text-muted-foreground">
          Case
          <select aria-label="Case" value={caseId} onChange={(e) => setCaseId(e.target.value)} className="mt-1 block rounded border border-input bg-card px-2 py-1.5 text-sm text-foreground">
            {cases.map((c) => <option key={c.case_id} value={c.case_id}>{c.case_id}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          As of tick
          <input aria-label="As of tick" type="number" min={0} value={asOf} onChange={(e) => setAsOf(Math.max(0, Math.trunc(Number(e.target.value) || 0)))} className="mt-1 block w-24 rounded border border-input bg-card px-2 py-1.5 font-mono text-sm text-foreground" />
        </label>
        <button disabled={!sessionId || run.isPending} onClick={() => run.mutate({ caseId, asOf })} className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {run.isPending ? "Evaluating…" : "Evaluate"}
        </button>
        <button onClick={reset} className="rounded border border-input px-3 py-2 text-sm hover:bg-accent">Reset session</button>
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.title} · decision t{selected.decision_time} · dispatch t{selected.dispatch_time} · session <span className="font-mono">{sessionId?.slice(0, 13) ?? "…"}</span>
      </p>
      {run.error && <p className="text-sm text-denied">Evaluation failed: {(run.error as Error).message}</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Account">
          {r ? <p className="font-mono text-foreground">{r.case.tenant_id}<br />{r.case.organization_id}</p> : "Press Evaluate to load the account."}
        </Panel>
        <Panel title="Proposal">
          {r ? (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">{usd(r.case.amount_minor)} <span className="text-xs text-muted-foreground">{r.case.currency}</span></p>
              <p className="font-mono text-xs">{r.case.target_key.actor} · {r.case.target_key.capability} · {r.case.target_key.action}</p>
              <p className="font-mono text-xs">terms: {r.case.target_key.terms_digest}</p>
            </div>
          ) : "—"}
        </Panel>
        <Panel title="Authorization" {...(r ? { status: r.authority.state } : {})}>
          {r ? (
            <div className="space-y-2">
              <p>Authority at t{r.as_of}: <span className="font-mono text-foreground">{r.authority.state} · {r.authority.reason}</span></p>
              <p>Explicit approval: <span className={`font-mono ${r.approval.ok ? "text-allowed" : "text-denied"}`}>{r.approval.ok ? "valid" : r.approval.reason}</span></p>
              <p>Readiness: <span className={`font-mono ${r.readiness === "ready_to_launch" ? "text-allowed" : "text-denied"}`}>{r.readiness}</span></p>
              <p className="break-all font-mono text-[11px]">proof sha256 {r.authority.proof_digest}</p>
              {r.authority.proof.mismatch_axes.length > 0 && <p className="font-mono text-xs">mismatch: {r.authority.proof.mismatch_axes.join(", ")}</p>}
              {r.permission_ref ? (
                <div className="space-y-1">
                  <p className="break-all font-mono text-[11px]">permission {r.permission_ref.slice(0, 28)}…</p>
                  <button onClick={() => check.mutate(r.permission_ref!)} className="rounded border border-input px-2 py-1 text-xs hover:bg-accent">Verify on server</button>
                  <button onClick={() => check.mutate(r.permission_ref!.replace(/.$/, "0"))} className="ml-2 rounded border border-input px-2 py-1 text-xs hover:bg-accent">Try tampered copy</button>
                  {check.data && <p className={`font-mono text-xs ${check.data.ok ? "text-allowed" : "text-denied"}`}>{check.data.ok ? "verified by server" : `rejected: ${check.data.reason}`}</p>}
                </div>
              ) : <p className="font-mono text-xs">No permission issued.</p>}
            </div>
          ) : "—"}
        </Panel>
        <Panel title="Timeline" status="PENDING">Prepare and dispatch transitions arrive in phase 03–04. Change “As of tick” and evaluate again to see point-in-time authority.</Panel>
      </div>
      {r && (
        <>
          <Panel title="Trusted records (server registry)"><p className="mb-2 text-xs">{r.trusted_source_disclosure}</p><TrustedTable records={r.trusted_records} asOf={r.as_of} /></Panel>
          <Panel title="Candidate statements"><CandidateTable candidates={r.candidates} /></Panel>
        </>
      )}
      <p className="text-xs text-muted-foreground"><StatusTag status="PARTIAL" /> Session state lives in server memory until durable storage is enabled.</p>
    </div>
  );
}
