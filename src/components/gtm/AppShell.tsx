import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Overview" },
  { to: "/demo", label: "Decision" },
  { to: "/benchmark", label: "Benchmark" },
  { to: "/research", label: "Research" },
  { to: "/evidencia", label: "Evidence" },
  { to: "/experiments", label: "Experiments" },
  { to: "/field", label: "Field study" },
  { to: "/presentation", label: "Presentation" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">GTM · decision engine</span>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: true }}
                className="rounded px-2.5 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <SandboxBadge />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export function SandboxBadge() {
  return (
    <span className="ml-auto inline-flex items-center gap-2 rounded border border-pending/40 px-2 py-0.5 font-mono text-xs text-pending">
      <span className="h-1.5 w-1.5 rounded-full bg-pending" aria-hidden />
      Synthetic sandbox
    </span>
  );
}

export function StatusTag({ status }: { status: "VERIFIED" | "PARTIAL" | "PENDING" | "allowed" | "denied" | "unknown" | "conflict" | "UNEXECUTED" }) {
  const tone =
    status === "VERIFIED" || status === "allowed"
      ? "text-allowed border-allowed/40"
      : status === "denied" || status === "conflict"
        ? "text-denied border-denied/40"
        : "text-pending border-pending/40";
  return <span className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[11px] uppercase ${tone}`}>{status}</span>;
}

export function Panel({ title, status, children }: { title: string; status?: Parameters<typeof StatusTag>[0]["status"]; children?: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {status && <StatusTag status={status} />}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  );
}
