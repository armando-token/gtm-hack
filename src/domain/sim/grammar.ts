/** Bounded finite hypothesis grammar: AND / OR / single / veto / order / none / unknown. Public (no truth). */
export const GATES = ["it", "budget", "legal"] as const;
export type Gate = (typeof GATES)[number];
export type HypKind = "AND" | "OR" | "SINGLE" | "VETO" | "ORDER" | "NONE" | "UNKNOWN";
export interface Hypothesis { id: string; kind: HypKind; gates: Gate[]; family: string }

export function enumerateHypotheses(): Hypothesis[] {
  const out: Hypothesis[] = [{ id: "NONE", kind: "NONE", gates: [], family: "none" }, { id: "UNKNOWN", kind: "UNKNOWN", gates: [], family: "unknown_mechanism" }];
  for (const g of GATES) out.push({ id: `SINGLE(${g})`, kind: "SINGLE", gates: [g], family: "single" }, { id: `VETO(${g})`, kind: "VETO", gates: [g], family: "veto" });
  for (let i = 0; i < GATES.length; i++) for (let j = 0; j < GATES.length; j++) {
    if (i === j) continue; const a = GATES[i]!, b = GATES[j]!;
    if (i < j) out.push({ id: `AND(${a},${b})`, kind: "AND", gates: [a, b], family: "and" }, { id: `OR(${a},${b})`, kind: "OR", gates: [a, b], family: "or" });
    out.push({ id: `ORDER(${a}>${b})`, kind: "ORDER", gates: [a, b], family: "order" });
  }
  return out;
}
export const HYPOTHESES = enumerateHypotheses();

/** Observation symbols an agent can see. */
export type ConfirmSignal = "required_cleared" | "not_required" | "no_response" | "veto";
export type ProposeSignal = "approved" | "rejected";

export const LIK = { q_rel: 0.75, q_irr: 0.7, veto_p: 0.3, approve_sat: 0.7, approve_unsat: 0.0, approve_unknown: 0.3 } as const;

export function isRelevant(h: Hypothesis, g: Gate) { return h.gates.includes(g); }

/** P(signal | h, gate). Order matters only for satisfaction, never for single-gate response. */
export function confirmLikelihood(h: Hypothesis, g: Gate, s: ConfirmSignal): number {
  if (h.kind === "UNKNOWN") return s === "veto" ? 0.05 : s === "no_response" ? 0.35 : 0.3;
  if (h.kind === "VETO" && isRelevant(h, g)) return s === "veto" ? LIK.veto_p : s === "required_cleared" ? (1 - LIK.veto_p) * LIK.q_rel : s === "no_response" ? (1 - LIK.veto_p) * (1 - LIK.q_rel) : 0;
  if (isRelevant(h, g)) return s === "required_cleared" ? LIK.q_rel : s === "no_response" ? 1 - LIK.q_rel : 0;
  return s === "not_required" ? LIK.q_irr : s === "no_response" ? 1 - LIK.q_irr : 0;
}
export const CONFIRM_SIGNALS: ConfirmSignal[] = ["required_cleared", "not_required", "no_response", "veto"];

/** Are the hypothesis' gates satisfied by the sequence of cleared gates (in order)? */
export function satisfied(h: Hypothesis, cleared: Gate[]): boolean {
  const has = (g: Gate) => cleared.includes(g);
  switch (h.kind) {
    case "NONE": return true;
    case "UNKNOWN": return false;
    case "SINGLE": case "VETO": return has(h.gates[0]!);
    case "AND": return has(h.gates[0]!) && has(h.gates[1]!);
    case "OR": return has(h.gates[0]!) || has(h.gates[1]!);
    case "ORDER": { const i = cleared.indexOf(h.gates[0]!), j = cleared.indexOf(h.gates[1]!); return i >= 0 && j >= 0 && i < j; }
  }
}
export function approveProb(h: Hypothesis, cleared: Gate[]): number {
  if (h.kind === "UNKNOWN") return LIK.approve_unknown;
  return satisfied(h, cleared) ? LIK.approve_sat : LIK.approve_unsat;
}
