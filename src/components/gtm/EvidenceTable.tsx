import type { evaluateCase } from "@/server/gtm-service.server";

type Result = Awaited<ReturnType<typeof evaluateCase>>;

export function CandidateTable({ candidates }: { candidates: Result["candidates"] }) {
  if (!candidates.length) return <p>No candidate statements extracted.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr><th className="py-1 pr-3">Source</th><th className="pr-3">Speaker · role</th><th className="pr-3">Identity</th><th className="pr-3">Span</th><th className="pr-3">Polarity</th><th>Provenance</th></tr>
        </thead>
        <tbody className="text-foreground">
          {candidates.map((c, i) => (
            <tr key={i} className="border-t border-border align-top">
              <td className="py-1.5 pr-3 font-mono">{c.source_id}<br />{c.record_id}@{c.source_version}</td>
              <td className="pr-3">{c.speaker}<br /><span className="text-muted-foreground">{c.speaker_role ?? "—"}</span></td>
              <td className="pr-3 font-mono">{c.identity.status}</td>
              <td className="pr-3">
                <span className="font-mono text-muted-foreground">[{c.span.start}:{c.span.end}]</span> “{c.slice}”
                {c.quoted_subject && <div className="text-muted-foreground">quoted subject: {c.quoted_subject}</div>}
              </td>
              <td className="pr-3 font-mono">{c.polarity}{c.abstention_reason && <div className="text-pending">{c.abstention_reason}</div>}</td>
              <td className="font-mono text-muted-foreground">candidate · no authority{!c.counts_as_independent && " · correlated copy"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TrustedTable({ records, asOf }: { records: Result["trusted_records"]; asOf: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr><th className="py-1 pr-3">Evidence</th><th className="pr-3">Source · rev</th><th className="pr-3">Effect</th><th className="pr-3">Key (capability · terms)</th><th className="pr-3">Visible from</th><th>At tick {asOf}</th></tr>
        </thead>
        <tbody className="text-foreground">
          {records.map((r) => (
            <tr key={r.evidence_id} className="border-t border-border">
              <td className="py-1.5 pr-3 font-mono">{r.evidence_id}</td>
              <td className="pr-3 font-mono">{r.source} · r{r.revision}</td>
              <td className={`pr-3 font-mono ${r.effect === "grant" ? "text-allowed" : "text-denied"}`}>{r.effect}</td>
              <td className="pr-3 font-mono">{r.key.capability} · {r.key.terms_digest}</td>
              <td className="pr-3 font-mono">t{r.visible_from} → t{r.valid_until}</td>
              <td className="font-mono">{r.visible ? "visible" : "not yet visible"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
