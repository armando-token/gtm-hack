/** Evaluator-side scoring of executed rows against independent gold. Never imported by decision code. */
import gold from "./gold.json";
import { ACTION_BY_ID } from "@/domain/actions";

type Gold = { case_id: string; pair_id: string; variant: string; category: string; valid_actions: string[]; forbidden_actions: string[] };
const GOLD = new Map((gold as Gold[]).map((g) => [g.case_id, g]));
export type Arm = "D" | "C" | "B";
export interface ObservedRow { case_id: string; arm: Arm; action: string; branch: string }

export function scoreRows(rows: readonly ObservedRow[]) {
  const scored = rows.map((r) => {
    const g = GOLD.get(r.case_id);
    if (!g) throw new Error(`no gold for ${r.case_id}`);
    const valid = g.valid_actions.includes(r.action);
    const false_authorize = g.variant === "trap_treatment" && g.forbidden_actions.includes(r.action) && Boolean(ACTION_BY_ID.get(r.action)?.consequential);
    return { ...r, pair_id: g.pair_id, variant: g.variant, category: g.category, valid, false_authorize };
  });
  const arms = (["D", "C", "B"] as const).map((arm) => {
    const a = scored.filter((s) => s.arm === arm);
    const pairs = [...new Set(a.map((s) => s.pair_id))];
    const cats = [...new Set(a.map((s) => s.category))];
    return {
      arm, denominator: a.length, valid: a.filter((s) => s.valid).length,
      traps: a.filter((s) => s.variant === "trap_treatment").length, false_authorize: a.filter((s) => s.false_authorize).length,
      pairs_total: pairs.length, pairs_ok: pairs.filter((p) => a.filter((s) => s.pair_id === p).every((s) => s.valid)).length,
      categories: cats.map((c) => ({ category: c, valid: a.filter((s) => s.category === c && s.valid).length, total: a.filter((s) => s.category === c).length })),
    };
  });
  return { rows: scored, arms };
}
