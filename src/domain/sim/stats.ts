import { sfc32 } from "./prng";
export function wilson(k: number, n: number, z = 1.96) {
  if (!n) return { lo: null, hi: null };
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return { lo: (c - r) / d, hi: (c + r) / d };
}
/** Paired world-level bootstrap of mean difference (per-100 units). */
export function pairedBootstrap(diffs: number[], replicates: number, seed: string) {
  if (!diffs.length) return { mean: null, lo: null, hi: null, replicates };
  const rng = sfc32(seed); const n = diffs.length; const means: number[] = [];
  for (let r = 0; r < replicates; r++) { let s = 0; for (let i = 0; i < n; i++) s += diffs[Math.floor(rng() * n)]!; means.push(s / n); }
  means.sort((a, b) => a - b);
  return { mean: diffs.reduce((a, b) => a + b, 0) / n, lo: means[Math.floor(0.025 * replicates)]!, hi: means[Math.min(replicates - 1, Math.floor(0.975 * replicates))]!, replicates };
}
