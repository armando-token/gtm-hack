/** Exact-scope authority resolution (contract C03) and explicit approval (C04). */
import { canonicalJson, digestOf } from "./canonical";
import {
  KEY_AXES, keyEquals, keyMismatch,
  type Approval, type AuthorityEffect, type AuthorityProof, type AuthorityRecord, type AuthorityState,
  type Key, type KeyAxis, type ModuleStatus, type ReasonCode, type Tick,
} from "./contracts";
import { visibleTick } from "./evidence";

export const AUTHORITY_STATUS: ModuleStatus = "PARTIAL";

export function isVisible(r: AuthorityRecord, asOf: Tick): boolean {
  return visibleTick(r) <= asOf;
}

/** Resolver output before the server attaches a permission reference. */
export interface ResolvedAuthority {
  readonly key: Key;
  readonly as_of: Tick;
  readonly state: AuthorityState;
  readonly reason: ReasonCode;
  readonly proof: AuthorityProof;
  readonly proof_digest: string;
  readonly source_revisions: Readonly<Record<string, number>>;
  readonly log: readonly string[];
}

export interface ResolveInput {
  readonly records: readonly AuthorityRecord[];
  readonly key: Key;
  readonly asOf: Tick;
  readonly registeredSources: readonly string[];
}

const recordDigest = (r: AuthorityRecord) => digestOf(r);
/** Capability governs its action: a capability change that also changes the action is one capability mismatch. */
function diagnosticAxes(axes: KeyAxis[]): KeyAxis[] {
  return axes.includes("capability") ? axes.filter((a) => a !== "action") : axes;
}
const mismatchReason = (raw: KeyAxis[]): ReasonCode => {
  const axes = diagnosticAxes(raw);
  return axes.length === 1 ? (`scope_mismatch_${axes[0]}` as ReasonCode) : "scope_mismatch_multiple";
};

export async function resolveAuthority({ records, key, asOf, registeredSources }: ResolveInput): Promise<ResolvedAuthority> {
  for (const a of KEY_AXES) if (typeof key[a] !== "string" || !key[a]) throw new Error(`Invalid key axis ${a}`);
  if (!Number.isInteger(asOf)) throw new Error("as_of must be an integer tick");
  const registered = new Set(registeredSources);
  const log: string[] = [];

  const exactTrusted = records.filter((r) => registered.has(r.source) && keyEquals(r.key, key));
  const visible = exactTrusted.filter((r) => isVisible(r, asOf));

  // Group by source; latest visible revision per source; collapse identical digests.
  const bySource = new Map<string, AuthorityRecord[]>();
  for (const r of visible) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
  const latestRevisions: Record<string, number> = {};
  const selected: AuthorityRecord[] = [];
  const conflicts: { source: string; effects: AuthorityEffect[] }[] = [];
  const matched: string[] = [];
  for (const [source, rs] of [...bySource.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const maxRev = Math.max(...rs.map((r) => r.revision));
    latestRevisions[source] = maxRev;
    const latest = rs.filter((r) => r.revision === maxRev);
    const uniq = new Map<string, AuthorityRecord>();
    for (const r of latest) uniq.set(await recordDigest(r), r);
    matched.push(...uniq.keys());
    if (uniq.size > 1) {
      conflicts.push({ source, effects: [...uniq.values()].map((r) => r.effect).sort() });
      log.push(`conflict: ${uniq.size} distinct records at ${source}@rev${maxRev}`);
    } else selected.push([...uniq.values()][0]!);
  }

  const activeNonRevoke = (r: AuthorityRecord) => r.effect !== "revoke" && asOf < r.valid_until;
  const denies = selected.filter((r) => r.effect === "explicit_deny" && activeNonRevoke(r));
  const revokes = selected.filter((r) => r.effect === "revoke");
  const grants = selected.filter((r) => r.effect === "grant" && activeNonRevoke(r));
  if ((denies.length || revokes.length) && grants.length) {
    const grantSources = grants.map((g) => g.source).join(",");
    log.push(`cross-source disagreement: grant from ${grantSources}`);
    for (const g of grants) conflicts.push({ source: g.source, effects: ["grant"] });
  }

  let state: AuthorityState;
  let reason: ReasonCode;
  let mismatch_axes: KeyAxis[] = [];
  if (denies.length) [state, reason] = ["denied", "explicit_deny"];
  else if (revokes.length) [state, reason] = ["denied", "revoked"];
  else if (conflicts.length) [state, reason] = ["conflict", "conflict"];
  else if (grants.length) [state, reason] = ["allowed", "granted"];
  else {
    state = "unknown";
    const future = exactTrusted.filter((r) => !isVisible(r, asOf));
    const expiredSelected = selected.filter((r) => r.effect === "grant" && asOf >= r.valid_until);
    const untrustedExact = records.filter((r) => !registered.has(r.source) && keyEquals(r.key, key) && isVisible(r, asOf));
    if (expiredSelected.length) reason = "expired";
    else if (future.some((r) => r.known_time > asOf)) reason = "not_yet_known";
    else if (future.length) reason = "not_yet_effective";
    else if (untrustedExact.length) reason = "untrusted_source";
    else {
      // Closest trusted partial match, same tenant/organization first. Never expands scope.
      const trustedVisible = records.filter((r) => registered.has(r.source) && isVisible(r, asOf));
      const sameOrg = trustedVisible.filter((r) => r.key.tenant === key.tenant && r.key.organization === key.organization);
      const sameTenant = trustedVisible.filter((r) => r.key.tenant === key.tenant);
      const pool = sameOrg.length ? sameOrg : sameTenant.length ? sameTenant : trustedVisible;
      const ranked = pool.map((r) => keyMismatch(key, r.key)).filter((m) => m.length).sort((a, b) => a.length - b.length);
      if (ranked.length) {
        mismatch_axes = ranked[0]!;
        reason = mismatchReason(mismatch_axes);
      } else reason = "no_grant";
    }
  }

  const proof: AuthorityProof = {
    target_key: key,
    as_of: asOf,
    registered_sources: [...registered].sort(),
    matched_record_digests: [...new Set(matched)].sort(),
    latest_revisions: latestRevisions,
    conflicts,
    mismatch_axes,
  };
  return { key, as_of: asOf, state, reason, proof, proof_digest: await digestOf(proof), source_revisions: latestRevisions, log };
}

/* ======================= Explicit approval ======================= */
export interface ApprovalCheck {
  readonly ok: boolean;
  readonly reason: ReasonCode;
  readonly at_occurrence?: ResolvedAuthority;
}

export async function checkApproval(input: {
  approval: Approval | null | undefined;
  key: Key;
  asOf: Tick;
  records: readonly AuthorityRecord[];
  registeredSources: readonly string[];
}): Promise<ApprovalCheck> {
  const { approval, key, asOf } = input;
  if (!approval) return { ok: false, reason: "missing_approval" };
  if (approval.explicit !== true) return { ok: false, reason: "approval_not_explicit" };
  const axes = keyMismatch(key, approval.key);
  if (axes.length === 1 && axes[0] === "terms_digest") return { ok: false, reason: "approval_terms_changed" };
  if (axes.length) return { ok: false, reason: mismatchReason(axes) };
  if (!(approval.occurred_at <= approval.known_at && approval.known_at <= asOf)) return { ok: false, reason: "approval_timeline_invalid" };
  const at = await resolveAuthority({ records: input.records, key, asOf: approval.occurred_at, registeredSources: input.registeredSources });
  if (at.state !== "allowed") return { ok: false, reason: at.reason, at_occurrence: at };
  return { ok: true, reason: "granted", at_occurrence: at };
}

/** Readiness: current authority allowed AND explicit approval valid. */
export function readinessReason(current: ResolvedAuthority, approval: ApprovalCheck): ReasonCode {
  if (current.state !== "allowed") return current.reason;
  if (!approval.ok) return approval.reason;
  return "ready_to_launch";
}

export { canonicalJson };
