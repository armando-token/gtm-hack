/** Prediction scoring: reference (pooled base rate) vs belief candidate, calibrated only on dev/cal; per-family decisions. */
import { brier, logLoss } from "./belief";
import type { Prediction } from "./runner";

const matured = (ps: Prediction[]) => ps.filter((p) => p.y !== null) as (Prediction & { y: 0 | 1 })[];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function fitAndScore(dev: Prediction[], cal: Prediction[], evalSet: Prediction[], margin = 0.0) {
  const d = matured(dev), c = matured(cal), e = matured(evalSet);
  const base = mean(d.map((x) => x.y)) ?? 0.5;
  let alpha = 1, best = Infinity;
  for (let a = 0; a <= 1.0001; a += 0.1) { const s = mean(c.map((x) => brier(a * x.p + (1 - a) * base, x.y))) ?? Infinity; if (s < best - 1e-12) { best = s; alpha = +a.toFixed(1); } }
  const families = [...new Set(e.map((x) => x.family))].sort();
  const perFamily = families.map((f) => {
    const xs = e.filter((x) => x.family === f);
    let online = base, n = 0; const pooledOnline: number[] = [];
    for (const x of xs) { pooledOnline.push(brier(online, x.y)); n++; online = online + (x.y - online) / (n + 10); }
    const cand = mean(xs.map((x) => brier(alpha * x.p + (1 - alpha) * base, x.y)))!, ref = mean(xs.map((x) => brier(base, x.y)))!, po = mean(pooledOnline)!;
    const decision = cand <= ref + margin ? "candidate" : "fallback_reference";
    return { family: f, n: xs.length, brier_candidate: cand, brier_reference: ref, brier_pooled_online: po,
      logloss_candidate: mean(xs.map((x) => logLoss(alpha * x.p + (1 - alpha) * base, x.y)))!, logloss_reference: mean(xs.map((x) => logLoss(base, x.y)))!,
      decision, pooled_comparator_better: po < Math.min(cand, ref) };
  });
  return { reference_base_rate: base, calibrated_alpha: alpha, fit_sets: { development: d.length, calibration: c.length }, eval_matured: e.length, eval_pending: evalSet.length - e.length, per_family: perFamily };
}
