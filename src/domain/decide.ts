/**
 * D arm — pure decision path over public inputs: candidates → authority → approval → policy → dispatch recheck.
 * Never reads case identifiers, pair ids, variants or evaluator labels.
 */
import { checkApproval, readinessReason, resolveAuthority } from "./authority";
import { tick, type Approval, type AuthorityRecord, type PublicCase, type ReasonCode } from "./contracts";
import { dedupeByDependence, extractCandidates, type DirectoryRow } from "./evidence";
import { selectAction } from "./policy";

export const REGISTERED_SOURCES = ["buyer_admin", "delegation_service", "registry"] as const;

export function directoryOf(c: PublicCase): DirectoryRow[] {
  return c.directory.map((d) => ({ tenant: c.tenant_id, organization: c.organization_id, actor_id: d.actor_id, display_name: d.display_name, role: d.role }));
}
export function candidatesOf(c: PublicCase) {
  const dir = directoryOf(c);
  return dedupeByDependence(c.communication_records.flatMap((r) => extractCandidates({
    record_id: String(r["record_id"]), source_id: String(r["source_id"]), source_version: String(r["source_version"]),
    tenant_id: String(r["tenant_id"]), organization_id: String(r["organization_id"]), speaker: String(r["speaker"]),
    actor_id: (r["actor_id"] as string | null | undefined) ?? null, speaker_role: r["speaker_role"] as string | undefined,
    dependence_group: r["dependence_group"] as string | undefined, text: String(r["text"]),
  }, dir)));
}

export type Branch = "allowed" | "clarified" | "alternative" | "denied" | "unknown" | "pending";
export function branchOf(reason: string, action: string, alternative: boolean): Branch {
  if (reason === "ready_to_launch") return "allowed";
  if (["revoked", "explicit_deny", "expired"].includes(reason)) return "denied";
  if (alternative || action.includes("pilot")) return "alternative";
  if (["no_grant", "not_yet_known", "not_yet_effective", "candidate_only_no_authority", "ambiguous_actor_identity", "conflict", "untrusted_source"].includes(reason)) return "unknown";
  return "clarified";
}

export interface DTrace {
  action: string; reason: string; branch: Branch; gate: "open" | "closed";
  decision_reason: string; mismatch_axes: string[];
  dispatch_attempted: boolean; dispatch_committed: boolean; dispatch_reason: string | null;
  proof_digest: string; alternative: boolean;
}

export async function decideD(c: PublicCase, sources: readonly string[] = REGISTERED_SOURCES): Promise<DTrace> {
  const records = c.service_records as AuthorityRecord[];
  const at = (t: number) => resolveAuthority({ records, key: c.target_key, asOf: tick(t), registeredSources: sources });
  const cur = await at(c.decision_time);
  const approval = await checkApproval({ approval: c.service_approval as Approval | null, key: c.target_key, asOf: tick(c.decision_time), records, registeredSources: sources });
  let reason: ReasonCode = readinessReason(cur, approval);
  if (reason === "ready_to_launch" && candidatesOf(c).some((x) => x.identity.status === "ambiguous")) reason = "ambiguous_actor_identity";
  const decision_reason = reason;
  let action = selectAction(c.catalogue, reason);
  let attempted = false, committed = false, dReason: string | null = null;
  if (action.consequential) {
    attempted = true;
    const later = await at(c.dispatch_time);
    if (later.state !== "allowed") { reason = later.reason as ReasonCode; dReason = later.reason; }
    else if (c.dispatch_mutation) { reason = "approval_terms_changed"; dReason = reason; }
    else { committed = true; dReason = "ready_to_dispatch"; }
    if (!committed) action = selectAction(c.catalogue, reason);
  }
  let alternative = false;
  if (cur.proof.mismatch_axes.length) {
    for (const r of records) if ((await resolveAuthority({ records, key: r.key, asOf: tick(c.decision_time), registeredSources: sources })).state === "allowed") alternative = true;
  }
  return {
    action: action.action, reason, branch: branchOf(reason, action.action, alternative), gate: committed ? "open" : "closed",
    decision_reason, mismatch_axes: [...cur.proof.mismatch_axes], dispatch_attempted: attempted, dispatch_committed: committed,
    dispatch_reason: dReason, proof_digest: cur.proof_digest, alternative,
  };
}
