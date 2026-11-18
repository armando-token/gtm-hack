/** Exact finite-horizon DP and bounded approximate search over the public belief model. */
import { clearedFrom, initBelief, predictApprove, predictSignal, update, vetoed, type Prior } from "./belief";
import { CONFIRM_SIGNALS, GATES, type Gate } from "./grammar";
import type { ObsEvent } from "./observation";
import type { SimAction } from "./policy-types";

export interface PlanParams { hourPenalty: number; payDelay: number; prior?: Prior | undefined }
export const DEFAULT_PLAN: PlanParams = { hourPenalty: 0.035, payDelay: 1 };
export interface PlanState { events: ObsEvent[]; tick: number; horizon: number; hours: number }

const asked = (ev: ObsEvent[]) => new Set(ev.filter((e) => e.action === "confirm").map((e) => e.gate!));
function proposeValue(s: PlanState, p: PlanParams) {
  if (s.hours < 1 || s.tick + p.payDelay > s.horizon) return -Infinity;
  const b = update(initBelief(p.prior), s.events); return predictApprove(b, clearedFrom(s.events)) - p.hourPenalty;
}
function confirmable(s: PlanState): Gate[] { const a = asked(s.events); return s.hours >= 2 && s.tick + 1 < s.horizon ? GATES.filter((g) => !a.has(g)) : []; }
function child(s: PlanState, g: Gate, sig: (typeof CONFIRM_SIGNALS)[number]): PlanState {
  return { events: [...s.events, { tick: s.tick, action: "confirm", gate: g, signal: sig }], tick: s.tick + 1, horizon: s.horizon, hours: s.hours - 1 };
}

export interface Plan { action: SimAction; value: number; q: { action: string; value: number }[]; expansions: number; implementation: string }

export function solveExact(s: PlanState, p: PlanParams = DEFAULT_PLAN): Plan {
  const memo = new Map<string, number>(); let expansions = 0;
  const V = (st: PlanState): number => {
    if (vetoed(st.events) || st.tick >= st.horizon) return 0;
    const key = JSON.stringify([st.events.map((e) => [e.gate, e.signal]), st.tick, st.hours]);
    const m = memo.get(key); if (m !== undefined) return m; expansions++;
    let best = Math.max(0, proposeValue(st, p));
    const b = update(initBelief(p.prior), st.events);
    for (const g of confirmable(st)) {
      const ps = predictSignal(b, g); let v = -p.hourPenalty;
      for (const sig of CONFIRM_SIGNALS) if (ps[sig] > 0) v += ps[sig] * V(child(st, g, sig));
      best = Math.max(best, v);
    }
    memo.set(key, best); return best;
  };
  const q: { action: string; value: number }[] = [{ action: "stop", value: 0 }];
  const pv = proposeValue(s, p); if (pv > -Infinity) q.push({ action: "propose", value: pv });
  if (!(vetoed(s.events) || s.tick >= s.horizon)) {
    const b = update(initBelief(p.prior), s.events);
    for (const g of confirmable(s)) { const ps = predictSignal(b, g); let v = -p.hourPenalty; for (const sig of CONFIRM_SIGNALS) if (ps[sig] > 0) v += ps[sig] * V(child(s, g, sig)); q.push({ action: `confirm:${g}`, value: v }); }
  }
  const best = q.reduce((a, x) => (x.value > a.value + 1e-12 ? x : a), q[0]!);
  return { action: toAction(best.action), value: best.value, q, expansions, implementation: "exact_dp" };
}

/** Bounded depth-limited expectimax with an expansion budget; leaves use the myopic propose/stop value. Stable tie rule = first in action order. */
export function solveBeam(s: PlanState, p: PlanParams = DEFAULT_PLAN, opts = { depth: 1, maxExpansions: 200 }): Plan {
  let expansions = 0;
  const leaf = (st: PlanState) => (vetoed(st.events) || st.tick >= st.horizon ? 0 : Math.max(0, proposeValue(st, p)));
  const V = (st: PlanState, d: number): number => {
    if (d <= 0 || expansions >= opts.maxExpansions) return leaf(st);
    if (vetoed(st.events) || st.tick >= st.horizon) return 0;
    expansions++;
    let best = leaf(st); const b = update(initBelief(p.prior), st.events);
    for (const g of confirmable(st)) { const ps = predictSignal(b, g); let v = -p.hourPenalty; for (const sig of CONFIRM_SIGNALS) if (ps[sig] > 0) v += ps[sig] * V(child(st, g, sig), d - 1); best = Math.max(best, v); }
    return best;
  };
  const q: { action: string; value: number }[] = [{ action: "stop", value: 0 }];
  const pv = proposeValue(s, p); if (pv > -Infinity) q.push({ action: "propose", value: pv });
  if (!(vetoed(s.events) || s.tick >= s.horizon)) {
    const b = update(initBelief(p.prior), s.events);
    for (const g of confirmable(s)) { const ps = predictSignal(b, g); let v = -p.hourPenalty; for (const sig of CONFIRM_SIGNALS) if (ps[sig] > 0) v += ps[sig] * V(child(s, g, sig), opts.depth - 1); q.push({ action: `confirm:${g}`, value: v }); }
  }
  const best = q.reduce((a, x) => (x.value > a.value + 1e-12 ? x : a), q[0]!);
  return { action: toAction(best.action), value: best.value, q, expansions, implementation: `beam_expectimax(depth=${opts.depth},max=${opts.maxExpansions})` };
}
export function toAction(a: string): SimAction { return a.startsWith("confirm:") ? { type: "confirm", gate: a.slice(8) as Gate } : a === "propose" ? { type: "propose" } : { type: "stop" }; }
/** Regret of approximate root choice evaluated by the exact Q function. */
export function approxRegret(s: PlanState, p: PlanParams = DEFAULT_PLAN, opts?: { depth: number; maxExpansions: number }) {
  const ex = solveExact(s, p), ap = solveBeam(s, p, opts);
  const key = ap.action.type === "confirm" ? `confirm:${ap.action.gate}` : ap.action.type;
  const qa = ex.q.find((x) => x.action === key)?.value ?? 0;
  return { exact: ex.value, approx_choice_exact_q: qa, regret: ex.value - qa, approx_expansions: ap.expansions, budget: opts?.maxExpansions ?? 200 };
}
