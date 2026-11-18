/** Executes D/C/B over public cases, then scores against evaluator-held gold. */
import { baselineC, proxyB } from "@/domain/baselines";
import { digestOf } from "@/domain/canonical";
import type { PublicCase } from "@/domain/contracts";
import { branchOf, candidatesOf, decideD, type DTrace } from "@/domain/decide";
import { scoreRows, type Arm } from "./four-case";
import { ACTION_BY_ID } from "@/domain/actions";
import { DEFAULT_COSTS, charge, newLedger, safeStateOf, type GtmAction } from "@/domain/intervention";

export const RUN_BUDGET = Object.freeze({ founder_hours: 40, founder_daily: 6, eng_hours: 40, pilot_slots: 3, days_left: 30, assets: [] as string[] });
function routeOf(action: string, reason: string) {
  const g = ACTION_BY_ID.get(action)!.gtm_action as GtmAction;
  const l = charge(newLedger(RUN_BUDGET), g, DEFAULT_COSTS);
  return { gtm_action: g, safe_state: safeStateOf(reason, true), budget: { charges: l.charges, remaining: { founder_hours: l.remaining.founder_hours, eng_hours: l.remaining.eng_hours, pilot_slots: l.remaining.pilot_slots, days_left: l.remaining.days_left } } };
}

export const CONFORMANCE_TARGETS = {
  D: { valid: 24, false_authorize: 0, pairs_ok: 12 },
  C: { valid: 14, false_authorize: 10, pairs_ok: 2 },
  B: { valid: 13, false_authorize: 11, pairs_ok: 1 },
} as const;

/** Policy outputs only — no gold. Keyed by position so tests can rename IDs. */
export async function executeArms(cases: readonly PublicCase[]) {
  const out: { case_id: string; arm: Arm; action: string; branch: string; reason: string; trace: (DTrace & ReturnType<typeof routeOf>) | null }[] = [];
  for (const c of cases) {
    const d = await decideD(c);
    out.push({ case_id: c.case_id, arm: "D", action: d.action, branch: d.branch, reason: d.reason, trace: { ...d, ...routeOf(d.action, d.reason) } });
    const ca = baselineC(c, candidatesOf(c));
    out.push({ case_id: c.case_id, arm: "C", action: ca, branch: branchOf(ca === c.catalogue[0] ? "ready_to_launch" : "hold", ca, false), reason: "surface_polarity", trace: null });
    const ba = proxyB(c);
    out.push({ case_id: c.case_id, arm: "B", action: ba, branch: branchOf(ba === c.catalogue[0] ? "ready_to_launch" : "hold", ba, false), reason: "crm_proxy_fields", trace: null });
  }
  return out;
}

export async function fullRunReport(cases: readonly PublicCase[], runtime: string) {
  const rows = await executeArms(cases);
  const scored = scoreRows(rows);
  const executed_at = new Date().toISOString();
  const inputs_digest = await digestOf(cases);
  const mismatches = scored.arms.flatMap((a) => {
    const t = CONFORMANCE_TARGETS[a.arm];
    return (["valid", "false_authorize", "pairs_ok"] as const).filter((k) => a[k] !== t[k]).map((k) => ({ arm: a.arm, metric: k, actual: a[k], target: t[k] }));
  });
  return {
    run_id: `run-24-${(await digestOf({ inputs_digest, executed_at })).slice(0, 10)}`, origin: "current_run" as const, executed_at,
    runtime_version: runtime, inputs_digest, denominator: cases.length,
    rows: scored.rows.map((r, i) => ({ ...r, reason: rows[i]!.reason, trace: rows[i]!.trace })),
    arms: scored.arms, targets: CONFORMANCE_TARGETS, unresolved_mismatches: mismatches,
    untested: [{ arm: "A", label: "External product comparison (e.g. Aligned DSR)", status: "UNTESTED" }],
  };
}
