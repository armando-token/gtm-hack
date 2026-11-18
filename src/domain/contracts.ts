/**
 * GTM contract types · gtm-lovable-rebuild-v1
 * Pure, portable TypeScript. No UI or server imports.
 */
import { z } from "zod";

export const CONTRACT_VERSION = "gtm-lovable-rebuild-v1" as const;

/* ---------- Clocks: virtual ticks and UTC never mix silently ---------- */
declare const tickBrand: unique symbol;
declare const utcBrand: unique symbol;
/** Integer virtual tick used by the canonical 24-case benchmark. */
export type Tick = number & { readonly [tickBrand]: "tick" };
/** Explicit UTC ISO-8601 timestamp used by field records. */
export type UtcTimestamp = string & { readonly [utcBrand]: "utc" };

export function tick(n: number): Tick {
  if (!Number.isInteger(n) || n < 0) throw new Error(`Tick must be a non-negative integer, got ${n}`);
  return n as Tick;
}
const UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
export function utc(s: string): UtcTimestamp {
  if (!UTC_RE.test(s) || Number.isNaN(Date.parse(s))) throw new Error(`Not an explicit UTC timestamp: ${s}`);
  return s as UtcTimestamp;
}

/* ---------- Money: integer minor units + explicit currency ---------- */
export type Currency = "USD" | "EUR" | "MXN" | "GBP";
export interface Money {
  readonly amount_minor: number;
  readonly currency: Currency;
}
export function money(amount_minor: number, currency: Currency): Money {
  if (!Number.isSafeInteger(amount_minor)) throw new Error(`Money must be integer minor units, got ${amount_minor}`);
  return { amount_minor, currency };
}

/* ---------- Six-axis key ---------- */
export const KEY_AXES = ["tenant", "organization", "actor", "capability", "action", "terms_digest"] as const;
export type KeyAxis = (typeof KEY_AXES)[number];
export interface Key {
  readonly tenant: string;
  readonly organization: string;
  readonly actor: string;
  readonly capability: string;
  readonly action: string;
  readonly terms_digest: string;
}
export const KeySchema = z
  .object({
    tenant: z.string().min(1),
    organization: z.string().min(1),
    actor: z.string().min(1),
    capability: z.string().min(1),
    action: z.string().min(1),
    terms_digest: z.string().min(1),
  })
  .strict();

/** Exact comparison; returns the mismatched axes in canonical order. */
export function keyMismatch(a: Key, b: Key): KeyAxis[] {
  return KEY_AXES.filter((axis) => a[axis] !== b[axis]);
}
export function keyEquals(a: Key, b: Key): boolean {
  return keyMismatch(a, b).length === 0;
}

/* ---------- Authority records ---------- */
export type AuthorityEffect = "grant" | "revoke" | "explicit_deny";
export interface AuthorityRecord {
  readonly evidence_id: string;
  readonly key: Key;
  readonly source: string;
  readonly revision: number;
  readonly event_time: Tick;
  readonly known_time: Tick;
  readonly valid_from: Tick;
  readonly valid_until: Tick;
  readonly effect: AuthorityEffect;
}
export interface Approval {
  readonly evidence_id?: string;
  readonly key: Key;
  readonly occurred_at: Tick;
  readonly known_at: Tick;
  readonly explicit: boolean;
}
export interface Proposal {
  readonly id: string;
  readonly key: Key;
  readonly money: Money;
  readonly approval_required: boolean;
}

/* ---------- Candidate evidence (never authority) ---------- */
export interface SourceSpan {
  readonly record_id: string;
  readonly start: number;
  readonly end: number;
}
export interface CandidateClaim {
  readonly evidence_namespace: "candidate";
  readonly span: SourceSpan;
  readonly speaker: string;
  readonly quoted_subject: string;
  readonly polarity: "affirm" | "deny" | "unclear";
}
export interface DirectoryEntry {
  readonly tenant: string;
  readonly organization: string;
  readonly actor_id: string;
  readonly display_name: string;
}

/* ---------- Decisions ---------- */
export type AuthorityState = "allowed" | "denied" | "unknown" | "conflict";
export const REASON_CODES = [
  "ready_to_launch", "granted", "candidate_only_no_authority", "untrusted_source",
  "scope_mismatch_tenant", "scope_mismatch_organization", "scope_mismatch_actor",
  "scope_mismatch_capability", "scope_mismatch_action", "scope_mismatch_terms_digest",
  "scope_mismatch_multiple", "not_yet_known", "not_yet_effective", "expired", "revoked",
  "explicit_deny", "conflict", "no_grant", "approval_terms_changed",
  "missing_approval", "approval_not_explicit", "approval_timeline_invalid", "ambiguous_actor_identity",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface AuthorityProof {
  readonly target_key: Key;
  readonly as_of: Tick;
  readonly registered_sources: readonly string[];
  readonly matched_record_digests: readonly string[];
  readonly latest_revisions: Readonly<Record<string, number>>;
  readonly conflicts: readonly { source: string; effects: AuthorityEffect[] }[];
  readonly mismatch_axes: readonly KeyAxis[];
}

/**
 * Opaque permission reference. The brand symbol is not exported, so only the
 * trusted server issuer (which casts after resolving) can produce one.
 */
declare const permissionBrand: unique symbol;
export type PermissionRef = string & { readonly [permissionBrand]: "server-issued" };

interface DecisionBase {
  readonly key: Key;
  readonly as_of: Tick;
  readonly reason: ReasonCode;
  readonly proof: AuthorityProof;
}
export type AuthorityDecision =
  | (DecisionBase & { readonly state: "allowed"; readonly permission_ref: PermissionRef })
  | (DecisionBase & { readonly state: Exclude<AuthorityState, "allowed">; readonly permission_ref?: never });

/* ---------- Public case input (decision boundary) ---------- */
const TickSchema = z.number().int().nonnegative();
export const AuthorityRecordSchema = z
  .object({
    evidence_id: z.string(),
    key: KeySchema,
    source: z.string(),
    revision: z.number().int().positive(),
    event_time: TickSchema,
    known_time: TickSchema,
    valid_from: TickSchema,
    valid_until: TickSchema,
    effect: z.enum(["grant", "revoke", "explicit_deny"]),
  })
  .strict();
export const ApprovalSchema = z
  .object({
    evidence_id: z.string().optional(),
    key: KeySchema,
    occurred_at: TickSchema,
    known_at: TickSchema,
    explicit: z.boolean(),
  })
  .strict();

/** Fields evaluator-only; they must never cross the decision boundary. */
export const EVALUATOR_ONLY_FIELDS = [
  "valid_actions", "forbidden_actions", "expected_reason", "severity",
  "requires_abstention_or_hold", "private_state_summary",
] as const;

export const PublicCaseSchema = z
  .object({
    case_id: z.string(),
    pair_id: z.string(),
    pair_index: z.string(),
    variant: z.string(),
    category: z.string(),
    mechanism: z.string(),
    title: z.string(),
    decision_time: TickSchema,
    dispatch_time: TickSchema,
    tenant_id: z.string(),
    organization_id: z.string(),
    target_key: KeySchema,
    fallback_pilot_key: KeySchema.nullable(),
    amount_cents: z.number().int(),
    catalogue: z.array(z.string()),
    communication_records: z.array(z.record(z.unknown())),
    directory: z.array(z.object({ actor_id: z.string(), display_name: z.string(), role: z.string() }).passthrough()),
    service_records: z.array(AuthorityRecordSchema),
    service_approval: ApprovalSchema.nullable(),
    dispatch_mutation: z.record(z.unknown()).nullable(),
    crm_proxy_fields: z.record(z.unknown()),
  })
  .strict();
export type PublicCase = z.infer<typeof PublicCaseSchema>;

/** Evaluator gold row — separate type and path from PublicCase. */
export interface ExpectedLabel {
  readonly case_id: string;
  readonly pair_id: string;
  readonly valid_actions: readonly string[];
  readonly forbidden_actions: readonly string[];
  readonly severity: "normal" | "critical";
  readonly requires_abstention_or_hold: boolean;
  readonly expected_reason: ReasonCode;
}

/* ---------- Run results ---------- */
export type RunOrigin = "historical" | "current_run";
export interface RunReport {
  readonly run_id: string;
  readonly origin: RunOrigin;
  readonly contract_version: typeof CONTRACT_VERSION;
  readonly code_revision: string;
  readonly executed: boolean;
  readonly rows: readonly unknown[];
}

export type ModuleStatus = "VERIFIED" | "PARTIAL" | "PENDING";
