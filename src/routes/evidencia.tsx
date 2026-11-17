import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/gtm/AppShell";
import { PRIOR_RESEARCH } from "@/evaluation/history";

export const Route = createFileRoute("/evidencia")({
  head: () => ({
    meta: [
      { title: "Evidence · GTM engine" },
      { name: "description", content: "Prior research results and real-field study status, with origin labels." },
      { property: "og:title", content: "Evidence · GTM engine" },
      { property: "og:description", content: "Prior research results and real-field study status, with origin labels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Evidence,
});

function Evidence() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Evidence</h1>
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
