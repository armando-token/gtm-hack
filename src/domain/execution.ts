/** Frozen intent, dispatch revalidation, payment reconciliation, recovery state machine. */
import { checkApproval, resolveAuthority } from "./authority";
import { digestOf } from "./canonical";
import { keyEquals, keyMismatch, type Approval, type AuthorityRecord, type Currency, type Key, type ModuleStatus, type ReasonCode, type Tick } from "./contracts";

export const EXECUTION_STATUS: ModuleStatus = "PARTIAL";

export interface ProposalSnapshot {
  readonly proposal_id: string;
  readonly key: Key;
  readonly amount_cents: number;
  readonly currency: Currency;
}
export const proposalDigest = (p: ProposalSnapshot) => digestOf(p);

export interface FrozenIntent {
  readonly proposal: ProposalSnapshot;
  readonly proposal_digest: string;
  readonly decision_time: number;
  readonly approval: Approval;
  readonly permission_ref: string;
  readonly proof_digest: string;
  readonly registry_version: number;
}

export type DispatchReason = ReasonCode | "proposal_changed" | "amount_changed" | "currency_changed" | "ready_to_dispatch";

/** Revalidate a frozen intent at dispatch time against the current proposal and registry. */
export async function revalidateForDispatch(input: {
  intent: FrozenIntent;
  current: ProposalSnapshot;
  records: readonly AuthorityRecord[];
  registeredSources: readonly string[];
  dispatchTime: Tick;
}): Promise<{ ok: boolean; reason: DispatchReason; changed_after_event: boolean }> {
  const { intent, current, dispatchTime } = input;
  const changed = (reason: DispatchReason) => ({ ok: false, reason, changed_after_event: true });
  if (current.currency !== intent.proposal.currency) return changed("currency_changed");
  if (current.amount_cents !== intent.proposal.amount_cents) return changed("amount_changed");
  if (!keyEquals(current.key, intent.proposal.key)) {
    const axes = keyMismatch(intent.proposal.key, current.key);
    return changed(axes.length === 1 && axes[0] === "terms_digest" ? "approval_terms_changed" : axes.length === 1 ? (`scope_mismatch_${axes[0]}` as ReasonCode) : "scope_mismatch_multiple");
  }
  if ((await proposalDigest(current)) !== intent.proposal_digest) return changed("proposal_changed");
  const ap = await checkApproval({ approval: intent.approval, key: current.key, asOf: dispatchTime, records: input.records, registeredSources: input.registeredSources });
  if (!ap.ok) return { ok: false, reason: ap.reason, changed_after_event: true };
  const now = await resolveAuthority({ records: input.records, key: current.key, asOf: dispatchTime, registeredSources: input.registeredSources });
  if (now.state !== "allowed") return { ok: false, reason: now.reason, changed_after_event: true };
  return { ok: true, reason: "ready_to_dispatch", changed_after_event: false };
}

/* ======================= Durable state machine ======================= */
export type IntentState = "prepared" | "queued" | "committed" | "failed" | "reconciled";
const NEXT: Record<IntentState, IntentState[]> = {
  prepared: ["queued", "failed"],
  queued: ["committed", "failed", "queued"],
  committed: ["reconciled"],
  failed: [],
  reconciled: [],
};
export function transition(from: IntentState, to: IntentState): IntentState {
  if (!NEXT[from].includes(to)) throw new Error(`Illegal transition ${from} → ${to}`);
  return to;
}

/** At-most-one effect sink keyed by effect key (pure double of the DB unique constraint). */
export class EffectSink {
  private readonly effects = new Map<string, { id: string; payload_hash: string }>();
  async accept(effectKey: string, payload: unknown) {
    const h = await digestOf(payload);
    const ex = this.effects.get(effectKey);
    if (ex) return ex.payload_hash === h ? { status: "duplicate" as const, id: ex.id } : { status: "conflict" as const, id: ex.id };
    const id = `eff-${this.effects.size + 1}`;
    this.effects.set(effectKey, { id, payload_hash: h });
    return { status: "accepted" as const, id };
  }
  get count() {
    return this.effects.size;
  }
}

/** Outbox worker with leases; retries after lease loss/timeout never double-deliver or double-reserve. */
export class Outbox {
  private readonly jobs = new Map<string, { effectKey: string; payload: unknown; lease: string | null; state: IntentState }>();
  readonly reservations = new Set<string>();
  constructor(private readonly sink: EffectSink) {}
  enqueue(jobId: string, effectKey: string, payload: unknown) {
    if (!this.jobs.has(jobId)) this.jobs.set(jobId, { effectKey, payload, lease: null, state: "queued" });
    this.reservations.add(jobId);
  }
  lease(jobId: string, worker: string) {
    const j = this.jobs.get(jobId);
    if (!j || j.state !== "queued") return false;
    j.lease = worker;
    return true;
  }
  expireLease(jobId: string) {
    const j = this.jobs.get(jobId);
    if (j) j.lease = null;
  }
  async deliver(jobId: string, worker: string, opts: { timeoutAfterSend?: boolean } = {}) {
    const j = this.jobs.get(jobId);
    if (!j || j.lease !== worker) return { status: "lease_lost" as const };
    const r = await this.sink.accept(j.effectKey, j.payload);
    if (opts.timeoutAfterSend) {
      j.lease = null;
      return { status: "timeout" as const };
    }
    j.state = "committed";
    return { status: r.status === "conflict" ? ("conflict" as const) : ("committed" as const), effect: r.id };
  }
  state(jobId: string) {
    return this.jobs.get(jobId)?.state;
  }
}

/* ======================= Payments (A11-style) ======================= */
export type CommercialEventKind = "sent" | "agreement" | "purchase_order" | "receipt" | "reversal";
export interface ExpectedContract {
  readonly tenant: string;
  readonly beneficiary_org: string;
  readonly payer: string;
  readonly amount_cents: number;
  readonly currency: Currency;
  readonly horizon_end: number;
}
export interface ReceiptEvent {
  readonly kind: CommercialEventKind;
  readonly receipt_id: string;
  readonly source: "trusted_receipt_simulator" | "claim";
  readonly tenant: string;
  readonly beneficiary_org: string;
  readonly payer: string;
  readonly amount_cents: number;
  readonly currency: Currency;
  readonly settled: boolean;
  readonly at: number;
  readonly reverses?: string | undefined;
}
export interface PaymentStatus {
  readonly first_payment_receipt: string | null;
  readonly net_paid: boolean;
  readonly rejected: { receipt_id: string; reason: string }[];
  readonly counted: string[];
  readonly excluded_after_horizon: string[];
}

export function reconcilePayments(contract: ExpectedContract, events: readonly ReceiptEvent[], horizon: number = contract.horizon_end): PaymentStatus {
  const rejected: { receipt_id: string; reason: string }[] = [];
  const counted: string[] = [];
  const after: string[] = [];
  const seen = new Set<string>();
  const reversed = new Set(events.filter((e) => e.kind === "reversal" && e.at <= horizon && e.reverses).map((e) => e.reverses!));
  for (const e of [...events].sort((a, b) => a.at - b.at)) {
    if (e.kind !== "receipt") continue;
    const reason =
      e.source !== "trusted_receipt_simulator" ? "untrusted_receipt_source"
      : !e.settled ? "not_settled"
      : e.tenant !== contract.tenant ? "tenant_mismatch"
      : e.beneficiary_org !== contract.beneficiary_org ? "beneficiary_mismatch"
      : e.payer !== contract.payer ? "payer_mismatch"
      : e.currency !== contract.currency ? "currency_mismatch"
      : e.amount_cents !== contract.amount_cents ? "amount_mismatch"
      : null;
    if (reason) { rejected.push({ receipt_id: e.receipt_id, reason }); continue; }
    if (e.at > horizon) { after.push(e.receipt_id); continue; }
    if (seen.has(e.receipt_id)) continue;
    seen.add(e.receipt_id);
    counted.push(e.receipt_id);
  }
  const active = counted.filter((id) => !reversed.has(id));
  return { first_payment_receipt: counted[0] ?? null, net_paid: active.length > 0, rejected, counted, excluded_after_horizon: after };
}
