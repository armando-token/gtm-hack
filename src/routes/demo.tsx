import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/gtm/AppShell";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Decision workbench · GTM engine" },
      { name: "description", content: "Evaluate, prepare and dispatch a commercial step against exact buyer authorization." },
      { property: "og:title", content: "Decision workbench · GTM engine" },
      { property: "og:description", content: "Evaluate, prepare and dispatch a commercial step against exact buyer authorization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Demo,
});

function Demo() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Decision workbench</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Account" status="PENDING">Organization, tenant and directory load in phase 03.</Panel>
        <Panel title="Proposal" status="PENDING">Exact key, amount and seat count load in phase 03.</Panel>
        <Panel title="Authorization" status="PENDING">Authority decision and proof arrive with the verified core (phase 02).</Panel>
        <Panel title="Timeline" status="PENDING">Decision → prepare → dispatch ticks appear in phase 04.</Panel>
      </div>
    </div>
  );
}
