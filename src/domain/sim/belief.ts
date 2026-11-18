/** Log-space belief over the finite grammar; dependence groups counted once; ambiguity sets retained. */
import { CONFIRM_SIGNALS, HYPOTHESES, approveProb, confirmLikelihood, satisfied, type ConfirmSignal, type Gate, type Hypothesis } from "./grammar";
import type { ObsEvent } from "./observation";

export type Prior = Record<string, number>;
export const DECLARED_PRIOR: Prior = Object.fromEntries(HYPOTHESES.map((h) => [h.id, h.kind === "UNKNOWN" ? 0.1 : h.kind === "NONE" ? 0.06 : 0.84 / (HYPOTHESES.length - 2)]));

export interface Belief { logw: number[]; hyps: Hypothesis[] }
export function logSumExp(xs: number[]) { const m = Math.max(...xs); if (m === -Infinity) return -Infinity; return m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0)); }
export function initBelief(prior: Prior = DECLARED_PRIOR, hyps = HYPOTHESES): Belief {
  const lw = hyps.map((h) => Math.log(prior[h.id] ?? 1e-12)); const z = logSumExp(lw); return { hyps, logw: lw.map((x) => x - z) };
}
export function probs(b: Belief) { return b.logw.map(Math.exp); }

export function update(b: Belief, events: ObsEvent[]): Belief {
  const seen = new Set<string>(); const lw = [...b.logw];
  for (const e of events) {
    if (e.dependence_group) { if (seen.has(e.dependence_group)) continue; seen.add(e.dependence_group); }
    if (e.action === "confirm" && e.gate) b.hyps.forEach((h, i) => { lw[i] = lw[i]! + Math.log(Math.max(confirmLikelihood(h, e.gate!, e.signal as ConfirmSignal), 1e-300)); });
  }
  const z = logSumExp(lw); return { hyps: b.hyps, logw: lw.map((x) => x - z) };
}
export function clearedFrom(events: ObsEvent[]): Gate[] {
  return events.filter((e) => e.action === "confirm" && (e.signal === "required_cleared" || e.signal === "not_required")).map((e) => e.gate!);
}
export function vetoed(events: ObsEvent[]) { return events.some((e) => e.signal === "veto"); }
export function predictApprove(b: Belief, cleared: Gate[]): number { const p = probs(b); return b.hyps.reduce((s, h, i) => s + p[i]! * approveProb(h, cleared), 0); }
export function predictSignal(b: Belief, g: Gate): Record<ConfirmSignal, number> {
  const p = probs(b); const out = Object.fromEntries(CONFIRM_SIGNALS.map((s) => [s, 0])) as Record<ConfirmSignal, number>;
  b.hyps.forEach((h, i) => CONFIRM_SIGNALS.forEach((s) => { out[s] += p[i]! * confirmLikelihood(h, g, s); })); return out;
}
/** Hypotheses with non-negligible mass that share the top hypothesis' signal signature and posterior (indistinguishable). */
export function ambiguitySet(b: Belief, threshold = 1e-3): string[] {
  const p = probs(b); const idx = b.hyps.map((_, i) => i).filter((i) => p[i]! > threshold);
  if (!idx.length) return [];
  const top = idx.reduce((a, i) => (p[i]! > p[a]! ? i : a), idx[0]!);
  const gates: Gate[] = ["it", "budget", "legal"];
  const sig = (h: Hypothesis) => gates.map((g) => CONFIRM_SIGNALS.map((s) => confirmLikelihood(h, g, s).toFixed(6)).join(",")).join(";");
  const ts = sig(b.hyps[top]!);
  return idx.filter((i) => sig(b.hyps[i]!) === ts && Math.abs(p[i]! - p[top]!) < 1e-9).map((i) => b.hyps[i]!.id);
}
export function isSatisfiedUnder(h: Hypothesis, cleared: Gate[]) { return satisfied(h, cleared); }

export function brier(p: number, y: 0 | 1) { return (p - y) ** 2; }
export function logLoss(p: number, y: 0 | 1) { const q = Math.min(1 - 1e-6, Math.max(1e-6, p)); return -(y * Math.log(q) + (1 - y) * Math.log(1 - q)); }
