import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/gtm/AppShell";
import { INITIAL_CURRENT_RUN } from "@/evaluation/current-run";

export const Route = createFileRoute("/benchmark")({
  head: () => ({
    meta: [
      { title: "Benchmark · GTM engine" },
      { name: "description", content: "Computed comparison of exact GTM, superficial rules and a local Boolean proxy over 24 cases." },
      { property: "og:title", content: "Benchmark · GTM engine" },
      { property: "og:description", content: "Computed comparison of exact GTM, superficial rules and a local Boolean proxy over 24 cases." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Benchmark,
});

function Benchmark() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Benchmark</h1>
      <Panel title="Current run · D / C / B arms" status="UNEXECUTED">
        Run <span className="font-mono">{INITIAL_CURRENT_RUN.run_id}</span> · {INITIAL_CURRENT_RUN.rows.length} rows. Execution arrives in phase 05.
      </Panel>
    </div>
  );
}
