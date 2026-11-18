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

/** The reference presentation runs isolated in a frame: its animation loop and key listeners end when this page unmounts. */
function Presentation() {
  return (
    <div className="fixed inset-0 z-50 bg-background">
      <iframe title="GTM presentation" src="/presentation/index.html" className="h-full w-full border-0" allow="fullscreen" />
      <Link to="/" className="absolute left-1/2 top-2 -translate-x-1/2 rounded border border-border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">← Back to app</Link>
    </div>
  );
}
