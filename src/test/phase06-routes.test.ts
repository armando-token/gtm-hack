import { describe, expect, it } from "vitest";
import cases from "@/server/fixtures/public-cases.json";
import { PublicCaseSchema, type AuthorityRecord } from "@/domain/contracts";
import { decideD } from "@/domain/decide";
import {
  DEFAULT_COSTS, composeSpec, contingentPolicy, feasibility, freezeCosts, generateOrFallback, greedyBaseline, newLedger, safeStateOf, validateDraft,
  type Budget, type Observation,
} from "@/domain/intervention";
import { recallAndRetention } from "@/evaluation/detector";

const all = (cases as unknown[]).map((c) => PublicCaseSchema.parse(c));
const byId = (id: string) => structuredClone(all.find((c) => c.case_id === id)!);
const B: Budget = { founder_hours: 20, founder_daily: 4, eng_hours: 20, pilot_slots: 2, days_left: 20, assets: [] };
const O: Observation = { verified_standard: false, commercial_denied: false, sandbox_authorized: false, isolated_eligible: true, deferred_eligible: true, probe_available: true, probe_informative: true };

describe("phase 06 contingent routes", () => {
  it("costs table matches spec and is frozen per run", () => {
    expect([DEFAULT_COSTS.standard_offer.founder_hours, DEFAULT_COSTS.standard_offer.days]).toEqual([1, 2]);
    expect([DEFAULT_COSTS.isolated_pilot.founder_hours, DEFAULT_COSTS.isolated_pilot.days]).toEqual([3, 3]);
    expect([DEFAULT_COSTS.deferred_invoice.founder_hours, DEFAULT_COSTS.deferred_invoice.days]).toEqual([2, 3]);
    expect([DEFAULT_COSTS.isolated_deferred.founder_hours, DEFAULT_COSTS.isolated_deferred.days]).toEqual([4, 4]);
    expect([DEFAULT_COSTS.request_it_authorization.founder_hours, DEFAULT_COSTS.request_budget_authorization.days]).toEqual([1, 1]);
    expect(Object.isFrozen(freezeCosts({}).standard_offer)).toBe(true);
  });
  it("P01 commercial denied + permitted sandbox → technical alternative, zero commercial effect", async () => {
    const r = contingentPolicy({ ...O, commercial_denied: true, sandbox_authorized: true }, B, () => "yes");
    expect(r.route).toBe("isolated_pilot");
    expect(r.commercial_effects).toBe(0);
    const d = await decideD(byId("MP03-B"));
    expect(d.action).toBe("request_budget_owner_signoff_or_run_sandbox");
    expect(d.dispatch_committed).toBe(false);
  });
  it("P02 insufficient capacity rejects candidate and charges only actual work", () => {
    expect(feasibility(newLedger({ ...B, pilot_slots: 0 }), "isolated_pilot", DEFAULT_COSTS)).toEqual({ ok: false, reason: "no_live_pilot_slot" });
    expect(feasibility(newLedger({ ...B, eng_hours: 3 }), "isolated_pilot", DEFAULT_COSTS)).toEqual({ ok: false, reason: "insufficient_engineering_hours" });
    expect(feasibility(newLedger({ ...B, founder_daily: 0.5 }), "isolated_pilot", DEFAULT_COSTS)).toEqual({ ok: false, reason: "insufficient_daily_founder_capacity" });
    const r = contingentPolicy(O, { ...B, pilot_slots: 0 }, () => "yes");
    expect(r.rejected).toContainEqual({ action: "isolated_pilot", reason: "no_live_pilot_slot" });
    expect(r.route).toBe("request_budget_authorization");
    expect(r.ledger.charges.map((c) => c.item)).toEqual(["request_it_authorization", "request_budget_authorization"]);
    expect(r.ledger.remaining.founder_hours).toBe(18);
  });
  it("probe branches: yes → isolated (asset built once), no → deferred, silent → safe default; greedy never probes", () => {
    const yes = contingentPolicy(O, B, () => "yes");
    expect(yes.route).toBe("isolated_pilot");
    expect(yes.ledger.charges.filter((c) => c.item.startsWith("asset_build")).length).toBe(1);
    expect(contingentPolicy(O, B, () => "no").route).toBe("deferred_invoice");
    expect(contingentPolicy(O, B, () => "silent").reason).toBe("probe_silent_safe_default");
    expect(greedyBaseline(O, B).steps).not.toContain("request_it_authorization");
  });
  it("P03 selective generation keeps catalogue action in a clean standard case", () => {
    const r = generateOrFallback({ ...O, verified_standard: true }, B, composeSpec([], "t", "isolated_sandbox"), [], true, "standard_offer");
    expect(r.source).toBe("catalogue");
    expect(r.ledger.charges.map((c) => c.item)).toEqual(["standard_offer"]);
  });
  it("P04 forced generation failure + fallback charges each cost exactly once", () => {
    const r = generateOrFallback(O, B, composeSpec(["approve_sandbox"], "t", "isolated_sandbox"), ["approve_sandbox"], false, "request_budget_authorization", undefined, { fail: true });
    expect(r.source).toBe("fallback");
    expect(r.ledger.charges.map((c) => c.item)).toEqual(["generation_attempt", "request_budget_authorization"]);
    expect(r.ledger.remaining.founder_hours).toBe(19);
    expect(r.ledger.remaining.eng_hours).toBe(19);
  });
  it("P05 uninformative evidence keeps ambiguity and yields a specific confirmation/wait action", async () => {
    const r = contingentPolicy({ ...O, probe_informative: false }, B, () => "inconclusive");
    expect(r.route).toBe("request_budget_authorization");
    expect(safeStateOf("candidate_only_no_authority", true)).toBe("resolvable_missing_evidence");
    expect(safeStateOf("conflict", true)).toBe("unsafe_conflicting_authority");
    expect(safeStateOf("ready_to_launch", true)).toBe("clean_eligible_standard");
    expect(safeStateOf("ready_to_launch", false)).toBe("unsupported_out_of_model");
  });
  it("P06 altering identity, source or terms changes policy through verification", async () => {
    const c = byId("CF-01A");
    expect((await decideD(c)).action).toBe("prepare_proposal_2000_users");
    const actor = structuredClone(c); (actor.target_key as { actor: string }).actor = "act-someone-else";
    const src = structuredClone(c); for (const r of src.service_records as AuthorityRecord[]) (r as { source: string }).source = "crm_note";
    const terms = structuredClone(c); (terms.target_key as { terms_digest: string }).terms_digest = "terms-other";
    for (const m of [actor, src, terms]) expect((await decideD(m)).action).toBe("confirm_expansion_and_review_pilot_500");
  });
  it("P07 forbidden capability in generated draft fails the independent validator", () => {
    const d = validateDraft({ status: "draft", spec: { ...composeSpec(["approve_spend"], "t", "isolated_sandbox"), commitment: "binding" }, artifacts: [], violations: [] }, ["approve_sandbox"], false);
    expect(d.status).toBe("rejected");
    expect(d.violations).toEqual(["capability_not_authorized:approve_spend", "binding_commitment_without_commercial_authority"]);
  });
  it("detector: trap recall and clean retention computed together", () => {
    expect(recallAndRetention([{ score: 0.9, is_trap: true }, { score: 0.2, is_trap: true }, { score: 0.1, is_trap: false }, { score: 0.7, is_trap: false }], 0.5))
      .toMatchObject({ trap_recall: 0.5, clean_retention: 0.5 });
  });
});
