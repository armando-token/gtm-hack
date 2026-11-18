import { createFileRoute } from "@tanstack/react-router";
import { Panel } from "@/components/gtm/AppShell";

export const Route = createFileRoute("/research")({
  head: () => ({
    meta: [
      { title: "Research · GTM engine" },
      { name: "description", content: "Executable experiments: simulated worlds, prediction, planning and transfer." },
      { property: "og:title", content: "Research · GTM engine" },
      { property: "og:description", content: "Executable experiments: simulated worlds, prediction, planning and transfer." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Research,
});

function Research() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Research</h1>
      <Panel title="Experiment controls" status="PARTIAL">Worlds, predictors, planners, transfer and E0–E7 attribution run live on the Experiments page. Historical numeric parity stays UNVERIFIED (new generator and random-number source).</Panel>
    </div>
  );
}
