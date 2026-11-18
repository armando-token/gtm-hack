/**
 * Trusted fixture service — server only.
 * Sandbox trusted source = simulated fixture registry (disclosed). Session state is held
 * in worker memory for now; durable transactional persistence is PENDING (phase 03).
 */
import { checkApproval, readinessReason, resolveAuthority } from "@/domain/authority";
import { CONTRACT_VERSION, PublicCaseSchema, tick, type AuthorityRecord, type PublicCase } from "@/domain/contracts";
import { EvidenceLog, authorityRecordEvent, dedupeByDependence, extractCandidates, visibleTick, type DirectoryRow } from "@/domain/evidence";
import { issuePermission, verifyPermission } from "@/domain/permission";
import rawCases from "./fixtures/public-cases.json";

export const REGISTERED_SOURCES = ["buyer_admin", "delegation_service", "registry"] as const;
export const TRUSTED_SOURCE_DISCLOSURE = "Simulated fixture registry (sandbox). Not a verified real custodian.";
export const DEMO_CASE_IDS = ["CF-01A", "CF-01B", "CF-02A", "CF-02B"] as const;

const CASES = new Map<string, PublicCase>(
  (rawCases as unknown[]).map((c) => {
    const parsed = PublicCaseSchema.parse(c);
    return [parsed.case_id, parsed];
  }),
);

function secret(): string {
  const s = process.env["GTM_SEAL_SECRET"];
  if (!s) throw new Error("GTM_SEAL_SECRET is not configured");
  return s;
}

interface Session {
  readonly id: string;
  readonly log: EvidenceLog;
  readonly loaded: Set<string>;
}
const sessions = new Map<string, Session>();
function session(id: string): Session {
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(id)) throw new Error("Invalid session id");
  let s = sessions.get(id);
  if (!s) sessions.set(id, (s = { id, log: new EvidenceLog(), loaded: new Set() }));
  return s;
}

export function getCase(caseId: string): PublicCase {
  const c = CASES.get(caseId);
  if (!c) throw new Error(`Unknown case ${caseId}`);
  return c;
}

/** Server-controlled trusted intake: loads service_records only from the fixture registry. */
async function trustedIntake(s: Session, c: PublicCase) {
  if (s.loaded.has(c.case_id)) return;
  for (const r of c.service_records) await s.log.append(authorityRecordEvent(c.tenant_id, r as AuthorityRecord));
  s.loaded.add(c.case_id);
}

function directoryOf(c: PublicCase): DirectoryRow[] {
  return c.directory.map((d) => ({ tenant: c.tenant_id, organization: c.organization_id, actor_id: d.actor_id, display_name: d.display_name, role: d.role }));
}

export function listDemoCases() {
  return DEMO_CASE_IDS.map((id) => {
    const c = getCase(id);
    return { case_id: c.case_id, title: c.title, decision_time: c.decision_time, dispatch_time: c.dispatch_time };
  });
}

export async function evaluateCase(input: { sessionId: string; caseId: string; asOf?: number | undefined }) {
  const s = session(input.sessionId);
  const c = getCase(input.caseId);
  await trustedIntake(s, c);
  const asOf = tick(input.asOf ?? c.decision_time);
  const records = s.log
    .read(c.tenant_id)
    .map((e) => e.payload as AuthorityRecord)
    .filter((r) => c.service_records.some((x) => x.evidence_id === r.evidence_id));
  const key = c.target_key;
  const current = await resolveAuthority({ records, key, asOf, registeredSources: REGISTERED_SOURCES });
  const approval = await checkApproval({ approval: c.service_approval as never, key, asOf, records, registeredSources: REGISTERED_SOURCES });
  const directory = directoryOf(c);
  const candidates = dedupeByDependence(
    c.communication_records.flatMap((r) =>
      extractCandidates(
        {
          record_id: String(r["record_id"]), source_id: String(r["source_id"]), source_version: String(r["source_version"]),
          tenant_id: String(r["tenant_id"]), organization_id: String(r["organization_id"]), speaker: String(r["speaker"]),
          actor_id: (r["actor_id"] as string | null | undefined) ?? null, speaker_role: r["speaker_role"] as string | undefined,
          dependence_group: r["dependence_group"] as string | undefined, text: String(r["text"]),
        },
        directory,
      ),
    ),
  );
  const ambiguous = candidates.some((x) => x.identity.status === "ambiguous");
  let reason = readinessReason(current, approval);
  if (reason === "ready_to_launch" && ambiguous) reason = "ambiguous_actor_identity";
  const permission_ref =
    current.state === "allowed"
      ? await issuePermission(current, { session: s.id, tenant: c.tenant_id, registry_version: s.log.registryVersion }, secret())
      : null;
  return {
    contract_version: CONTRACT_VERSION,
    session_id: s.id,
    registry_version: s.log.registryVersion,
    trusted_source_disclosure: TRUSTED_SOURCE_DISCLOSURE,
    case: {
      case_id: c.case_id, title: c.title, tenant_id: c.tenant_id, organization_id: c.organization_id,
      decision_time: c.decision_time, dispatch_time: c.dispatch_time, amount_minor: c.amount_cents, currency: "USD" as const,
      target_key: key, catalogue: c.catalogue,
    },
    as_of: asOf as number,
    authority: { state: current.state, reason: current.reason, proof: current.proof, proof_digest: current.proof_digest, log: current.log },
    approval: { ok: approval.ok, reason: approval.reason },
    readiness: reason,
    permission_ref,
    candidates,
    trusted_records: records.map((r) => ({
      evidence_id: r.evidence_id, source: r.source, revision: r.revision, effect: r.effect, key: r.key,
      visible_from: visibleTick(r), valid_until: r.valid_until as number, visible: visibleTick(r) <= asOf,
      provenance: "trusted_fixture_registry",
    })),
  };
}

export async function checkPermission(input: { sessionId: string; caseId: string; asOf: number; ref: string }) {
  const c = getCase(input.caseId);
  return verifyPermission(input.ref, { session: input.sessionId, tenant: c.tenant_id, key: c.target_key, as_of: tick(input.asOf) }, secret());
}

export function backendInfo() {
  return { contract_version: CONTRACT_VERSION, runtime: "tanstack-start-server-function", persistence: "PENDING" as const, checked_at: new Date().toISOString() };
}
