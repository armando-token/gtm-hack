import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, StatusTag } from "@/components/gtm/AppShell";
import { PRIOR_RESEARCH } from "@/evaluation/history";
import { INITIAL_CURRENT_RUN } from "@/evaluation/current-run";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GTM Decision Engine · 500 vs 2,000 seats" },
      { name: "description", content: "Decide whether the buyer authorized a 2,000-seat proposal or only a 500-seat pilot, from trusted evidence." },
      { property: "og:title", content: "GTM Decision Engine · 500 vs 2,000 seats" },
      { property: "og:description", content: "Decide whether the buyer authorized a 2,000-seat proposal or only a 500-seat pilot, from trusted evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="space-y-8">
      <Link to="/presentation" className="flex items-center justify-between gap-3 rounded border border-primary/60 bg-primary/10 px-4 py-3 text-sm font-medium text-foreground hover:bg-primary/20"><span>▶ Open the animated six-act presentation</span><span aria-hidden>→</span></Link>
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Did the buyer authorize 2,000 seats, or only a 500-seat pilot?</h1>
        <p className="text-muted-foreground">
          The engine selects the next permitted commercial step from trusted authorization records — not from what an email seems to say.
        </p>
        <Link to="/demo" className="inline-flex rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Open decision workbench
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Current run" status="UNEXECUTED">
          <p>Run id: <span className="font-mono">{INITIAL_CURRENT_RUN.run_id}</span></p>
          <p>Rows: {INITIAL_CURRENT_RUN.rows.length}. Counts appear after the benchmark executes.</p>
        </Panel>
        <Panel title="Prior research">
          <p className="mb-2">Origin: historical · run <span className="font-mono">{PRIOR_RESEARCH.run_id}</span></p>
          <ul className="space-y-1">
            {PRIOR_RESEARCH.arms.map((a) => (
              <li key={a.arm} className="flex justify-between">
                <span>{a.arm} · {a.label}</span>
                <span className="font-mono text-foreground">{a.valid}/{a.total}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="text-xs text-muted-foreground">Contract <StatusTag status="PARTIAL" /> gtm-lovable-rebuild-v1</p>
    </div>
  );
}
