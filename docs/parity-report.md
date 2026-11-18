# Parity report · gtm-lovable-rebuild-v1 (phase 10 handoff, 2026-11-18)

TypeScript rewrite on TanStack Start + Lovable Cloud. Module implementation, behavioral parity, numeric benchmark parity and real-field validity are independent statuses.
Evidence runs this turn: `bunx vitest run` 12 files / 119 tests passed; browser benchmark run-24-6d27244a30 (D 24/24, C 14/24, B 13/24); simulation content hash 206598fa5e8b7f21 (30 worlds, cancel at 10 → resume, same hash as an uninterrupted run).

| capability_id | phase | owner_module | status | check_ids | evidence_run_id | actual_output | reference_output | difference | next_step |
|---|---|---|---|---|---|---|---|---|---|
| D01 | 01 | src/domain/contracts.ts | VERIFIED | B01–B05 | vitest 2026-11-18 | pass | contract | — | — |
| D02 | 02 | src/domain/evidence.ts | VERIFIED | E01–E08 | vitest | pass | contract | — | — |
| D03 | 02 | src/domain/evidence.ts | PARTIAL | E02 | vitest | fixture mutations pass | 882/882 corpus C | corpus not rebuilt | rebuild held-out corpus |
| D04 | 02 | src/domain/authority.ts | VERIFIED | A01–A10 | vitest | pass | contract | — | — |
| D05 | 02–03 | authority.ts, execution.ts | VERIFIED | A09, X01–X03 | vitest + browser CF-01B/CF-02B | CF-01B blocks terms_digest, offers pilot 500 | expected labels | — | — |
| D06 | 03 | gtm_commit_dispatch (DB) | VERIFIED | X02–X07 | vitest vs real backend | one effect, revoke wins, rollback clean | contract | tenant isolation not separately tested | add cross-tenant probe |
| D07 | 03 | src/domain/execution.ts | PARTIAL | X08–X10 | vitest (domain) | pass | contract | no persisted receipt flow | persist receipts |
| D08 | 05–06 | src/domain/policy.ts, decide.ts, sim/policies.ts | VERIFIED | P01–P07 | vitest | pass | protocol | — | — |
| D09 | 06 | src/domain/intervention.ts | PARTIAL | P01–P07 | vitest | ledger/selective gen pass | G4 C0–C5 arms | factory arms not in simulator | add C-arms to sim |
| D10 | 07 | sim/belief.ts, sim/inference.ts | PARTIAL | R07, R08 | vitest + browser | per-family Brier, fallback + pooled comparator | G2 trained families | simpler predictor family | rebuild G2 families |
| D11 | 07 | sim/env.ts, sim/observation.ts | VERIFIED | R01–R03, R05, R07 | vitest phase07-sim | pass | protocol | — | — |
| D12 | 07 | sim/planner.ts | PARTIAL | R04 | vitest | DP = hand controls; beam within budget, regret ≥ 0 | DP + MCTS | MCTS replaced by beam expectimax | optional MCTS |
| D13 | 07 | sim/transfer.ts | VERIFIED | R06 | vitest | held-out invariant, novel → confirmation route | protocol | — | — |
| D14 | 07 | sim/policies.ts (E0–E7) | VERIFIED (structure) | toggles | browser + script | E-bits wired, paired export | historical E7 | numeric parity UNVERIFIED | — |
| D15 | 05 | src/domain/decide.ts, evaluation/full-run.ts | VERIFIED | Q01–Q07 | run-24-6d27244a30 | D 24/24, 0/12 false auth, 12/12 pairs; C 14/24; B 13/24 | same | none | — |
| D16 | 04,09,10 | src/routes/demo.tsx | VERIFIED | U01–U03 | browser 2026-11-18 | CF-01A allow 2000; CF-01B block→pilot 500; CF-02B revoked, 0 effects; persists after reload | expected | after reload the headline re-evaluates at t100 while timeline keeps the blocked dispatch | show last dispatch outcome in headline |
| D17 | 08 | src/domain/field.ts, business-clock.ts | VERIFIED | F01–F07 | vitest | 14/20, 1/13, 12/13 | same | — | — |
| D18 | 08 | src/domain/field.ts | VERIFIED | intake | vitest + browser | 0 / 20 | 0/20 | — | — |
| D19 | 08 | src/domain/field.ts | VERIFIED | pilot gate | browser | HOLD | HOLD | — | — |
| D20 | 03,07 | DB RPC + sim/runner.ts | PARTIAL | X06, R09 | vitest | crash/replay single effect; sim resume no duplicates | durable workers | sim checkpoint in memory, no DB worker lease | durable worker |
| D21 | 04,09 | routes/* | VERIFIED | U01–U08 | browser (phase 09 + this turn) | no page errors | — | — | — |
| D22 | 05,10 | EvidenceBundle.tsx | VERIFIED | export | browser | bundle with scorecard, sim, manifest, tests, origin | — | software revision is engine label, not git SHA | — |
| D23 | 07,10 | evaluation/history.ts | UNVERIFIED | R10 | — | history stored only | +39.90%, +40.97%, 52.62/100 | new generator/PRNG | reconstruct original corpus |
| D24 | field | — | PENDING | — | — | 0 real observations | — | — | permitted real study |

## Differences from the Python reference (phase 07)
- New PRNG (sfc32 seeded by FNV-1a) and new world grammar → new experiment protocol; numeric results are not comparable to the Python study.
- MCTS not rebuilt; a bounded depth-limited expectimax ("beam") is identified per run.
- G2 predictor families replaced by one log-space belief model, a pooled base-rate reference and a pooled-online comparator; calibration is a single shrink weight fit on calibration seeds.
- E0–E7 = 3 toggles (verified extraction, belief model, exact planner); value objective is fixed to payment.
- Bootstrap default 500 replicates in the UI (protocol 2000) for interaction speed; denominator shown.
