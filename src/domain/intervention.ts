/**
 * Phase 06 — contingent routes, budgets, selective generation and safe unknowns. Pure.
 * Costs are configured per experiment and frozen for a run (Object.freeze).
 */
export const GTM_ACTIONS = ["standard_offer", "isolated_pilot", "deferred_invoice", "isolated_deferred", "request_it_authorization", "request_budget_authorization"] as const;
export type GtmAction = (typeof GTM_ACTIONS)[number];

export interface ActionCost { founder_hours: number; days: number; eng_hours: number; pilot_slots: number; asset?: string | undefined; asset_build_hours?: number | undefined }
export type CostTable = Readonly<Record<GtmAction, Readonly<ActionCost>>>;

export const DEFAULT_COSTS: CostTable = Object.freeze({
  standard_offer: { founder_hours: 1, days: 2, eng_hours: 0, pilot_slots: 0 },
  isolated_pilot: { founder_hours: 3, days: 3, eng_hours: 4, pilot_slots: 1, asset: "sandbox_template", asset_build_hours: 6 },
  deferred_invoice: { founder_hours: 2, days: 3, eng_hours: 0, pilot_slots: 0 },
  isolated_deferred: { founder_hours: 4, days: 4, eng_hours: 4, pilot_slots: 1, asset: "sandbox_template", asset_build_hours: 6 },
  request_it_authorization: { founder_hours: 1, days: 1, eng_hours: 0, pilot_slots: 0 },
  request_budget_authorization: { founder_hours: 1, days: 1, eng_hours: 0, pilot_slots: 0 },
});
export function freezeCosts(c: Partial<Record<GtmAction, ActionCost>>): CostTable {
  return Object.freeze(Object.fromEntries(GTM_ACTIONS.map((a) => [a, Object.freeze({ ...DEFAULT_COSTS[a], ...c[a] })]))) as CostTable;
}

export interface Budget { founder_hours: number; founder_daily: number; eng_hours: number; pilot_slots: number; days_left: number; assets: readonly string[] }
export interface Charge { item: string; founder_hours: number; eng_hours: number; pilot_slots: number; days: number }
export interface Ledger { charges: Charge[]; remaining: Budget }

export function newLedger(b: Budget): Ledger { return { charges: [], remaining: { ...b, assets: [...b.assets] } }; }

/** Feasibility without charging: founder total, daily founder capacity, engineering, pilot slots, calendar. */
export function feasibility(l: Ledger, a: GtmAction, costs: CostTable): { ok: true } | { ok: false; reason: string } {
  const c = costs[a]; const r = l.remaining;
  const build = c.asset && !r.assets.includes(c.asset) ? c.asset_build_hours ?? 0 : 0;
  if (c.founder_hours > r.founder_hours) return { ok: false, reason: "insufficient_founder_hours" };
  if (c.founder_hours / Math.max(1, c.days) > r.founder_daily) return { ok: false, reason: "insufficient_daily_founder_capacity" };
  if (c.eng_hours + build > r.eng_hours) return { ok: false, reason: "insufficient_engineering_hours" };
  if (c.pilot_slots > r.pilot_slots) return { ok: false, reason: "no_live_pilot_slot" };
  if (c.days > r.days_left) return { ok: false, reason: "insufficient_time" };
  return { ok: true };
}

export function charge(l: Ledger, a: GtmAction, costs: CostTable, label: string = a): Ledger {
  const c = costs[a]; const r = l.remaining;
  const charges = [...l.charges];
  let eng = r.eng_hours; const assets = [...r.assets];
  if (c.asset && !assets.includes(c.asset)) {
    charges.push({ item: `asset_build:${c.asset}`, founder_hours: 0, eng_hours: c.asset_build_hours ?? 0, pilot_slots: 0, days: 0 });
    eng -= c.asset_build_hours ?? 0; assets.push(c.asset);
  }
  charges.push({ item: label, founder_hours: c.founder_hours, eng_hours: c.eng_hours, pilot_slots: c.pilot_slots, days: c.days });
  return { charges, remaining: { ...r, founder_hours: r.founder_hours - c.founder_hours, eng_hours: eng - c.eng_hours, pilot_slots: r.pilot_slots - c.pilot_slots, days_left: r.days_left - c.days, assets } };
}
export function chargeRaw(l: Ledger, ch: Charge): Ledger {
  const r = l.remaining;
  return { charges: [...l.charges, ch], remaining: { ...r, founder_hours: r.founder_hours - ch.founder_hours, eng_hours: r.eng_hours - ch.eng_hours, pilot_slots: r.pilot_slots - ch.pilot_slots, days_left: r.days_left - ch.days } };
}

/* ---------- observations and policies ---------- */
export type ProbeResponse = "yes" | "no" | "silent" | "inconclusive";
export interface Observation {
  verified_standard: boolean;          // exact authority + approval already verified for the commercial offer
  commercial_denied: boolean;          // trusted deny/mismatch on commercial spend
  sandbox_authorized: boolean;         // separate verified technical sandbox authority
  isolated_eligible: boolean;
  deferred_eligible: boolean;
  probe_available: boolean;
  probe_informative: boolean;
}
export interface RouteResult { route: GtmAction | "none"; reason: string; ledger: Ledger; commercial_effects: number; steps: string[]; rejected: { action: GtmAction; reason: string }[] }

function tryAction(l: Ledger, a: GtmAction, costs: CostTable, rejected: RouteResult["rejected"]): Ledger | null {
  const f = feasibility(l, a, costs);
  if (!f.ok) { rejected.push({ action: a, reason: f.reason }); return null; }
  return charge(l, a, costs);
}

export interface PolicyConfig { costs: CostTable; safe_default: GtmAction }
export const DEFAULT_CONFIG: PolicyConfig = Object.freeze({ costs: DEFAULT_COSTS, safe_default: "request_budget_authorization" });

/** Reference contingent policy: verified direct offer → proceed; else probe IT then branch. */
export function contingentPolicy(obs: Observation, budget: Budget, respond: () => ProbeResponse, cfg: PolicyConfig = DEFAULT_CONFIG): RouteResult {
  let l = newLedger(budget); const rejected: RouteResult["rejected"] = []; const steps: string[] = [];
  const pick = (a: GtmAction, reason: string): RouteResult | null => {
    const n = tryAction(l, a, cfg.costs, rejected); if (!n) return null;
    l = n; steps.push(a);
    return { route: a, reason, ledger: l, commercial_effects: a === "standard_offer" || a === "deferred_invoice" ? 1 : 0, steps, rejected };
  };
  if (obs.verified_standard && !obs.commercial_denied) { const r = pick("standard_offer", "verified_direct_offer"); if (r) return r; }
  if (obs.commercial_denied && obs.sandbox_authorized) { const r = pick("isolated_pilot", "commercial_denied_sandbox_permitted"); if (r) return r; }
  if (obs.probe_available && obs.probe_informative && !obs.commercial_denied) {
    const p = tryAction(l, "request_it_authorization", cfg.costs, rejected);
    if (p) {
      l = p; steps.push("request_it_authorization");
      const resp = respond();
      if (resp === "yes" && obs.isolated_eligible) { const r = pick("isolated_pilot", "probe_yes_isolated_eligible"); if (r) return r; }
      if (resp === "no" && obs.deferred_eligible) { const r = pick("deferred_invoice", "probe_no_deferred_eligible"); if (r) return r; }
      const r = pick(cfg.safe_default, `probe_${resp}_safe_default`); if (r) return r;
    }
  }
  const r = pick(cfg.safe_default, "safe_default"); if (r) return r;
  return { route: "none", reason: "no_feasible_action", ledger: l, commercial_effects: 0, steps, rejected };
}

/** Catalogue-only greedy baseline: same observations/actions/costs, no probing, first feasible eligible action. */
export function greedyBaseline(obs: Observation, budget: Budget, cfg: PolicyConfig = DEFAULT_CONFIG): RouteResult {
  let l = newLedger(budget); const rejected: RouteResult["rejected"] = [];
  const order: [GtmAction, boolean][] = [
    ["standard_offer", obs.verified_standard && !obs.commercial_denied],
    ["isolated_pilot", obs.sandbox_authorized || obs.isolated_eligible],
    ["deferred_invoice", obs.deferred_eligible && !obs.commercial_denied],
    [cfg.safe_default, true],
  ];
  for (const [a, ok] of order) {
    if (!ok) continue;
    const n = tryAction(l, a, cfg.costs, rejected);
    if (n) { l = n; return { route: a, reason: "greedy_first_feasible", ledger: l, commercial_effects: a === "standard_offer" || a === "deferred_invoice" ? 1 : 0, steps: [a], rejected }; }
  }
  return { route: "none", reason: "no_feasible_action", ledger: l, commercial_effects: 0, steps: [], rejected };
}

/* ---------- selective generation ---------- */
export interface InterventionSpec {
  capabilities: readonly string[]; deployment_mode: "read_only_export" | "isolated_sandbox" | "production";
  evidence_request: string; terms: string; duration_days: number; commitment: "none" | "pilot" | "binding";
}
export interface Draft { status: "draft" | "validated" | "rejected"; spec: InterventionSpec; artifacts: string[]; violations: string[] }
export const GENERATION_COST: Charge = { item: "generation_attempt", founder_hours: 0, eng_hours: 1, pilot_slots: 0, days: 0 };

/** Router sees only pre-action observations. Clean standard cases keep the catalogue action. */
export function selectiveRouter(obs: Observation): "catalogue" | "generate" {
  if (obs.verified_standard && !obs.commercial_denied) return "catalogue";
  return obs.sandbox_authorized || obs.probe_available ? "generate" : "catalogue";
}

export function composeSpec(authorizedCaps: readonly string[], terms: string, kind: "read_only_export" | "isolated_sandbox" | "budget_owner_request"): InterventionSpec {
  if (kind === "budget_owner_request") return { capabilities: [], deployment_mode: "read_only_export", evidence_request: "explicit budget-owner approval for exact terms", terms, duration_days: 0, commitment: "none" };
  return { capabilities: authorizedCaps, deployment_mode: kind, evidence_request: kind === "isolated_sandbox" ? "IT confirmation of isolated tenant" : "read-only data export consent", terms, duration_days: 14, commitment: kind === "isolated_sandbox" ? "pilot" : "none" };
}

/** Independent validator: capability and commitment must fit the trusted authority. */
export function validateDraft(d: Draft, authorizedCaps: readonly string[], commercialAuthorized: boolean): Draft {
  const v: string[] = [];
  for (const c of d.spec.capabilities) if (!authorizedCaps.includes(c)) v.push(`capability_not_authorized:${c}`);
  if (d.spec.commitment === "binding" && !commercialAuthorized) v.push("binding_commitment_without_commercial_authority");
  if (d.spec.deployment_mode === "production" && !commercialAuthorized) v.push("production_without_commercial_authority");
  return { ...d, status: v.length ? "rejected" : "validated", violations: v };
}

export function generate(spec: InterventionSpec, opts: { fail?: boolean } = {}): Draft | null {
  if (opts.fail) return null;
  return { status: "draft", spec, artifacts: ["proposal", "evidence_template", "next_step"], violations: [] };
}

/** Generation with catalogue fallback; each cost incurred is charged exactly once. */
export function generateOrFallback(obs: Observation, budget: Budget, spec: InterventionSpec, authorizedCaps: readonly string[], commercialAuthorized: boolean, fallback: GtmAction, cfg: PolicyConfig = DEFAULT_CONFIG, opts: { fail?: boolean } = {}) {
  let l = newLedger(budget);
  if (selectiveRouter(obs) === "catalogue") return { source: "catalogue" as const, action: fallback, draft: null, ledger: charge(l, fallback, cfg.costs) };
  l = chargeRaw(l, GENERATION_COST);
  const d = generate(spec, opts);
  const checked = d ? validateDraft(d, authorizedCaps, commercialAuthorized) : null;
  if (checked?.status === "validated") return { source: "generated" as const, action: null, draft: checked, ledger: l };
  return { source: "fallback" as const, action: fallback, draft: checked, ledger: charge(l, fallback, cfg.costs) };
}

/* ---------- safe action states ---------- */
export type SafeState = "unsafe_conflicting_authority" | "resolvable_missing_evidence" | "clean_eligible_standard" | "unsupported_out_of_model";
export function safeStateOf(reason: string, supported: boolean): SafeState {
  if (!supported) return "unsupported_out_of_model";
  if (reason === "ready_to_launch") return "clean_eligible_standard";
  if (["conflict", "explicit_deny", "revoked", "untrusted_source", "ambiguous_actor_identity"].includes(reason)) return "unsafe_conflicting_authority";
  return "resolvable_missing_evidence";
}
