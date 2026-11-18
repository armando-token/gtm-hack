import { useState, type ReactNode } from "react";
import { KEY_AXES } from "@/domain/contracts";

export const btn = "rounded border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";
export const btnPrimary = "rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40";
export const field = "mt-1 block w-full rounded border border-input bg-card px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function Col({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 space-y-3 rounded-md border border-border bg-card p-4">
      <h2 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function Kv({ k, v, tone }: { k: string; v: ReactNode; tone?: "ok" | "bad" | "warn" | undefined }) {
  const c = tone === "ok" ? "text-allowed" : tone === "bad" ? "text-denied" : tone === "warn" ? "text-pending" : "text-foreground";
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className={`break-all text-right font-mono ${c}`}>{v}</span>
    </div>
  );
}

export function DecisionBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <p className={`rounded border px-3 py-2 font-mono text-sm ${ok ? "border-allowed/50 text-allowed" : "border-denied/50 text-denied"}`}>
      <span className="mr-2 font-semibold">{ok ? "ALLOW" : "BLOCK"}</span>{label}
    </p>
  );
}

export function TraceJson({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Trace JSON</span>
        <button className={btn} onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="max-h-56 overflow-auto rounded bg-background p-2 font-mono text-[10px] leading-snug text-muted-foreground">{text}</pre>
    </div>
  );
}

type K = Record<(typeof KEY_AXES)[number], string>;
export function AxisTable({ request, grant }: { request: K; grant: K | null }) {
  return (
    <table className="w-full text-left text-xs">
      <caption className="sr-only">Six-axis comparison</caption>
      <thead><tr className="text-muted-foreground"><th className="py-1">Axis</th><th>Requested</th><th>Trusted grant</th><th>Match</th></tr></thead>
      <tbody className="font-mono">
        {KEY_AXES.map((a) => {
          const m = grant ? request[a] === grant[a] : false;
          return (
            <tr key={a} className="border-t border-border">
              <td className="py-1 text-muted-foreground">{a}</td><td className="break-all">{request[a]}</td><td className="break-all">{grant?.[a] ?? "—"}</td>
              <td className={m ? "text-allowed" : "text-denied"}>{m ? "match" : "MISMATCH"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ErrorLine({ what, error, onRetry }: { what: string; error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded border border-denied/50 p-2 text-xs text-denied">
      <span>{what} failed: {(error as Error).message}</span>
      {onRetry && <button className={btn} onClick={onRetry}>Retry safely</button>}
    </div>
  );
}
