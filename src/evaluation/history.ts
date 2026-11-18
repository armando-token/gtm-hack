/** Prior research — historical origin only. Never mixed with current-run results. */
export const PRIOR_RESEARCH = {
  origin: "historical" as const,
  run_id: "r2-sealed-eb41454c3fb8",
  reference_revision: "571f9fa503eba1b86c2f695c84823076856a9805",
  evaluated_revision: "632a084",
  published_revision: "651dfbc",
  arms: [
    { arm: "D", label: "Exact GTM", valid: 24, total: 24 },
    { arm: "C", label: "Superficial rules", valid: 14, total: 24 },
    { arm: "B", label: "Local Boolean proxy", valid: 13, total: 24 },
  ],
} as const;

/** Sealed prior-study gates (13_REFERENCIA_HISTORICA.md). Fixed documented numbers — historical origin only. */
export const PRIOR_GATES = {
  origin: "historical" as const,
  run_id: "r2-sealed-eb41454c3fb8",
  reference_head: "571f9fa503eba1b86c2f695c84823076856a9805",
  publication: "651dfbc414422dd70ff723714b53dfedc77bb47b",
  gates: [
    { gate: "G0", result: "0 leaks, 60/60 blocked probes, 300/300 A/A, 1410/1410 permutations, 144/144 twins", meaning: "Simulator isolation and replay checks" },
    { gate: "G1 corpus C", result: "882/882 strict precision/recall, 0 false authority", meaning: "Exact result on this corpus" },
    { gate: "G1 scope", result: "0/881 FP units, 0/684 FP clusters, 311/311 precision, 252/252 provable-cluster recall", meaning: "Different endpoint from text extraction; all-positive cluster recall 252/290" },
    { gate: "G2", result: "PARTIAL_WITH_FALLBACK", meaning: "Per-family choices and fallback; not uniformly superior" },
    { gate: "G3", result: "E7 50.4583/100 vs greedy 36.0667/100; lift 39.903%", meaning: "D01, 12,000 synthetic organizations" },
    { gate: "G3 simpler policy", result: "Contingent 50.8417/100; E7 − contingent −0.3833, 95% CI [−0.6667, −0.0917]", meaning: "Contingent retained" },
    { gate: "G4", result: "C4 52.6167/100 vs C0 44.0583; Δ 8.5584, 95% CI [7.45, 9.7083]", meaning: "Frozen 25% eligible mix, 12,000 organizations" },
    { gate: "G4 catalogue planner", result: "C1 49.6667/100; C4 − C1 = 2.95", meaning: "Equal capacity caps, possibly different actual hours" },
    { gate: "G5", result: "537/540 traps; 506/540 clean retained; 0/270 severe; 54/54 K14", meaning: "Scoped synthetic safety endpoints" },
    { gate: "G6", result: "60/60 R1 recovery, 450/450 R2 boundary faults, 0 duplicate/unverified effects", meaning: "Recovery under the tested simulated destination" },
    { gate: "Operational recalculation", result: "14/20 timely; 12/13 with ≤1 request sent; 1/13 valid verified at cutoff", meaning: "Confirmation gate failed at 7.69% vs 75% target" },
  ],
  d01: [
    { policy: "Contingent (retained)", per100: 50.8417 },
    { policy: "Adaptive E7", per100: 50.4583 },
    { policy: "Greedy catalogue", per100: 36.0667 },
  ],
} as const;
