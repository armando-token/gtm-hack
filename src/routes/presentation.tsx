import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/presentation")({
  head: () => ({
    meta: [
      { title: "Presentation · GTM decision engine" },
      { name: "description", content: "Six-act interactive English presentation of the GTM authorization mechanism, with live fixtures and historical results." },
      { property: "og:title", content: "Presentation · GTM decision engine" },
      { property: "og:description", content: "Six-act interactive English presentation of the GTM authorization mechanism." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Presentation,
});

/** Public GitHub repository for judges; empty hides the button. */
const SOURCE_CODE_URL = "";

/** The reference presentation runs isolated in a frame: its animation loop and key listeners end when this page unmounts. */
function Presentation() {
  return (
    <div className="fixed inset-0 z-50 bg-background">
      <iframe title="GTM presentation" src="/presentation/index.html" className="h-full w-full border-0" allow="fullscreen" onLoad={(e) => e.currentTarget.focus()} />
      <nav aria-label="Judge links" className="absolute bottom-1 right-1 flex flex-wrap justify-end gap-1 text-[11px]">
        <Link to="/benchmark" className="rounded border border-primary bg-primary px-2 py-1 font-semibold text-primary-foreground hover:opacity-90">View raw data</Link>
        <Link to="/evidencia" className="rounded border border-border bg-background/80 px-2 py-1 text-foreground hover:bg-muted">Evidence</Link>
        {SOURCE_CODE_URL && <a href={SOURCE_CODE_URL} target="_blank" rel="noreferrer" className="rounded border border-border bg-background/80 px-2 py-1 text-foreground hover:bg-muted">View source code</a>}
        <Link to="/overview" className="rounded border border-border bg-background/80 px-2 py-1 text-muted-foreground hover:text-foreground">App</Link>
      </nav>
    </div>
  );
}
