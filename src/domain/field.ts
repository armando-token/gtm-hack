/**
 * MVE v2 field readiness. Keeps distinct: trusted source coverage, positive permission, request sent,
 * reply received, verification before cutoff. Pure; thresholds come from a frozen versioned config.
 */
import type { ModuleStatus } from "./contracts";
export const FIELD_STATUS: ModuleStatus = "PARTIAL";

export const FIELD_GATE_CONFIG = Object.freeze({
  version: "field-gate-1.0.0",
  target_n: 20, retrospective_n: 12, prospective_n: 8,
  coverage_min_pct: 65, restricted_subsegment_min_pct: 80, timely_min_pct: 60,
  median_human_minutes_max: 10, single_request_min_pct: 75,
  severe_improper_max: 0, reviewer_disagreement_max: 0, cost_share_max_pct: 25,
  restricted_subsegment_channels: Object.freeze(["security_questionnaire_portal", "buyer_email_authenticated_dkim", "shared_workspace_action_log"]),
  unstructured_channels: Object.freeze(["call_transcript_unverified"]),
});

/** Minimal shape of an MVE v2 opportunity record (field names follow the original schema). */
export interface FieldRecord {
  opportunity_id: string;
  decision_at: { as_of_epoch: number; next_milestone_epoch: number; business_deadline_epoch: number };
  source_type: { channel_category: string; is_trusted_source: boolean };
  provenance_tier: { trusted_authority_record?: { known_time: number; valid_from: number } | null };
  observed_at: { visible_at_decision: boolean; validation_time: number | null };
  authority_state: string; adjudication_reason: string;
  extra_requests: { count: number; buyer_intervention_required: boolean; sent_at: number | null; responded_at: number | null; verified_at: number | null; response_status: string };
  timing_breakdown: { search_minutes: number; contact_minutes: number; review_minutes: number; wait_minutes: number; next_milestone_epoch: number; business_deadline_epoch: number };
  dataset_origin?: string;
}

export type Timeliness = "in_time_verified" | "expired_or_late" | "still_in_followup" | "unverified_at_cutoff";
export type Bucket = "direct_valid" | "confirmed_valid_at_cutoff" | "open_request_pending" | "insufficient_permission_scope" | "revoked_or_denied" | "late_response_after_cutoff" | "missing_evidence";

/** Confirmation counts only when verification precedes the cutoff (F03). */
export function confirmedAt(r: Pick<FieldRecord["extra_requests"], "verified_at" | "responded_at">, cutoff: number) {
  return r.verified_at !== null && r.verified_at <= cutoff && r.responded_at !== null && r.responded_at <= r.verified_at;
}

export function evaluateRecord(r: FieldRecord) {
  const cutoff = r.decision_at.as_of_epoch;
  const deadline = Math.min(r.timing_breakdown.business_deadline_epoch, r.timing_breakdown.next_milestone_epoch);
  const trusted = r.source_type.is_trusted_source && !!r.provenance_tier.trusted_authority_record;
  const visible = trusted && r.observed_at.visible_at_decision;
  const allowed = r.authority_state === "allowed"; // current exact grant only
  const e = r.extra_requests;
  const confirmed = allowed && e.count >= 1 && confirmedAt(e, cutoff);
  const directValid = allowed && e.count === 0;
  let timeliness: Timeliness;
  if (visible && r.observed_at.validation_time !== null && r.observed_at.validation_time <= deadline && r.observed_at.validation_time <= cutoff) timeliness = "in_time_verified";
  else if (e.response_status === "responded_late_after_cutoff" || (trusted && r.provenance_tier.trusted_authority_record!.known_time > cutoff)) timeliness = "expired_or_late";
  else if (e.response_status === "pending_no_response" && e.count <= 1) timeliness = "still_in_followup";
  else timeliness = "unverified_at_cutoff";
  let bucket: Bucket;
  if (directValid) bucket = "direct_valid";
  else if (confirmed) bucket = "confirmed_valid_at_cutoff";
  else if (["revoked", "explicit_deny", "conflict"].includes(r.adjudication_reason)) bucket = "revoked_or_denied";
  else if (timeliness === "expired_or_late") bucket = "late_response_after_cutoff";
  else if (trusted) bucket = "insufficient_permission_scope";
  else if (e.response_status === "pending_no_response") bucket = "open_request_pending";
  else bucket = "missing_evidence";
  const human = r.timing_breakdown.search_minutes + r.timing_breakdown.contact_minutes + r.timing_breakdown.review_minutes;
  const recommendation = allowed && (directValid || confirmed) ? "proceed" : bucket === "revoked_or_denied" ? "block" : "confirm_or_alternative";
  return {
    opportunity_id: r.opportunity_id, direct_trusted: trusted, visible_verifiable: visible, authorized_at_cutoff: directValid || confirmed,
    timeliness, bucket, human_minutes: Math.round(human * 100) / 100, wait_minutes: r.timing_breakdown.wait_minutes,
    contact_required: e.buyer_intervention_required, request_count: e.count, request_sent: e.sent_at !== null,
    sent_at: e.sent_at, responded_at: e.responded_at, verified_at: e.verified_at,
    single_request_ok: e.buyer_intervention_required && confirmed && e.count <= 1,
    recommendation, severe_improper: recommendation === "proceed" && !allowed,
    channel: r.source_type.channel_category,
  };
}

const pct = (k: number, n: number) => (n ? Math.round((k / n) * 10000) / 100 : null);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
type Rate = { numerator: number; denominator: number; pct: number | null; unavailable_reason: string | null };
const rate = (k: number, n: number, why: string): Rate => ({ numerator: k, denominator: n, pct: pct(k, n), unavailable_reason: n ? null : why });

export function computeMetrics(records: readonly FieldRecord[], cfg = FIELD_GATE_CONFIG) {
  const ev = records.map(evaluateRecord);
  const n = ev.length;
  const structured = ev.filter((e) => !cfg.unstructured_channels.includes(e.channel));
  const restricted = ev.filter((e) => cfg.restricted_subsegment_channels.includes(e.channel));
  const contact = ev.filter((e) => e.contact_required);
  const buckets = Object.fromEntries(["direct_valid", "confirmed_valid_at_cutoff", "open_request_pending", "insufficient_permission_scope", "revoked_or_denied", "late_response_after_cutoff", "missing_evidence"].map((b) => [b, ev.filter((e) => e.bucket === b).length]));
  const timeliness = Object.fromEntries(["in_time_verified", "expired_or_late", "still_in_followup", "unverified_at_cutoff"].map((t) => [t, ev.filter((e) => e.timeliness === t).length]));
  return {
    eligible_n: n,
    direct_trusted_coverage: rate(ev.filter((e) => e.direct_trusted).length, n, "no eligible opportunities"),
    visible_verifiable_coverage: rate(ev.filter((e) => e.visible_verifiable).length, n, "no eligible opportunities"),
    authorized_at_cutoff: rate(ev.filter((e) => e.authorized_at_cutoff).length, n, "no eligible opportunities"),
    timely_verified: rate(ev.filter((e) => e.timeliness === "in_time_verified").length, n, "no eligible opportunities"),
    structured_subsegment_coverage: rate(structured.filter((e) => e.direct_trusted).length, structured.length, "no structured-channel records"),
    restricted_subsegment_coverage: rate(restricted.filter((e) => e.direct_trusted).length, restricted.length, "no restricted-subsegment records"),
    single_request_resolution: rate(contact.filter((e) => e.single_request_ok).length, contact.length, "no case required buyer contact"),
    requests_sent_le_1: rate(contact.filter((e) => e.request_sent && e.request_count <= 1).length, contact.length, "no case required buyer contact"),
    median_human_minutes: median(ev.map((e) => e.human_minutes)),
    median_wait_minutes: median(ev.map((e) => e.wait_minutes)),
    severe_improper: ev.filter((e) => e.severe_improper).length,
    reviewer_disagreements: 0,
    buckets, timeliness, records: ev,
  };
}
export type FieldMetrics = ReturnType<typeof computeMetrics>;

export function gateDecision(m: FieldMetrics, ctx: { origin: "real" | "simulated"; provenance_confirmed: boolean; cohort_mature: boolean }, cfg = FIELD_GATE_CONFIG) {
  const ind = (name: string, value: number | null, threshold: string, pass: boolean | null) => ({ name, value, threshold, status: value === null || pass === null ? "open" : pass ? "pass" : "fail" });
  const cov = m.direct_trusted_coverage.pct, sub = m.restricted_subsegment_coverage.pct;
  const indicators = [
    ind("coverage (full segment ≥65% or restricted ≥80%)", cov, `≥${cfg.coverage_min_pct}% | sub ≥${cfg.restricted_subsegment_min_pct}%`, cov === null ? null : cov >= cfg.coverage_min_pct || (sub ?? 0) >= cfg.restricted_subsegment_min_pct),
    ind("timely verified coverage", m.timely_verified.pct, `≥${cfg.timely_min_pct}%`, m.timely_verified.pct === null ? null : m.timely_verified.pct >= cfg.timely_min_pct),
    ind("median human minutes", m.median_human_minutes, `≤${cfg.median_human_minutes_max}`, m.median_human_minutes === null ? null : m.median_human_minutes <= cfg.median_human_minutes_max),
    ind("valid confirmed in ≤1 request", m.single_request_resolution.pct, `≥${cfg.single_request_min_pct}%`, m.single_request_resolution.pct === null ? null : m.single_request_resolution.pct >= cfg.single_request_min_pct),
    ind("severe improper recommendations", m.eligible_n ? m.severe_improper : null, "= 0", m.eligible_n ? m.severe_improper === 0 : null),
    ind("unresolved reviewer disagreement", m.eligible_n ? m.reviewer_disagreements : null, "= 0", m.eligible_n ? m.reviewer_disagreements === 0 : null),
    ind("cost vs savings", null, `≤${cfg.cost_share_max_pct}%`, null),
  ];
  const open = indicators.filter((i) => i.status !== "pass").map((i) => i.name);
  let decision: string;
  if (ctx.origin !== "real" || !ctx.provenance_confirmed || !ctx.cohort_mature || m.eligible_n < cfg.target_n) decision = "HOLD_OBSERVATION_RESOLVE_CAUSE";
  else decision = indicators.every((i) => i.status === "pass") ? "PROCEED_TO_PILOT" : "HOLD_OBSERVATION_RESOLVE_CAUSE";
  return { config_version: cfg.version, origin: ctx.origin, decision, indicators, open_indicators: open };
}

/* ---------- real-field intake ---------- */
export interface IntakeSubmission {
  opportunity_id: string; anonymized_account_id: string; legal_entity_id: string; approval_entity_id: string;
  parent_entity_id?: string | null; cohort: "retrospective" | "prospective";
  enrolled_at: number; outcome_known_at_enrollment: boolean; event_time: number; known_time: number;
  sent_at?: number | null; responded_at?: number | null; verified_at?: number | null;
  dataset_origin: string; custodian_id: string; custodian_attestation?: string | null; evidence_ref?: string | null;
  reviewer_resolution: "resolved" | "disagreement" | null; batch_id?: string; source_reference_id?: string;
}
const SYNTHETIC_MARKERS = /simulad|synthetic|sim-|mve-sim|vault-ref-simulado|^opp-[wls]\d\d[abc]\d\d$/i;

export async function classifyIntake(s: IntakeSubmission, seen: ReadonlySet<string>, verifyCustodian: (s: IntakeSubmission) => Promise<boolean>) {
  const reasons: string[] = [];
  if (s.dataset_origin !== "real") reasons.push("declared_non_real_origin");
  if ([s.opportunity_id, s.batch_id ?? "", s.source_reference_id ?? ""].some((x) => SYNTHETIC_MARKERS.test(x))) reasons.push("known_synthetic_template_id");
  if (seen.has(s.opportunity_id)) reasons.push("duplicate_opportunity");
  if (s.known_time < s.event_time) reasons.push("chronology_known_before_event");
  if (s.sent_at != null && s.responded_at != null && s.responded_at < s.sent_at) reasons.push("chronology_reply_before_request");
  if (s.responded_at != null && s.verified_at != null && s.verified_at < s.responded_at) reasons.push("chronology_verified_before_reply");
  if (s.cohort === "prospective" && s.outcome_known_at_enrollment) reasons.push("prospective_outcome_known_at_enrollment");
  if (reasons.length) return { status: "rejected" as const, reasons, provenance: "unconfirmed" as const };
  const q: string[] = [];
  if (s.approval_entity_id !== s.legal_entity_id) q.push(s.parent_entity_id && (s.approval_entity_id === s.parent_entity_id) ? "parent_child_scope_substitution" : "entity_mismatch");
  if (!s.reviewer_resolution || s.reviewer_resolution === "disagreement") q.push("reviewer_unresolved");
  // A text origin=real or a well-shaped hash is only an assertion; require a verified attestation or server-owned reference.
  const custodianOk = await verifyCustodian(s);
  if (!custodianOk) q.push("custodian_unverifiable");
  return q.length ? { status: "quarantined" as const, reasons: q, provenance: custodianOk ? "confirmed" as const : "unconfirmed" as const } : { status: "accepted" as const, reasons: [], provenance: "confirmed" as const };
}

export function emptyRealStudy(cfg = FIELD_GATE_CONFIG) {
  return { target: cfg.target_n, observed: 0, assigned_accounts: 0, retrospective: { target: cfg.retrospective_n, observed: 0 }, prospective: { target: cfg.prospective_n, observed: 0 } };
}

export const FIELD_TEMPLATES = {
  B1: ["opportunity_id", "anonymized_account_id", "legal_entity_id", "cohort", "enrolled_at", "outcome_known_at_enrollment", "custodian_id", "evidence_ref"],
  B2: ["opportunity_id", "event_time", "known_time", "sent_at", "responded_at", "verified_at", "request_count", "search_minutes", "contact_minutes", "review_minutes", "wait_minutes"],
  B3: ["opportunity_id", "recommendation", "reviewer_a", "reviewer_b", "reviewer_resolution", "severity"],
} as const;
