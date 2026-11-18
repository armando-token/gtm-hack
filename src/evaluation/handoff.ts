/** Phase 10 handoff metadata. Recorded test results are labeled with the command and date that produced them. */
export const DATA_ORIGIN = {
  note: "Original research inputs (15_PROCEDENCIA_DE_DATOS.md). The public 24-case block removes private_state_summary, so its hash intentionally differs.",
  sources: [
    { path: "benchmark/cases.jsonl", bytes: 68587, sha256: "dd3d4fbd10eadff8d48f37da70bf149e231323f4b075b0e9bf5e271eee083052" },
    { path: "benchmark/expected.jsonl", bytes: 9336, sha256: "6839b2d28495afb70b6a917af7fe5afc98d286798f62e27f8aae9234e75fdb66" },
    { path: "benchmark/configs/benchmark_manifest.json", bytes: 3198, sha256: "bd5b18ef213ecf3484a36f6ec62b2ab301e40575bbaf50ab5d41ad51db07b74e" },
    { path: "mve_retrospective_20_opportunities_v2.jsonl", bytes: 92340, sha256: "c0a7d631d40af580d1c96b7a56e578c0f03b46863ecb50f79fd498736834aa79" },
    { path: "mve_feasibility_results_v2.json", bytes: 39470, sha256: "a5e7358f136e656d4c17fd933051a5deb28d1d15d5679aca79fbcd179a38a831" },
  ],
  identities: { source_header: "571f9fa", sealed_evaluated: "632a084", sealed_published: "651dfbc" },
  assertions: ["synthetic simulator outcomes never increment real counters", "real field observations: 0/20", "historical numbers are stored only in src/evaluation/history.ts"],
} as const;

export const RECORDED_TESTS = {
  origin: "recorded_test_output" as const,
  command: "bunx vitest run",
  recorded_at: "2026-11-18",
  base_revision: "5618a4b (+ phase 07/10 working tree)",
  files: 12, tests: 119, passed: 119,
  backend_scope: "X01–X07 and C01–C06 ran against the real Lovable Cloud database (row lock, idempotency, stale version, concurrent revoke, crash-after-commit, rollback)",
  simulator_scope: "R01–R10 (src/test/phase07-sim.test.ts)",
};

export const FIDELITY = {
  functional_core_parity: true,
  research_protocol_parity: false,
  historical_numeric_parity: false,
  real_field_validated: false,
  reasons: {
    research_protocol_parity: "Generators, predictors and planners are rebuilt with a new grammar and PRNG; MCTS replaced by bounded beam expectimax; G4/G5 factory arms not rebuilt in the simulator.",
    historical_numeric_parity: "Original corpus/generator/PRNG not reproduced (D23).",
    real_field_validated: "0 real observations (D24).",
  },
};

export const PENDING_COMPONENTS = [
  { id: "D10/D13", what: "Predictor families are the belief model vs pooled base rate only; original G2 trained families not rebuilt", impact: "Prediction panel shows per-family Brier for this simpler model" },
  { id: "D12", what: "MCTS not rebuilt (beam expectimax instead)", impact: "Regret vs exact reported for beam only" },
  { id: "D20", what: "Simulation cancel/resume uses an in-browser checkpoint, not a durable worker lease", impact: "A page reload loses a cancelled simulation run" },
  { id: "D23", what: "Historical numeric parity", impact: "Historical +39.90% / 52.62/100 remain labeled history" },
  { id: "D24", what: "Real commercial efficacy", impact: "Field screen stays 0/20 and HOLD" },
  { id: "Security", what: "Server functions are callable without sign-in (random session ids only)", impact: "Anyone with the link can run the sandbox" },
];
