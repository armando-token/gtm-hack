import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Panel } from "@/components/gtm/AppShell";
import { ErrorLine, btn, btnPrimary } from "@/components/gtm/DemoParts";
import { PRIOR_RESEARCH } from "@/evaluation/history";
import { classifyIntakeFn, fieldReportFn } from "@/lib/gtm.functions";

const reportQuery = queryOptions({ queryKey: ["field-report"], queryFn: () => fieldReportFn() });

export const Route = createFileRoute("/field")({
  head: () => ({
    meta: [
      { title: "Field study · GTM engine" },
      { name: "description", content: "Real-field intake, readiness metrics and the pilot gate for the GTM authorization engine." },
      { property: "og:title", content: "Field study · GTM engine" },
      { property: "og:description", content: "Real-field intake, readiness metrics and the pilot gate for the GTM authorization engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(reportQuery),
  component: Field,
});

const dl = (name: string, body: string, type = "application/json") => ({ download: name, href: `data:${type};charset=utf-8,${encodeURIComponent(body)}` });
const NEXT = ["Recruit 12 retrospective + 8 prospective real opportunities", "Custodian attestation per record", "Legal entity link for each approval", "sent / reply / verified timestamps", "Two-reviewer resolution", "Supervised rework comparison (cost gate)"];
const SAMPLE = JSON.stringify({ opportunity_id: "opp-w01a01", anonymized_account_id: "acc-x", legal_entity_id: "ent-a", approval_entity_id: "ent-a", cohort: "prospective", enrolled_at: 10, outcome_known_at_enrollment: false, event_time: 1, known_time: 2, dataset_origin: "real", custodian_id: "cust-1", custodian_attestation: null, reviewer_resolution: "resolved" }, null, 2);

function Field() {
  const { data: r } = useSuspenseQuery(reportQuery);
  const classify = useServerFn(classifyIntakeFn);
  const [text, setText] = useState(SAMPLE);
  const check = useMutation({ mutationFn: () => classify({ data: JSON.parse(text) }) });
  const real = r.real;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Field study</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Real registrations" status="PENDING">
          <p className="text-3xl font-semibold text-foreground">{real.study.observed} / {real.study.target}</p>
          <p className="mt-1 text-xs">Retrospective {real.study.retrospective.observed}/{real.study.retrospective.target} · prospective {real.study.prospective.observed}/{real.study.prospective.target} · accounts assigned {real.study.assigned_accounts}</p>
          <p className="mt-2 font-mono text-sm text-pending">{real.gate.decision}</p>
          <p className="text-[11px]">Config {real.gate.config_version}</p>
        </Panel>
        <Panel title="Next evidence needed">
          <ul className="list-disc space-y-1 pl-5 text-xs">{NEXT.map((n) => <li key={n}>{n}</li>)}</ul>
        </Panel>
      </div>
      <Panel title="Gate indicators (real cohort)">
        <table className="w-full text-left text-xs"><thead className="text-muted-foreground"><tr><th className="py-1">Indicator</th><th>Threshold</th><th>Value</th><th>Status</th></tr></thead>
          <tbody className="font-mono">{real.gate.indicators.map((i) => <tr key={i.name} className="border-t border-border"><td className="py-1 font-sans">{i.name}</td><td>{i.threshold}</td><td>{i.value ?? "unavailable"}</td><td className={i.status === "pass" ? "text-allowed" : i.status === "fail" ? "text-denied" : "text-pending"}>{i.status}</td></tr>)}</tbody></table>
        <p className="mt-2 text-xs">Single-request resolution: {real.metrics.single_request_resolution.unavailable_reason ?? `${real.metrics.single_request_resolution.numerator}/${real.metrics.single_request_resolution.denominator}`}.</p>
      </Panel>
      <Panel title="Check a record against the intake rules">
        <p className="mb-2 text-xs">Results are not stored; real counters stay at 0 until a permitted study runs. A text origin “real” or a well-shaped hash is only an assertion — provenance is confirmed only by a verified custodian attestation.</p>
        <textarea aria-label="Intake record JSON" value={text} onChange={(e) => setText(e.target.value)} rows={8} className="w-full rounded border border-input bg-background p-2 font-mono text-xs text-foreground" />
        <button className={btnPrimary} disabled={check.isPending} onClick={() => check.mutate()}>Check record</button>
        <ErrorLine what="Intake check" error={check.error} onRetry={() => check.mutate()} />
        {check.data && <p className={`mt-2 font-mono text-xs ${check.data.status === "accepted" ? "text-allowed" : "text-denied"}`}>{check.data.status} · provenance {check.data.provenance} · {check.data.reasons.join(", ") || "no issues"}</p>}
      </Panel>
      <Panel title="Exports for a later permitted study">
        <div className="flex flex-wrap gap-2">
          {(Object.entries(r.templates) as [string, readonly string[]][]).map(([k, cols]) => <a key={k} className={btn} {...dl(`gtm-field-${k}.csv`, cols.join(",") + "\n", "text/csv")}>Template {k}</a>)}
          <button className={btn} onClick={() => { const a = document.createElement("a"); Object.assign(a, dl("gtm-field-metrics-decision.json", JSON.stringify({ config: r.config, real: r.real, computed_at: r.computed_at }, null, 2))); a.click(); }}>Metrics + decision JSON</button>
        </div>
      </Panel>
      <Panel title="About this evidence">
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>Inspiration: enterprise buying where an email “approval” rarely matches the exact scope, entity and terms being sold.</li>
          <li>Context: Cloudflare-style accounts, people and amounts are synthetic sandbox fixtures.</li>
          <li>Original run identity: <span className="font-mono">{PRIOR_RESEARCH.run_id}</span> (historical).</li>
          <li>New run identity: generated per execution on Benchmark and Experiments.</li>
        </ul>
      </Panel>
    </div>
  );
}
