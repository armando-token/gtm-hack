/**
 * Trusted fixture service — server only. Durable state in Lovable Cloud.
 * Each (sandbox session, case) is its own aggregate scope; the aggregate row is the lock
 * for every registry mutation and every effect commit (see gtm_commit_dispatch).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkApproval, readinessReason, resolveAuthority } from "@/domain/authority";
import { digestOf } from "@/domain/canonical";
import { CONTRACT_VERSION, PublicCaseSchema, assertNoTruthFields, keyEquals, tick, type Approval, type AuthorityRecord, type PublicCase } from "@/domain/contracts";
import { authorityRecordEvent, dedupeByDependence, extractCandidates, visibleTick, type DirectoryRow } from "@/domain/evidence";
import { proposalDigest, revalidateForDispatch, type FrozenIntent, type ProposalSnapshot } from "@/domain/execution";
import { issuePermission, verifyPermission } from "@/domain/permission";
import { selectAction } from "@/domain/policy";
import rawCases from "./fixtures/public-cases.json";

import { REGISTERED_SOURCES, branchOf, candidatesOf, decideD } from "@/domain/decide";
import { fullRunReport } from "@/evaluation/full-run";
export { REGISTERED_SOURCES };
export const TRUSTED_SOURCE_DISCLOSURE = "Simulated fixture registry (sandbox). Not a verified real custodian.";
export const DEMO_CASE_IDS = ["CF-01A", "CF-01B", "CF-02A", "CF-02B"] as const;

const CASES = new Map<string, PublicCase>((rawCases as unknown[]).map((c) => { assertNoTruthFields(c); const p = PublicCaseSchema.parse(c); return [p.case_id, p]; }));

function secret(): string {
  const s = process.env["GTM_SEAL_SECRET"];
  if (!s) throw new Error("GTM_SEAL_SECRET is not configured");
  return s;
}
const SESSION_RE = /^[a-zA-Z0-9-]{8,64}$/;
function scope(sessionId: string, caseId: string) {
  if (!SESSION_RE.test(sessionId)) throw new Error("Invalid session id");
  getCase(caseId);
  return `${sessionId}:${caseId}`;
}
export function getCase(caseId: string): PublicCase {
  const c = CASES.get(caseId);
  if (!c) throw new Error(`Unknown case ${caseId}`);
  return c;
}
function proposalOf(c: PublicCase): ProposalSnapshot {
  return { proposal_id: `${c.case_id}-proposal`, key: c.target_key, amount_cents: c.amount_cents, currency: "USD" };
}
function db() {
  return supabaseAdmin;
}

/* ---------------- registry access ---------------- */
async function appendEvent(sc: string, tenant: string, r: AuthorityRecord, origin: "fixture" | "interactive") {
  const ev = authorityRecordEvent(tenant, r);
  const { data, error } = await db().rpc("gtm_append_event", {
    p_session: sc, p_tenant: tenant, p_org: ev.organization, p_source: ev.source, p_stream: ev.stream,
    p_revision: ev.revision, p_occurred: ev.occurred_time, p_known: ev.known_time, p_payload: r as never,
    p_hash: await digestOf(r), p_origin: origin,
  });
  if (error) throw new Error(`append failed: ${error.message}`);
  return data as { status: string; version: number };
}

async function trustedIntake(sc: string, c: PublicCase) {
  for (const r of c.service_records) await appendEvent(sc, c.tenant_id, r as AuthorityRecord, "fixture");
}

async function readRegistry(sc: string, tenant: string) {
  const [{ data: agg, error: e1 }, { data: evs, error: e2 }] = await Promise.all([
    db().from("gtm_aggregates").select("version").eq("session_id", sc).eq("tenant", tenant).maybeSingle(),
    db().from("gtm_events").select("payload, origin, registry_version").eq("session_id", sc).eq("tenant", tenant).order("registry_version"),
  ]);
  if (e1 || e2) throw new Error(`registry read failed: ${(e1 ?? e2)!.message}`);
  return {
    version: Number(agg?.version ?? 0),
    records: (evs ?? []).map((e) => e.payload as unknown as AuthorityRecord),
    origins: new Map((evs ?? []).map((e) => [(e.payload as unknown as AuthorityRecord).evidence_id, e.origin])),
  };
}

export function listDemoCases() {
  return DEMO_CASE_IDS.map((id) => {
    const c = getCase(id);
    return { case_id: c.case_id, title: c.title, decision_time: c.decision_time, dispatch_time: c.dispatch_time };
  });
}

/* ---------------- evaluate ---------------- */
export async function evaluateCase(input: { sessionId: string; caseId: string; asOf?: number | undefined }) {
  const c = getCase(input.caseId);
  const sc = scope(input.sessionId, c.case_id);
  await trustedIntake(sc, c);
  const reg = await readRegistry(sc, c.tenant_id);
  const asOf = tick(input.asOf ?? c.decision_time);
  const key = c.target_key;
  const current = await resolveAuthority({ records: reg.records, key, asOf, registeredSources: REGISTERED_SOURCES });
  const approval = await checkApproval({ approval: c.service_approval as Approval | null, key, asOf, records: reg.records, registeredSources: REGISTERED_SOURCES });
  const candidates = candidatesOf(c);
  let readiness = readinessReason(current, approval);
  if (readiness === "ready_to_launch" && candidates.some((x) => x.identity.status === "ambiguous")) readiness = "ambiguous_actor_identity";
  const action = selectAction(c.catalogue, readiness);
  // Alternative permission still available (e.g. 500-seat pilot) — explained, never expands the target.
  const alternatives = [];
  if (current.proof.mismatch_axes.length) {
    for (const r of reg.records.filter((x) => (REGISTERED_SOURCES as readonly string[]).includes(x.source))) {
      const alt = await resolveAuthority({ records: reg.records, key: r.key, asOf, registeredSources: REGISTERED_SOURCES });
      if (alt.state === "allowed") alternatives.push({ key: r.key, state: alt.state });
    }
  }
  const permission_ref = current.state === "allowed"
    ? await issuePermission(current, { session: sc, tenant: c.tenant_id, registry_version: reg.version }, secret())
    : null;
  return {
    contract_version: CONTRACT_VERSION,
    session_id: input.sessionId,
    registry_version: reg.version,
    trusted_source_disclosure: TRUSTED_SOURCE_DISCLOSURE,
    case: {
      case_id: c.case_id, title: c.title, tenant_id: c.tenant_id, organization_id: c.organization_id,
      decision_time: c.decision_time, dispatch_time: c.dispatch_time, amount_minor: c.amount_cents, currency: "USD" as const,
      target_key: key, catalogue: c.catalogue,
    },
    as_of: asOf as number,
    authority: { state: current.state, reason: current.reason, proof: current.proof, proof_digest: current.proof_digest, log: current.log },
    approval: { ok: approval.ok, reason: approval.reason },
    readiness,
    selected_action: action,
    alternatives,
    permission_ref,
    candidates,
    message: { text: String(c.communication_records[0]?.["text"] ?? ""), first_known_at: String(c.communication_records[0]?.["first_known_at"] ?? "") },
    trusted_records: reg.records.map((r) => ({
      evidence_id: r.evidence_id, source: r.source, revision: r.revision, effect: r.effect, key: r.key,
      visible_from: visibleTick(r), valid_until: r.valid_until as number, visible: visibleTick(r) <= asOf,
      provenance: reg.origins.get(r.evidence_id) === "interactive" ? "interactive_mutation" : "trusted_fixture_registry",
    })),
  };
}

export async function checkPermission(input: { sessionId: string; caseId: string; asOf: number; ref: string }) {
  const c = getCase(input.caseId);
  return verifyPermission(input.ref, { session: scope(input.sessionId, c.case_id), tenant: c.tenant_id, key: c.target_key, as_of: tick(input.asOf) }, secret());
}

/* ---------------- prepare ---------------- */
export async function prepareAction(input: { sessionId: string; caseId: string }) {
  const c = getCase(input.caseId);
  const sc = scope(input.sessionId, c.case_id);
  const ev = await evaluateCase({ sessionId: input.sessionId, caseId: c.case_id, asOf: c.decision_time });
  if (ev.readiness !== "ready_to_launch" || !ev.selected_action.consequential || !ev.permission_ref) {
    return { prepared: false as const, reason: ev.readiness, selected_action: ev.selected_action.action };
  }
  const v = await verifyPermission(ev.permission_ref, { session: sc, tenant: c.tenant_id, key: c.target_key, as_of: tick(c.decision_time), proof_digest: ev.authority.proof_digest }, secret());
  if (!v.ok) return { prepared: false as const, reason: v.reason, selected_action: ev.selected_action.action };
  const proposal = proposalOf(c);
  const { data, error } = await db().from("gtm_intents").insert({
    session_id: sc, tenant: c.tenant_id, case_id: c.case_id, key: proposal.key as never, proposal_id: proposal.proposal_id,
    amount_cents: proposal.amount_cents, currency: proposal.currency, proposal_digest: await proposalDigest(proposal),
    decision_time: c.decision_time, approval: c.service_approval as never, permission_ref: ev.permission_ref,
    proof_digest: ev.authority.proof_digest, registry_version: ev.registry_version, status: "prepared",
  }).select("id, status, registry_version").single();
  if (error) throw new Error(`prepare failed: ${error.message}`);
  return { prepared: true as const, intent_id: data.id, status: data.status, registry_version: Number(data.registry_version), selected_action: ev.selected_action.action };
}

/* ---------------- interactive mutation ---------------- */
export async function insertRevocation(input: { sessionId: string; caseId: string; at?: number | undefined }) {
  const c = getCase(input.caseId);
  const sc = scope(input.sessionId, c.case_id);
  const reg = await readRegistry(sc, c.tenant_id);
  const base = reg.records.filter((r) => r.effect === "grant" && keyEquals(r.key, c.target_key)).sort((a, b) => b.revision - a.revision)[0];
  if (!base) throw new Error("No grant to revoke in this session");
  const at = tick(input.at ?? 105);
  const revoke: AuthorityRecord = { ...base, evidence_id: `ev-interactive-revoke-${c.case_id.toLowerCase()}-t${at}`, revision: base.revision + 1, event_time: at, known_time: at, valid_from: at, effect: "revoke" };
  return appendEvent(sc, c.tenant_id, revoke, "interactive");
}

/* ---------------- dispatch ---------------- */
export type Inject = "none" | "fail_before_commit" | "crash_after_commit" | "stale_version";
export async function dispatchAction(input: {
  sessionId: string; caseId: string; intentId: string; idempotencyKey: string;
  expectedVersion?: number | undefined; inject?: Inject | undefined;
  proposalChange?: Partial<Pick<ProposalSnapshot, "amount_cents" | "currency">> & { terms_digest?: string | undefined; organization?: string | undefined } | undefined;
}) {
  const c = getCase(input.caseId);
  const sc = scope(input.sessionId, c.case_id);
  const { data: row, error } = await db().from("gtm_intents").select("*").eq("id", input.intentId).eq("session_id", sc).eq("tenant", c.tenant_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return { status: "blocked" as const, reason: "intent_not_found", effect_id: null, effects: 0 };
  const intent: FrozenIntent = {
    proposal: { proposal_id: row.proposal_id, key: row.key as never, amount_cents: Number(row.amount_cents), currency: row.currency as never },
    proposal_digest: row.proposal_digest, decision_time: row.decision_time, approval: row.approval as never,
    permission_ref: row.permission_ref, proof_digest: row.proof_digest, registry_version: Number(row.registry_version),
  };
  // Server-owned current proposal (canonical dispatch_mutation applies; test hook may alter it to prove blocking).
  const base = proposalOf(c);
  const mut = c.dispatch_mutation as { new_terms_digest?: string; new_amount_cents?: number } | null;
  const ch = input.proposalChange ?? {};
  const current: ProposalSnapshot = {
    ...base,
    amount_cents: ch.amount_cents ?? mut?.new_amount_cents ?? base.amount_cents,
    currency: ch.currency ?? base.currency,
    key: { ...base.key, terms_digest: ch.terms_digest ?? mut?.new_terms_digest ?? base.key.terms_digest, organization: ch.organization ?? base.key.organization },
  };
  const dispatchTime = tick(c.dispatch_time);
  const requestHash = await digestOf({ intent: input.intentId, dispatch_time: c.dispatch_time, proposal: current });

  for (let attempt = 0; attempt < 4; attempt++) {
    const reg = await readRegistry(sc, c.tenant_id);
    const v = await revalidateForDispatch({ intent, current, records: reg.records, registeredSources: REGISTERED_SOURCES, dispatchTime });
    const expected = input.inject === "stale_version" && attempt === 0 ? reg.version - 1 : input.expectedVersion !== undefined && attempt === 0 ? input.expectedVersion : reg.version;
    const { data, error: e } = await db().rpc("gtm_commit_dispatch", {
      p_session: sc, p_tenant: c.tenant_id, p_intent: input.intentId, p_idem: input.idempotencyKey, p_request_hash: requestHash,
      p_expected_version: expected, p_dispatch_time: c.dispatch_time, p_status: v.ok ? "committed" : "blocked", p_reason: v.reason,
      p_effect_key: `${sc}|${input.intentId}`, p_effect: { proposal: current, dispatch_time: c.dispatch_time, simulated: true } as never,
      p_fail_before_commit: input.inject === "fail_before_commit",
    });
    if (e) return { status: "failed" as const, reason: e.message.includes("injected_failure_before_commit") ? "rolled_back_before_commit" : e.message, effect_id: null, effects: await countEffects(sc) };
    const out = data as { outcome: string; status?: string; reason?: string; effect_id?: string | null; version?: number };
    if (out.outcome === "stale_version") {
      if (input.inject === "stale_version" || input.expectedVersion !== undefined) {
        if (input.inject !== "stale_version") return { status: "blocked" as const, reason: "stale_version", effect_id: null, effects: await countEffects(sc) };
      }
      continue; // re-read registry and revalidate under the new version
    }
    if (out.outcome === "idempotency_conflict") return { status: "blocked" as const, reason: "idempotency_conflict", effect_id: null, effects: await countEffects(sc) };
    if (input.inject === "crash_after_commit" && out.outcome === "written") throw new Error("injected_crash_after_commit");
    return {
      status: (out.status ?? (out.outcome === "already_committed" ? "committed" : "blocked")) as "committed" | "blocked",
      reason: out.reason ?? out.outcome, effect_id: out.effect_id ?? null, replayed: out.outcome === "replayed",
      changed_after_event: v.changed_after_event, effects: await countEffects(sc),
    };
  }
  return { status: "blocked" as const, reason: "revalidation_retries_exhausted", effect_id: null, effects: await countEffects(sc) };
}

export async function countEffects(sc: string) {
  const { count, error } = await db().from("gtm_effects").select("id", { count: "exact", head: true }).eq("session_id", sc);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
export async function sessionEffects(sessionId: string, caseId: string) {
  return countEffects(scope(sessionId, caseId));
}

/* ---------------- canonical batch replay (C06 trace) ---------------- */
export async function batchReplay(input: { sessionId: string }) {
  const trace = [];
  for (const id of DEMO_CASE_IDS) {
    const c = getCase(id);
    const atDecision = await evaluateCase({ sessionId: input.sessionId, caseId: id, asOf: c.decision_time });
    const prep = await prepareAction({ sessionId: input.sessionId, caseId: id });
    let dispatch = null;
    if (prep.prepared) dispatch = await dispatchAction({ sessionId: input.sessionId, caseId: id, intentId: prep.intent_id, idempotencyKey: `batch-${id}` });
    const atDispatch = await resolveAuthority({ records: c.service_records as AuthorityRecord[], key: c.target_key, asOf: tick(c.dispatch_time), registeredSources: REGISTERED_SOURCES });
    const blocked = dispatch && dispatch.status !== "committed";
    trace.push({
      case_id: id, decision_time: c.decision_time, dispatch_time: c.dispatch_time,
      decision: { state: atDecision.authority.state, reason: atDecision.readiness, proof_digest: atDecision.authority.proof_digest },
      selected_action: blocked ? selectAction(c.catalogue, dispatch!.reason as never).action : atDecision.selected_action.action,
      prepared: prep.prepared,
      dispatch: dispatch ? { status: dispatch.status, reason: dispatch.reason } : null,
      authority_at_dispatch: { state: atDispatch.state, reason: atDispatch.reason },
      changed_after_event: Boolean(dispatch && "changed_after_event" in dispatch && dispatch.changed_after_event),
      alternatives: atDecision.alternatives.map((a) => a.key.terms_digest),
      effects: await sessionEffects(input.sessionId, id),
    });
  }
  return { contract_version: CONTRACT_VERSION, session_id: input.sessionId, origin: "current_run" as const, trace };
}

export function backendInfo() {
  return { contract_version: CONTRACT_VERSION, runtime: "tanstack-start-server-function", persistence: "lovable-cloud-postgres" as const, checked_at: new Date().toISOString() };
}

/* ---------------- phase 04: Scene 1 scope scenario (pure engine, server-side) ---------------- */
import { evaluateScope, type ScopeControls } from "@/domain/scenario";
import { baselineC, proxyB, BASELINE_LIMITATIONS } from "@/domain/baselines";
import { scoreRows, type ObservedRow } from "@/evaluation/four-case";

export async function evaluateScopeScenario(controls: ScopeControls) {
  const base = getCase("CF-01A");
  const r = await evaluateScope(base, controls, REGISTERED_SOURCES);
  const message = base.communication_records[0]!;
  return {
    scene: "scope" as const, base_case: base.case_id, message: { text: String(message["text"]), speaker: String(message["speaker"]), first_known_at: String(message["first_known_at"]) },
    candidates: candidatesOf(base).map((c) => ({ text: c.slice, span: c.span, source_id: c.source_id, source_version: c.source_version, polarity: c.polarity, grants_authority: false as const })),
    request: r.request, permission: r.permission, as_of: r.as_of,
    authority: { state: r.authority.state, reason: r.authority.reason, proof: r.authority.proof, proof_digest: r.authority.proof_digest },
    approval: r.approval, readiness: r.readiness, action: r.action,
    request_version: r.request_version, permission_version: r.permission_version,
    trusted_source_disclosure: TRUSTED_SOURCE_DISCLOSURE,
    evaluated_at_utc: new Date().toISOString(),
  };
}

export async function fourCaseRun() {
  const rows: (ObservedRow & { reason: string })[] = [];
  for (const id of DEMO_CASE_IDS) {
    const c = getCase(id);
    const d = await decideD(c);
    rows.push({ case_id: id, arm: "D", action: d.action, branch: d.branch, reason: d.reason });
    const cAct = baselineC(c, candidatesOf(c));
    rows.push({ case_id: id, arm: "C", action: cAct, branch: branchOf(cAct === c.catalogue[0] ? "ready_to_launch" : "hold", cAct, false), reason: "surface_polarity" });
    const bAct = proxyB(c);
    rows.push({ case_id: id, arm: "B", action: bAct, branch: branchOf(bAct === c.catalogue[0] ? "ready_to_launch" : "hold", bAct, false), reason: "crm_proxy_fields" });
  }
  const scored = scoreRows(rows);
  const executed_at = new Date().toISOString();
  const run_id = `run-4c-${(await digestOf({ rows, executed_at })).slice(0, 10)}`;
  return {
    run_id, origin: "current_run" as const, contract_version: CONTRACT_VERSION, executed_at, denominator: DEMO_CASE_IDS.length,
    case_ids: [...DEMO_CASE_IDS], baseline_limitations: [...BASELINE_LIMITATIONS],
    rows: scored.rows.map((r, i) => ({ ...r, reason: rows[i]!.reason })), arms: scored.arms,
  };
}

/** Current-session timeline for one case scope: registry events, prepared intents, dispatch attempts. */
export async function sessionTimeline(input: { sessionId: string; caseId: string }) {
  const c = getCase(input.caseId);
  const sc = scope(input.sessionId, c.case_id);
  const [ev, it, dp] = await Promise.all([
    db().from("gtm_events").select("registry_version, origin, payload, known_time, occurred_time, created_at").eq("session_id", sc).eq("tenant", c.tenant_id).order("registry_version"),
    db().from("gtm_intents").select("id, decision_time, registry_version, status, created_at").eq("session_id", sc).eq("tenant", c.tenant_id).order("created_at"),
    db().from("gtm_dispatches").select("intent_id, dispatch_time, status, reason, observed_version, idempotency_key, created_at").eq("session_id", sc).eq("tenant", c.tenant_id).order("created_at"),
  ]);
  const err = ev.error ?? it.error ?? dp.error;
  if (err) throw new Error(`timeline read failed: ${err.message}`);
  const msg = c.communication_records[0]!;
  const items = [
    { kind: "message", tick: null as number | null, utc: String(msg["first_known_at"]), label: "Buyer message received (candidate only)", detail: "unchanged text", origin: "communication" },
    ...(ev.data ?? []).map((e) => { const p = e.payload as unknown as AuthorityRecord; return { kind: p.effect, tick: Number(e.known_time), utc: e.created_at, label: `${p.effect} · rev ${p.revision} · registry v${e.registry_version}`, detail: p.key.terms_digest, origin: e.origin === "interactive" ? "trusted simulator (interactive)" : "trusted simulator fixture" }; }),
    ...(it.data ?? []).map((i) => ({ kind: "prepare", tick: Number(i.decision_time), utc: i.created_at, label: `Proposal prepared · registry v${i.registry_version}`, detail: `intent ${i.id.slice(0, 8)}`, origin: "server" })),
    ...(dp.data ?? []).map((d) => ({ kind: "dispatch", tick: Number(d.dispatch_time), utc: d.created_at, label: `Dispatch ${d.status} · ${d.reason}`, detail: `observed v${d.observed_version} · key ${d.idempotency_key}`, origin: "server transaction" })),
  ].sort((a, b) => (a.tick ?? -1) - (b.tick ?? -1) || a.utc.localeCompare(b.utc));
  return { session_id: input.sessionId, case_id: c.case_id, items, effects: await countEffects(sc) };
}

/** Phase 05: canonical 24-case run (D/C/B) scored against evaluator gold. */
export async function fullRun() {
  return fullRunReport([...CASES.values()], `${CONTRACT_VERSION}+tanstack-start-worker`);
}
export async function metamorphicRun() {
  const { runMetamorphic } = await import("@/evaluation/metamorphic");
  const r = await runMetamorphic([...CASES.values()]);
  return { total: r.checks.length, passed: r.checks.length - r.failed.length, failed: r.failed, by_check: Object.entries(r.checks.reduce<Record<string, [number, number]>>((m, x) => { const v = m[x.check] ?? [0, 0]; v[1]++; if (x.ok) v[0]++; m[x.check] = v; return m; }, {})).map(([check, [ok, n]]) => ({ check, ok, n })) };
}
