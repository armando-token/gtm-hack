import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/gtm/AppShell";
import { PRIOR_RESEARCH } from "@/evaluation/history";

export const Route = createFileRoute("/field")({
  head: () => ({
    meta: [
      { title: "Field study · GTM engine" },
      { name: "description", content: "Real-world registration status and evidence provenance for the GTM authorization engine." },
      { property: "og:title", content: "Field study · GTM engine" },
      { property: "og:description", content: "Real-world registration status and evidence provenance for the GTM authorization engine." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Field,
});

const TEMPLATE = "opportunity_id,decision_id,parent_decision_id,occurred_at_utc,origin,requested_action,authority_source_ref,outcome\n";
const INDICATORS = ["Authorized-dispatch rate", "Blocked-but-alternative rate", "Time to verified permission", "Post-dispatch revocation incidents"];

function Field() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Field study</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Real registrations" status="PENDING">
          <p className="text-3xl font-semibold text-foreground">0 / 20</p>
          <div className="mt-2 h-2 rounded bg-background" role="img" aria-label="0 of 20 real registrations"><div className="h-2 w-0 rounded bg-allowed" /></div>
          <p className="mt-2 text-xs">No real opportunities have been registered. Simulated rows are never counted here.</p>
          <div className="mt-3 flex gap-2">
            <a className="rounded border border-input px-3 py-1.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" download="gtm-field-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`}>Download template</a>
            <a className="rounded border border-input px-3 py-1.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" download="gtm-field-export.json" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ origin: "real", rows: [] }, null, 2))}`}>Export (empty)</a>
          </div>
        </Panel>
        <Panel title="Measured rates">
          <table className="w-full text-left text-xs">
            <tbody>{INDICATORS.map((i) => <tr key={i} className="border-t border-border"><td className="py-1">{i}</td><td className="text-right font-mono text-pending">pending · open · n=0</td></tr>)}</tbody>
          </table>
        </Panel>
      </div>
      <Panel title="About this evidence">
        <ul className="list-disc space-y-1 pl-5 text-xs">
          <li>Inspiration: real enterprise buying where an email “approval” rarely matches the exact scope, entity and terms being sold.</li>
          <li>Context: Cloudflare-style accounts, people and amounts are synthetic sandbox fixtures, not customer data.</li>
          <li>Original run identity: <span className="font-mono">{PRIOR_RESEARCH.run_id}</span> (historical, revision {PRIOR_RESEARCH.evaluated_revision}).</li>
          <li>New run identity: generated per execution on the Experiments page (<span className="font-mono">run-4c-…</span>); phase 05 adds the full 24-case run.</li>
        </ul>
      </Panel>
    </div>
  );
}
