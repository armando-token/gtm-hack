/** Agent policies. Import boundary: grammar, belief, observation, planner, prng only — never env or evaluation. */
import { clearedFrom, initBelief, predictApprove, update, vetoed, type Prior } from "./belief";
import { GATES, HYPOTHESES, type Gate } from "./grammar";
import { assertPublic, type ObsEvent, type PublicObservation } from "./observation";
import { DEFAULT_PLAN, solveBeam, solveExact, type PlanParams } from "./planner";
import type { SimAction } from "./policy-types";
import { keyedUniform } from "./prng";

export interface Toggles { verified_extraction: boolean; belief_model: boolean; dp_planner: boolean; value_objective: "payment" | "response" }
export interface PolicyCtx { params: PlanParams; seed: string; /** Declared diagnostic channel — only the oracle reads it. */ oracle_hypothesis?: string | undefined }
export type Policy = { id: string; diagnostic?: boolean; decide(obs: PublicObservation, ctx: PolicyCtx): SimAction; predict(obs: PublicObservation, ctx: PolicyCtx): number };

export function admissible(events: ObsEvent[], verified: boolean): ObsEvent[] {
  return verified ? events.map((e) => (e.action === "confirm" && e.source_verified === false ? { ...e, signal: "no_response" as const } : e)) : events;
}
const askedSet = (ev: ObsEvent[]) => new Set(ev.filter((e) => e.action === "confirm").map((e) => e.gate!));
const state = (obs: PublicObservation, ev: ObsEvent[]) => ({ events: ev.filter((e) => e.action === "confirm"), tick: obs.tick, horizon: obs.horizon, hours: obs.hours_left });
const canPropose = (obs: PublicObservation, p: PlanParams) => obs.hours_left >= 1 && obs.tick + p.payDelay <= obs.horizon;
const canConfirm = (obs: PublicObservation) => obs.hours_left >= 2 && obs.tick + 1 < obs.horizon;
function beliefPredict(obs: PublicObservation, ctx: PolicyCtx, verified = true, model = true, prior?: Prior) {
  const ev = admissible(obs.events, verified); const b = model ? update(initBelief(prior ?? ctx.params.prior), ev) : initBelief(prior ?? ctx.params.prior);
  return predictApprove(b, clearedFrom(ev));
}
function guard(obs: PublicObservation) { assertPublic(obs); if (obs.closed || vetoed(obs.events)) return true; return false; }

function scripted(id: string, seq: Gate[]): Policy {
  return { id, decide(obs, ctx) {
    if (guard(obs)) return { type: "stop" };
    const a = askedSet(obs.events); const next = seq.find((g) => !a.has(g));
    if (next && canConfirm(obs) && obs.tick + 1 + ctx.params.payDelay <= obs.horizon) return { type: "confirm", gate: next };
    return canPropose(obs, ctx.params) ? { type: "propose" } : { type: "stop" };
  }, predict: (o, c) => beliefPredict(o, c) };
}

export function eConfig(n: number): Toggles { return { verified_extraction: !!(n & 1), belief_model: !!(n & 2), dp_planner: !!(n & 4), value_objective: "payment" }; }

export function togglePolicy(id: string, t: Toggles): Policy {
  return { id, decide(obs, ctx) {
    if (guard(obs)) return { type: "stop" };
    const ev = admissible(obs.events, t.verified_extraction).filter((e) => e.action === "confirm");
    const prior = ctx.params.prior;
    const st = state(obs, t.belief_model ? ev : ev.map((e) => ({ ...e, dependence_group: "prior-only" })));
    // belief_model=false: collapse all updates into one dependence group → at most one admissible term; prior dominates
    const plan = t.dp_planner ? solveExact(st, { ...ctx.params, prior }) : solveBeam(st, { ...ctx.params, prior }, { depth: 1, maxExpansions: 50 });
    return plan.action;
  }, predict: (o, c) => beliefPredict(o, c, t.verified_extraction, t.belief_model) };
}

export const POLICIES: Record<string, Policy> = {
  exact_dp: { id: "exact_dp", decide: (o, c) => (guard(o) ? { type: "stop" } : solveExact(state(o, admissible(o.events, true)), c.params).action), predict: (o, c) => beliefPredict(o, c) },
  beam: { id: "beam", decide: (o, c) => (guard(o) ? { type: "stop" } : solveBeam(state(o, admissible(o.events, true)), c.params, { depth: 2, maxExpansions: 60 }).action), predict: (o, c) => beliefPredict(o, c) },
  greedy: { id: "greedy", decide: (o, c) => (guard(o) ? { type: "stop" } : solveBeam(state(o, admissible(o.events, true)), c.params, { depth: 1, maxExpansions: 50 }).action), predict: (o, c) => beliefPredict(o, c) },
  fixed_sequence: scripted("fixed_sequence", ["it", "budget", "legal"]),
  spiced: scripted("spiced", ["budget", "it"]),
  random_feasible: { id: "random_feasible", decide(obs, ctx) {
    if (guard(obs)) return { type: "stop" };
    const a = askedSet(obs.events); const opts: SimAction[] = [];
    if (canConfirm(obs)) for (const g of GATES) if (!a.has(g)) opts.push({ type: "confirm", gate: g });
    if (canPropose(obs, ctx.params)) opts.push({ type: "propose" });
    if (!opts.length) return { type: "stop" };
    if (obs.tick + 1 + ctx.params.payDelay > obs.horizon && canPropose(obs, ctx.params)) return { type: "propose" };
    return opts[Math.floor(keyedUniform(ctx.seed, obs.org_id, "rand", obs.tick) * opts.length)]!;
  }, predict: (o, c) => beliefPredict(o, c) },
  deterministic_contingent: { id: "deterministic_contingent", decide(obs, ctx) {
    if (guard(obs)) return { type: "stop" };
    const ev = admissible(obs.events, true).filter((e) => e.action === "confirm"); const last = (g: Gate) => ev.find((e) => e.gate === g)?.signal;
    const roomFor = (n: number) => canConfirm(obs) && obs.tick + n + ctx.params.payDelay <= obs.horizon;
    if (!last("it")) return roomFor(1) ? { type: "confirm", gate: "it" } : canPropose(obs, ctx.params) ? { type: "propose" } : { type: "stop" };
    if (!last("budget") && last("it") !== "required_cleared" && roomFor(1)) return { type: "confirm", gate: "budget" };
    if (!last("budget") && last("it") === "required_cleared" && beliefPredict(obs, ctx) < 0.5 && roomFor(1)) return { type: "confirm", gate: "budget" };
    return canPropose(obs, ctx.params) ? { type: "propose" } : { type: "stop" };
  }, predict: (o, c) => beliefPredict(o, c) },
  catalogue_only: { id: "catalogue_only", decide: (o, c) => (guard(o) ? { type: "stop" } : canPropose(o, c.params) ? { type: "propose" } : { type: "stop" }), predict: (o, c) => beliefPredict(o, c, true, false) },
  oracle: { id: "oracle", diagnostic: true, decide(obs, ctx) {
    if (guard(obs)) return { type: "stop" };
    const prior = Object.fromEntries(HYPOTHESES.map((h) => [h.id, h.id === ctx.oracle_hypothesis ? 1 : 1e-12]));
    return solveExact(state(obs, admissible(obs.events, true)), { ...ctx.params, prior }).action;
  }, predict: (o, c) => beliefPredict(o, c, true, true, Object.fromEntries(HYPOTHESES.map((h) => [h.id, h.id === c.oracle_hypothesis ? 1 : 1e-12]))) },
};
for (let i = 0; i < 8; i++) POLICIES[`E${i}`] = togglePolicy(`E${i}`, eConfig(i));
export const DEFAULT_PARAMS = DEFAULT_PLAN;
