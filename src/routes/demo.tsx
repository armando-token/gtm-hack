import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AxisTable, Col, DecisionBadge, ErrorLine, Kv, TraceJson, btn, btnPrimary, field } from "@/components/gtm/DemoParts";
import { useSandboxSession } from "@/hooks/use-sandbox-session";
import { createRequestGuard } from "@/lib/request-guard";
import { dispatchActionFn, evaluateCaseFn, evaluateScopeFn, insertRevocationFn, prepareActionFn, sessionTimelineFn } from "@/lib/gtm.functions";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Decision workbench · GTM engine" },
      { name: "description", content: "Two live scenes: exact scope binding and revocation between preparation and dispatch." },
      { property: "og:title", content: "Decision workbench · GTM engine" },
      { property: "og:description", content: "Two live scenes: exact scope binding and revocation between preparation and dispatch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Demo,
});

const usd = (minor: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(minor / 100);
type Scene = "scope" | "revocation";

function Demo() {
  const [scene, setScene] = useState<Scene>("scope");
  const { sessionId, reset } = useSandboxSession();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold">Decision workbench</h1>
        <div role="tablist" aria-label="Scene" className="flex gap-1 rounded border border-border p-1">
          {(["scope", "revocation"] as const).map((s, i) => (
            <button key={s} role="tab" aria-selected={scene === s} onClick={() => setScene(s)}
              className={`rounded px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${scene === s ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              Scene {i + 1} · {s === "scope" ? "Scope" : "Revocation"}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-muted-foreground">session {sessionId?.slice(5, 18) ?? "…"}</span>
      </div>
      {scene === "scope" ? <ScopeScene onReset={reset} /> : sessionId ? <RevocationScene key={sessionId} sessionId={sessionId} onReset={reset} /> : <p className="text-sm">Starting sandbox session…</p>}
    </div>
  );
}

/* ---------------- Scene 1 · Scope ---------------- */
type ScopeResult = Awaited<ReturnType<typeof evaluateScopeFn>>;
const INITIAL = { requestedSeats: 2000 as 500 | 2000, grantSeats: 2000 as 500 | 2000, grantOrganization: "org-f500-telco" as const as "org-f500-telco" | "org-f500-telco-emea-sub", grantCapability: "approve_spend" as "approve_spend" | "approve_sandbox", asOf: 100, grantValidUntil: 200 };

function ScopeScene({ onReset }: { onReset: () => void }) {
  const evaluate = useServerFn(evaluateScopeFn);
  const [ctl, setCtl] = useState(INITIAL);
  const [res, setRes] = useState<ScopeResult | null>(null);
  const [prev, setPrev] = useState<ScopeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [audit, setAudit] = useState(false);
  const guard = useRef(createRequestGuard());

  const run = useCallback(async (c: typeof INITIAL) => {
    const t = guard.current.next();
    setBusy(true); setErr(null);
    try {
      const r = await evaluate({ data: c });
      if (!guard.current.isCurrent(t)) return; // U04: stale reply discarded
      setRes((old) => { setPrev(old); return r; });
    } catch (e) { if (guard.current.isCurrent(t)) setErr(e); }
    finally { if (guard.current.isCurrent(t)) setBusy(false); }
  }, [evaluate]);

  useEffect(() => { void run(ctl); }, [ctl, run]);
  const set = <K extends keyof typeof INITIAL>(k: K, v: (typeof INITIAL)[K]) => setCtl((c) => ({ ...c, [k]: v }));
  const ok = res?.readiness === "ready_to_launch";
  const changed = res && prev ? { request: res.request_version !== prev.request_version, permission: res.permission_version !== prev.permission_version } : null;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr_1.1fr]">
        <Col title="Buyer message · unchanged">
          <blockquote className="whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm text-foreground">{res?.message.text ?? "…"}</blockquote>
          <p className="text-xs text-muted-foreground">Candidate statement only — never grants authority. Received {res?.message.first_known_at ?? "…"} (UTC).</p>
          <h3 className="pt-2 text-xs font-semibold text-foreground">Trusted simulator registry</h3>
          {res && (
            <div className="rounded border border-border p-2">
              <Kv k="record" v={res.permission.record.evidence_id} />
              <Kv k="effect · rev" v={`${res.permission.record.effect} · ${res.permission.record.revision}`} />
              <Kv k="terms" v={res.permission.record.key.terms_digest} />
              <Kv k="entity" v={res.permission.record.key.organization} />
              <Kv k="capability" v={res.permission.record.key.capability} />
              <Kv k="valid ticks" v={`${res.permission.record.valid_from}–${res.permission.record.valid_until}`} />
              <Kv k="explicit approval" v={`${res.permission.approval.evidence_id} (same key)`} />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">{res?.trusted_source_disclosure}</p>
        </Col>

        <Col title="Target action & registered scope">
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted-foreground">Requested seats (proposal)</legend>
            <div className="flex gap-2">{([500, 2000] as const).map((s) => (
              <label key={s} className="flex items-center gap-1 text-sm"><input type="radio" name="req" checked={ctl.requestedSeats === s} onChange={() => set("requestedSeats", s)} />{s.toLocaleString()}</label>
            ))}</div>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-xs text-muted-foreground">Authoritative permission fixture (grant + its explicit approval)</legend>
            <div className="flex gap-2">{([500, 2000] as const).map((s) => (
              <label key={s} className="flex items-center gap-1 text-sm"><input type="radio" name="grant" checked={ctl.grantSeats === s} onChange={() => set("grantSeats", s)} />{s.toLocaleString()} seats</label>
            ))}</div>
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted-foreground">Legal entity on grant
              <select className={field} value={ctl.grantOrganization} onChange={(e) => set("grantOrganization", e.target.value as typeof ctl.grantOrganization)}>
                <option value="org-f500-telco">org-f500-telco (parent)</option><option value="org-f500-telco-emea-sub">EMEA subsidiary</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Approver capability
              <select className={field} value={ctl.grantCapability} onChange={(e) => set("grantCapability", e.target.value as typeof ctl.grantCapability)}>
                <option value="approve_spend">approve_spend</option><option value="approve_sandbox">approve_sandbox</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Cutoff (virtual tick)
              <select className={field} value={ctl.asOf} onChange={(e) => set("asOf", Number(e.target.value))}>
                {[100, 105, 110].map((t) => <option key={t} value={t}>t{t}</option>)}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Grant valid until (tick)
              <input type="number" min={0} max={1000} className={field} value={ctl.grantValidUntil} onChange={(e) => set("grantValidUntil", Math.max(0, Math.min(1000, Math.trunc(Number(e.target.value) || 0))))} />
            </label>
          </div>
          {res && (
            <div className="rounded border border-border p-2">
              <Kv k="requested" v={`${res.request.seats.toLocaleString()} seats · ${usd(res.request.amount_minor)}`} />
              <Kv k="granted" v={`${ctl.grantSeats.toLocaleString()} seats`} />
              <Kv k="request version" v={res.request_version} tone={changed?.request ? "warn" : undefined} />
              <Kv k="permission version" v={res.permission_version} tone={changed?.permission ? "warn" : undefined} />
            </div>
          )}
          {changed?.request && changed.permission && <p className="text-xs text-pending">Both the requested terms and the permission version changed in this step.</p>}
          {changed && changed.request && !changed.permission && <p className="text-xs text-muted-foreground">Only the request changed — the existing approval was not modified.</p>}
          <div className="flex flex-wrap gap-2">
            <button className={btnPrimary} disabled={busy} onClick={() => void run(ctl)}>{busy ? "Evaluating…" : "Evaluate"}</button>
            <button className={btn} onClick={() => { setCtl(INITIAL); setPrev(null); onReset(); }}>Reset scenario</button>
          </div>
          <ErrorLine what="Evaluation" error={err} onRetry={() => void run(ctl)} />
        </Col>

        <Col title="Computed decision">
          {res ? (
            <>
              <div aria-live="polite"><DecisionBadge ok={ok} label={res.readiness} /></div>
              <Kv k="next action" v={res.action.action} tone={ok ? "ok" : "warn"} />
              <Kv k="authority" v={`${res.authority.state} · ${res.authority.reason}`} tone={res.authority.state === "allowed" ? "ok" : "bad"} />
              <Kv k="approval" v={res.approval.ok ? "valid explicit" : res.approval.reason} tone={res.approval.ok ? "ok" : "bad"} />
              <Kv k="mismatch axes" v={res.authority.proof.mismatch_axes.join(", ") || "none"} />
              <Kv k="as of" v={`t${res.as_of} · evaluated ${res.evaluated_at_utc.slice(11, 19)}Z`} />
              <Kv k="proof sha256" v={`${res.authority.proof_digest.slice(0, 20)}…`} />
              {!ok && <p className="text-xs text-muted-foreground">A blocked commercial path may still leave an eligible sandbox or pilot action.</p>}
              <button className={btn} onClick={() => setAudit(true)}>Open audit details</button>
              <TraceJson value={{ scene: "scope", controls: ctl, readiness: res.readiness, action: res.action.action, request_version: res.request_version, permission_version: res.permission_version, proof_digest: res.authority.proof_digest }} />
            </>
          ) : <p className="text-sm">Evaluating…</p>}
        </Col>
      </div>
      <Sheet open={audit} onOpenChange={setAudit}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>Audit details · Scene 1</SheetTitle><SheetDescription>Source spans, six-axis comparison, clocks, versions and reason codes.</SheetDescription></SheetHeader>
          {res && (
            <div className="mt-4 space-y-4 text-sm">
              <div><h3 className="mb-1 text-xs font-semibold">Source spans (candidate)</h3>
                {res.candidates.map((c, i) => <p key={i} className="font-mono text-xs">{c.source_id}@{c.source_version} [{c.span.start}:{c.span.end}] {c.polarity} — “{c.text}”</p>)}
              </div>
              <div><h3 className="mb-1 text-xs font-semibold">Six-axis comparison</h3><AxisTable request={res.request.key as never} grant={res.permission.record.key as never} /></div>
              <div><h3 className="mb-1 text-xs font-semibold">Clocks</h3><Kv k="virtual" v={`t${res.as_of}`} /><Kv k="UTC" v={res.evaluated_at_utc} /></div>
              <div><h3 className="mb-1 text-xs font-semibold">Versions</h3>
                <Kv k="original permission version" v={prev?.permission_version ?? res.permission_version} /><Kv k="current permission version" v={res.permission_version} />
                <Kv k="original request version" v={prev?.request_version ?? res.request_version} /><Kv k="current request version" v={res.request_version} />
              </div>
              <div><h3 className="mb-1 text-xs font-semibold">Reason codes</h3><Kv k="authority" v={res.authority.reason} /><Kv k="approval" v={res.approval.reason ?? "ok"} /><Kv k="readiness" v={res.readiness} /></div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/* ---------------- Scene 2 · Revocation ---------------- */
const CASE = "CF-02A";
type Ev = Awaited<ReturnType<typeof evaluateCaseFn>>;
type Tl = Awaited<ReturnType<typeof sessionTimelineFn>>;

function RevocationScene({ sessionId, onReset }: { sessionId: string; onReset: () => void }) {
  const evaluateFn = useServerFn(evaluateCaseFn);
  const prepareFn = useServerFn(prepareActionFn);
  const revokeFn = useServerFn(insertRevocationFn);
  const dispatchFn = useServerFn(dispatchActionFn);
  const timelineFn = useServerFn(sessionTimelineFn);
  const [tickNow, setTickNow] = useState(100);
  const [ev, setEv] = useState<Ev | null>(null);
  const [tl, setTl] = useState<Tl | null>(null);
  const [intent, setIntent] = useState<{ id: string; version: number; key: string } | null>(null);
  const [prepNote, setPrepNote] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<{ version: number } | null>(null);
  const [disp, setDisp] = useState<{ status: string; reason: string; effects: number } | null>(null);
  const [inflight, setInflight] = useState<string | null>(null);
  const [stale, setStale] = useState(true);
  const [err, setErr] = useState<{ what: string; e: unknown; retry: () => void } | null>(null);
  const [audit, setAudit] = useState(false);
  const guard = useRef(createRequestGuard());

  const refresh = useCallback(async (at: number) => {
    const t = guard.current.next();
    const [e, l] = await Promise.all([evaluateFn({ data: { sessionId, caseId: CASE, asOf: at } }), timelineFn({ data: { sessionId, caseId: CASE } })]);
    if (!guard.current.isCurrent(t)) return;
    setEv(e); setTl(l); setStale(false);
  }, [evaluateFn, timelineFn, sessionId]);

  const step = useCallback(async (what: string, fn: () => Promise<void>) => {
    setInflight(what); setErr(null);
    try { await fn(); } catch (e) { setErr({ what, e, retry: () => void step(what, fn) }); }
    finally { setInflight(null); }
  }, []);

  useEffect(() => { void step("Evaluate", () => refresh(100)); }, [refresh, step]);

  const doEvaluate = () => step("Evaluate", () => refresh(tickNow));
  const doPrepare = () => step("Prepare", async () => {
    setStale(true); setTickNow(100);
    const p = await prepareFn({ data: { sessionId, caseId: CASE } });
    if (p.prepared) { setIntent({ id: p.intent_id, version: p.registry_version, key: `ui-${p.intent_id}` }); setPrepNote(null); }
    else setPrepNote(`not prepared · ${p.reason}`);
    await refresh(100);
  });
  const doRevoke = () => step("Revoke approval", async () => {
    setStale(true); setTickNow(105);
    const r = await revokeFn({ data: { sessionId, caseId: CASE, at: 105 } });
    setRevoked({ version: r.version });
    await refresh(105);
  });
  const doDispatch = () => step("Dispatch simulation", async () => {
    if (!intent) return;
    setStale(true); setTickNow(110);
    // Retries reuse the same idempotency key bound to the intent.
    const d = await dispatchFn({ data: { sessionId, caseId: CASE, intentId: intent.id, idempotencyKey: intent.key } });
    setDisp({ status: d.status, reason: d.reason, effects: d.effects });
    await refresh(110);
  });

  const grant = useMemo(() => ev?.trusted_records.filter((r) => r.effect === "grant").at(-1) ?? null, [ev]);
  const ok = ev?.readiness === "ready_to_launch";
  const busy = inflight !== null;

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr_1.1fr]">
        <Col title="Buyer message · unchanged">
          <blockquote className="whitespace-pre-wrap rounded border border-border bg-background p-3 text-sm text-foreground">{ev?.message.text ?? "…"}</blockquote>
          <p className="text-xs text-muted-foreground">Same text before and after revoke. Candidate only.</p>
          <h3 className="pt-2 text-xs font-semibold text-foreground">Trusted simulator registry · this session</h3>
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground"><tr><th className="py-1">Effect</th><th>Rev</th><th>Visible</th><th>Origin</th></tr></thead>
            <tbody className="font-mono">
              {ev?.trusted_records.map((r) => (
                <tr key={r.evidence_id} className="border-t border-border"><td className={`py-1 ${r.effect === "grant" ? "text-allowed" : "text-denied"}`}>{r.effect}</td><td>{r.revision}</td><td>t{r.visible_from}{r.visible ? "" : " (future)"}</td><td className="text-muted-foreground">{r.provenance === "interactive_mutation" ? "interactive" : "fixture"}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground">{ev?.trusted_source_disclosure}</p>
        </Col>

        <Col title="Target action & clock">
          {ev && (
            <div className="rounded border border-border p-2">
              <Kv k="proposal" v={`${usd(ev.case.amount_minor)} · ${ev.case.target_key.action}`} />
              <Kv k="terms" v={ev.case.target_key.terms_digest} />
              <Kv k="entity" v={ev.case.target_key.organization} />
              <Kv k="approver" v={`${ev.case.target_key.actor} · ${ev.case.target_key.capability}`} />
              <Kv k="registry revision" v={`v${ev.registry_version}`} />
            </div>
          )}
          <ol aria-label="Virtual clock" className="flex items-center justify-between gap-2 font-mono text-xs">
            {[{ t: 100, l: "prepare" }, { t: 105, l: "revoke?" }, { t: 110, l: "dispatch" }].map((s) => (
              <li key={s.t} aria-current={tickNow === s.t ? "step" : undefined} className={`flex-1 rounded border px-2 py-1 text-center ${tickNow === s.t ? "border-primary text-foreground" : "border-border text-muted-foreground"}`}>t{s.t}<br />{s.l}</li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy} onClick={doEvaluate}>{inflight === "Evaluate" ? "Evaluating…" : "Evaluate"}</button>
            <button className={btn} disabled={busy || !ev || !!intent} onClick={doPrepare}>{inflight === "Prepare" ? "Preparing…" : "Prepare (t100)"}</button>
            <button className={`${btn} border-denied/50 text-denied`} disabled={busy || !intent || !!revoked || !!disp} onClick={doRevoke}>{inflight === "Revoke approval" ? "Revoking…" : "Revoke approval (t105)"}</button>
            <button className={btnPrimary} disabled={busy || stale || !intent || !!disp} onClick={doDispatch}>{inflight === "Dispatch simulation" ? "Dispatching…" : "Dispatch simulation (t110)"}</button>
            <button className={btn} disabled={busy} onClick={onReset}>Reset scenario</button>
          </div>
          {stale && intent && !disp && <p className="text-xs text-pending">State refreshing — dispatch is disabled until the server state is reconciled.</p>}
          {prepNote && <p className="font-mono text-xs text-denied">{prepNote}</p>}
          {err && <ErrorLine what={err.what} error={err.e} onRetry={err.retry} />}
        </Col>

        <Col title="Computed decision & timeline">
          {ev ? (
            <>
              <div aria-live="polite">
                {disp ? <DecisionBadge ok={disp.status === "committed"} label={`dispatch ${disp.status} · ${disp.reason}`} /> : <DecisionBadge ok={ok} label={`${ev.readiness} at t${ev.as_of}`} />}
              </div>
              <Kv k="next action" v={ev.selected_action.action} tone={ok ? "ok" : "warn"} />
              <Kv k="original revision (at prepare)" v={intent ? `v${intent.version}` : "—"} />
              <Kv k="current revision" v={`v${ev.registry_version}`} tone={intent && ev.registry_version !== intent.version ? "warn" : undefined} />
              <Kv k="simulated effects" v={String(tl?.effects ?? 0)} tone={(tl?.effects ?? 0) > 0 ? "ok" : undefined} />
              <h3 className="pt-1 text-xs font-semibold text-foreground">Event timeline</h3>
              <ol className="space-y-1 text-xs">
                {tl?.items.map((i, n) => (
                  <li key={n} className="flex gap-2 border-l-2 border-border pl-2">
                    <span className="w-10 shrink-0 font-mono text-muted-foreground">{i.tick === null ? "msg" : `t${i.tick}`}</span>
                    <span><span className="text-foreground">{i.label}</span> <span className="text-muted-foreground">· {i.origin}</span></span>
                  </li>
                ))}
              </ol>
              <button className={btn} onClick={() => setAudit(true)}>Open audit details</button>
              <TraceJson value={{ scene: "revocation", session_id: sessionId, case_id: CASE, intent, revoked, dispatch: disp, readiness: ev.readiness, registry_version: ev.registry_version, effects: tl?.effects ?? 0, timeline: tl?.items }} />
            </>
          ) : <p className="text-sm">Loading clean session…</p>}
        </Col>
      </div>
      <Sheet open={audit} onOpenChange={setAudit}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>Audit details · Scene 2</SheetTitle><SheetDescription>Source spans, six-axis comparison, clocks, versions and reason codes.</SheetDescription></SheetHeader>
          {ev && (
            <div className="mt-4 space-y-4 text-sm">
              <div><h3 className="mb-1 text-xs font-semibold">Source spans (candidate)</h3>
                {ev.candidates.map((c, i) => <p key={i} className="font-mono text-xs">{c.source_id}@{c.source_version} [{c.span.start}:{c.span.end}] {c.polarity} — “{c.slice}”</p>)}
              </div>
              <div><h3 className="mb-1 text-xs font-semibold">Six-axis comparison</h3><AxisTable request={ev.case.target_key as never} grant={(grant?.key ?? null) as never} /></div>
              <div><h3 className="mb-1 text-xs font-semibold">Clocks</h3><Kv k="virtual" v={`t${ev.as_of}`} /><Kv k="UTC (latest event)" v={tl?.items.at(-1)?.utc ?? "—"} /></div>
              <div><h3 className="mb-1 text-xs font-semibold">Versions</h3><Kv k="original (prepare)" v={intent ? `v${intent.version}` : "—"} /><Kv k="current" v={`v${ev.registry_version}`} /></div>
              <div><h3 className="mb-1 text-xs font-semibold">Reason codes</h3><Kv k="authority" v={ev.authority.reason} /><Kv k="approval" v={ev.approval.ok ? "ok" : ev.approval.reason} /><Kv k="readiness" v={ev.readiness} />{disp && <Kv k="dispatch" v={`${disp.status} · ${disp.reason}`} />}</div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
