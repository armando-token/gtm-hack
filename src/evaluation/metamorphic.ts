/** Metamorphic controls over the D arm. Each failure names the exact case and cause. */
import type { AuthorityRecord, PublicCase } from "@/domain/contracts";
import { decideD } from "@/domain/decide";

type Check = { check: string; case_id: string; ok: boolean; cause: string };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

function renameAll(c: PublicCase): PublicCase {
  let s = JSON.stringify(c);
  s = s.split(c.case_id).join(`X-${c.case_id.length}-renamed`).split(c.organization_id).join("org-alias-renamed").split(c.tenant_id).join("tenant-unseen-renamed");
  return JSON.parse(s) as PublicCase;
}

export async function runMetamorphic(cases: readonly PublicCase[]): Promise<{ checks: Check[]; failed: Check[] }> {
  const checks: Check[] = [];
  const push = (check: string, case_id: string, ok: boolean, cause: string) => checks.push({ check, case_id, ok, cause });
  for (const c of cases) {
    const base = await decideD(c);
    const same = async (name: string, m: PublicCase) => { const r = await decideD(m); push(name, c.case_id, r.action === base.action && r.reason === base.reason, `${base.action}/${base.reason} → ${r.action}/${r.reason}`); };
    await same("rename_ids_and_aliases_unseen_tenant", renameAll(c));
    const rev = clone(c); (rev as { service_records: unknown[] }).service_records = [...c.service_records].reverse(); (rev as { communication_records: unknown[] }).communication_records = [...c.communication_records].reverse();
    await same("reorder_records", rev);
    const dup = clone(c); (dup as { service_records: unknown[] }).service_records = [...c.service_records, ...c.service_records];
    await same("duplicate_record", dup);

    if (base.reason !== "ready_to_launch") continue;
    const changed = async (name: string, m: PublicCase) => { const r = await decideD(m); push(name, c.case_id, r.action !== base.action, `${base.action} → ${r.action} (${r.reason})`); };
    const axis = clone(c); (axis.target_key as { terms_digest: string }).terms_digest += "-changed"; await changed("change_one_key_axis", axis);
    const exp = clone(c); for (const r of exp.service_records as AuthorityRecord[]) (r as { valid_until: number }).valid_until = c.decision_time; await changed("exclusive_expiry", exp);
    const kt = clone(c); for (const r of kt.service_records as AuthorityRecord[]) (r as { known_time: number }).known_time = c.decision_time + 1; await changed("known_time_after_cutoff", kt);
    const rv = clone(c); const g = (c.service_records as AuthorityRecord[]).at(-1)!;
    (rv as { service_records: unknown[] }).service_records = [...c.service_records, { ...g, evidence_id: `${g.evidence_id}-rv`, revision: g.revision + 1, event_time: c.decision_time + 1, known_time: c.decision_time + 1, valid_from: c.decision_time + 1, effect: "revoke" }];
    await changed("revoke_after_prepare", rv);
    const mt = clone(c); (mt as { dispatch_mutation: unknown }).dispatch_mutation = { new_terms_digest: "terms-altered", new_amount_cents: c.amount_cents + 100 }; await changed("terms_money_change_before_dispatch", mt);
  }
  return { checks, failed: checks.filter((x) => !x.ok) };
}
