# Rebuild status · gtm-lovable-rebuild-v1

Origins are kept separate: historical reference = run `r2-sealed-eb41454c3fb8` (src/evaluation/history.ts); current runs = src/evaluation/current-run.ts (starts unexecuted).

## Phase 01 · Foundation — 2026-11-17

Backend type (B05): TanStack Start on Cloudflare Worker runtime with `createServerFn`. Server-only code lives in `*.server.ts` and is loaded via dynamic import inside handlers (`src/server/gtm.functions.ts` → `gtm-service.server.ts`). Durable persistence (Lovable Cloud) is **not yet enabled** → PENDING for phase 03.

Files changed: src/domain/{contracts,evidence,authority,execution,policy,research,field}.ts, src/server/{gtm.functions,gtm-service.server}.ts, src/evaluation/{history,current-run}.ts, src/components/gtm/AppShell.tsx, src/routes/{__root,index,demo,benchmark,research,evidencia}.tsx, src/styles.css, src/test/{app-routing.test.tsx,phase01-contracts.test.ts}, docs/*.

| ID | Status | Owning module | Evidence run | Executed assertion | Next unresolved condition |
|---|---|---|---|---|---|
| B01 | VERIFIED | src/routes/* | vitest 2026-11-17T23:51Z (12/12 pass); curl 200 on /, /demo, /benchmark, /research, /evidencia; build log "build OK" | each path matches a non-root route; SSR returns 200 | — |
| B02 | VERIFIED | src/domain/contracts.ts | vitest phase01-contracts | keyMismatch returns exact axes; money(10.5) throws; tick/UTC brands rejected by type check (@ts-expect-error) and runtime validators | — |
| B03 | PARTIAL | src/domain/contracts.ts | vitest phase01-contracts | plain string not assignable to PermissionRef; PublicCaseSchema rejects `valid_actions` and `trusted` fields | server issuer + session-bound reference validation in phase 02 |
| B04 | VERIFIED | src/evaluation/* | vitest phase01-contracts | current run executed=false, 0 rows; historical arms 24/24, 14/24, 13/24 with origin=historical | — |
| B05 | PARTIAL | src/server/* | file layout review + build OK | server module only imported dynamically inside createServerFn handler | enable Lovable Cloud persistence; verify transaction boundary (phase 03) |

Remaining gaps: authority resolver, extraction, execution, policy, research, field modules are PENDING stubs.

Phase 01 handoff complete.

## Phase 02 · Verified core — 2026-11-17

Files: src/domain/{canonical,evidence,authority,permission,contracts}.ts, src/server/gtm-service.server.ts, src/server/fixtures/public-cases.json (24 public inputs), src/evaluation/gold.json (evaluator-only), src/lib/gtm.functions.ts (moved from src/server), src/hooks/use-sandbox-session.ts, src/components/gtm/EvidenceTable.tsx, src/routes/{demo,evidencia}.tsx, src/test/phase02-{evidence,authority,fixtures}.test.ts, tsconfig.json (resolveJsonModule).

Commands: `bunx vitest run` → 57/57 pass (2026-11-17T~00:10Z). `tsgo --noEmit` → 0 errors. Playwright /tmp/browser/p2/check_demo.py on /demo: CF-01A@100 ready_to_launch; CF-01B@100 scope_mismatch_terms_digest; CF-02B@100 ready_to_launch; CF-02B@110 revoked; CF-02A server verify OK; tampered ref → bad_seal. /evidencia lists source, role, identity, span, polarity, provenance and visibility.

Trusted source: simulated fixture registry (`registry`, `buyer_admin`, `delegation_service`), disclosed in UI. Permission refs: HMAC-SHA256 seal with server secret GTM_SEAL_SECRET, bound to session, tenant, key, as_of, proof digest, source revisions, registry version. Unit tests use a disclosed test-double secret.

Diagnostic rule added: when capability mismatches, the action difference it implies is not counted separately (MP03-B → scope_mismatch_capability).

| ID | Status | Executed assertion | Next unresolved condition |
|---|---|---|---|
| E01 | VERIFIED | slice === text[start:end] | — |
| E02 | VERIFIED | quoted CFO (subject "The CFO", author kept), hedge, deny, past, quarantined injection | broader phrase corpus (phase 05 metamorphic) |
| E03 | VERIFIED | forged namespace record rejected by strict schema; candidates never reach resolver | — |
| E04 | VERIFIED | duplicate → 1 event; same-revision different payload → conflict; registry version 2; correlated copies counted once | — |
| E05 | VERIFIED | two "Alex Morgan" → ambiguous, grants_authority=false | — |
| E06 | VERIFIED | event 90 / known 110 absent at 100, visible at 110 | — |
| E07 | VERIFIED (domain) | tenant B read/count/conflicts = 0 | backend storage isolation (phase 03) |
| E08 | VERIFIED (domain) | replay → identical state hash and registry version | replay from durable store (phase 03) |
| A01 | VERIFIED | each of 6 axis mutations → scope_mismatch_<axis> | — |
| A02 | VERIFIED | valid_until=100: expired at 100, allowed at 99 | — |
| A03 | VERIFIED | rev2 revoke denies; rev3 regrant allows | — |
| A04 | VERIFIED | not_yet_known / not_yet_effective | — |
| A05 | VERIFIED | two distinct latest records same effect → conflict; identical collapse | — |
| A06 | VERIFIED | denied/explicit_deny, grant source in proof.conflicts and log | — |
| A07 | VERIFIED | expired newest grant → expired, no fallback | — |
| A08 | VERIFIED | sandbox capability, subsidiary org, altered terms all blocked | — |
| A09 | VERIFIED | missing / not explicit / terms changed / scope / timeline / no authority at occurrence | — |
| A10 | VERIFIED | other session, other tenant, tampered body, client-made, wrong secret all fail; UI tamper → bad_seal | server-side storage of issued refs (phase 03) |

Fixture check: 12 authority-layer cases match expected reasons from evaluator gold (gold only read by the test). MP06-B (dispatch mutation), MP11-B (identity in readiness, wired in service) and CF-02B dispatch path are owned by phase 03.

Remaining gaps: session state is in worker memory (not durable, not concurrency-safe) → PENDING Lovable Cloud persistence in phase 03.

Phase 02 handoff complete.

## Phase 03 · Cases and durable execution — 2026-11-18

Backend: Lovable Cloud Postgres. Migration `gtm_durable_execution`: tables gtm_aggregates (lock row per session+case scope), gtm_events (append-only, unique per source/stream/revision/payload hash), gtm_intents, gtm_dispatches (unique session+tenant+idempotency key), gtm_effects (unique per intent and per effect key), gtm_payment_events (unique receipt+kind). RPCs `gtm_append_event` and `gtm_commit_dispatch` take `SELECT … FOR UPDATE` on the same aggregate row, so a revoke and a commit serialize; commit is compare-and-set on the registry version. Tables are server-only (service role, RLS on, no browser grants).

Files: src/domain/{actions,policy,execution}.ts, src/server/gtm-service.server.ts (DB-backed), src/lib/gtm.functions.ts (prepare, dispatch, insert revocation, batch replay), src/routes/demo.tsx (Prepare / Insert revoke / Dispatch / batch replay + trace export), src/test/phase03-{domain,backend}.test.ts.

Commands: `bunx vitest run` → 76/76 pass, including phase03-backend.test.ts executed against the real database functions. Playwright /tmp/browser/p2/check_p3.py: CF-02A + interactive revoke → blocked · revoked · 0 effects; fresh session CF-02A → committed · 1 effect; batch replay table matches C01–C04.

| ID | Status | Executed assertion |
|---|---|---|
| X01 | VERIFIED (backend) | CF-02A prepare → 0 effects; dispatch → committed, 1 effect |
| X02 | VERIFIED (backend + UI) | interactive revoke at t105 → blocked/revoked, 0 effects; repeat insert is duplicate |
| X03 | VERIFIED (backend) | terms → approval_terms_changed, amount → amount_changed, currency → currency_changed, entity → scope_mismatch_organization; 0 effects each |
| X04 | VERIFIED (backend) | two parallel dispatches, one key → same effect id, 1 effect; changed payload same key → idempotency_conflict |
| X05 | VERIFIED (backend) | 3 races revoke vs dispatch: committed only when serialized first, otherwise revoked/0; stale expected version → stale_version/0 |
| X06 | VERIFIED (backend) | injected crash after commit; retry → replayed, same committed effect, 1 effect |
| X07 | VERIFIED (backend) | injected failure before commit → DB rollback, 0 effects; retry commits once |
| X08 | VERIFIED (domain) | wrong tenant/payer/amount/currency, unsettled, claim source → no first payment |
| X09 | VERIFIED (domain) | duplicate receipt counted once; reversal → net_paid false |
| X10 | VERIFIED (domain) | receipt at 250 excluded at horizon 200, counted at 300; payments never feed authority |
| C01 | VERIFIED | CF-01A ready_to_launch, batch commits 1 effect |
| C02 | VERIFIED | CF-01B scope_mismatch_terms_digest → confirm_expansion_and_review_pilot_500, 0 effects, still-permitted terms-access-500-pilot-only |
| C03 | VERIFIED | CF-02A dispatch at 110 → 1 effect |
| C04 | VERIFIED | CF-02B allowed at 100, revoked at 110, changed_after_event=true, 0 effects |
| C05 | VERIFIED | policy takes only catalogue + readiness (no case id/title/label input) |
| C06 | VERIFIED | batch trace exported as JSON; test asserts no gold fields in it |

Partial / pending:
- Lease loss and timeout recovery are verified on the pure outbox double only; the DB has no separate worker queue yet (effects commit inside the dispatch transaction).
- Payment receipts are reconciled in the domain; the gtm_payment_events table exists but no UI/server flow writes to it yet.
- Server functions are public sandbox endpoints (no sign-in), scoped by random session id.

Next phase: 04 · Interactive demo. Attach `04_FASE_DEMO_INTERACTIVA.md`.

## Phase 04 · Interactive demo and audit trace — 2026-11-18

Files: src/domain/{scenario,baselines}.ts, src/evaluation/four-case.ts, src/lib/request-guard.ts, src/lib/gtm.functions.ts (evaluateScopeFn, fourCaseRunFn, sessionTimelineFn), src/server/gtm-service.server.ts (evaluateScopeScenario, fourCaseRun, sessionTimeline, message on evaluateCase), src/components/gtm/{DemoParts,AppShell}.tsx, src/routes/{demo,experiments,field}.tsx, src/test/phase04-demo.test.ts.

Commands: `bunx vitest run` → 83/83 pass (00:19Z). `tsgo --noEmit` → 0 errors. Build log "build OK". Playwright /tmp/browser/p4/check_demo.py at 1280x720 (+1440x900 screenshot), two full rounds each from a fresh session, 0 console/page errors.

| ID | Status | Executed evidence | Remaining |
|---|---|---|---|
| U01 | VERIFIED | vitest + browser: grant 500 vs request 2000 → scope_mismatch_terms_digest / confirm_expansion_and_review_pilot_500; grant 2000 → ready_to_launch / prepare_proposal_2000_users | — |
| U02 | VERIFIED | same message text; request_version unchanged, permission_version changed (vitest + UI highlight) | — |
| U03 | VERIFIED | browser ×2: CF-02A prepare t100 → dispatch t110 committed, effects 1; fresh session prepare → revoke t105 (registry v1→v2) → dispatch blocked · revoked, effects 0 | — |
| U04 | VERIFIED (unit) | request guard discards older token; Scene 1/2 write results only for latest token; dispatch disabled while stale/in flight | no injected-latency browser test |
| U05 | VERIFIED | four-case run run-4c-…: D 4/4 valid, 0 false authorize; C 2/4, B 2/4, 2 false authorize each; D branches 2+0+1+1+0+0 = 4/4 | 24-case scorecard (phase 05) |
| U06 | VERIFIED | audit sheet: source spans, six-axis table, virtual tick + UTC, original/current versions, reason codes | — |
| U07 | VERIFIED | Reset mints a new session id (initial t100, no intent, empty timeline); prior sessions remain in append-only tables | — |
| U08 | VERIFIED | /demo, /experiments, /field, /evidencia browsed; no errors | — |

Engine evidence (domain, executed) is separate from backend checks: dispatch commit/blocking ran against Lovable Cloud RPC. Still unresolved: server functions are unauthenticated (session ids are random but not owned); policy simulation is PENDING (phase 07); field study 0/20 real registrations.

Completion matrix: 05 full scorecard · 06 · 07 policy simulation engine · 08 — open.

Next: phase 05.

## Phase 05 · Canonical 24-case benchmark — 2026-11-18

Files: src/domain/decide.ts (D path extracted, pure), src/domain/baselines.ts, src/domain/contracts.ts (assertNoTruthFields), src/evaluation/{full-run,metamorphic}.ts, src/server/gtm-service.server.ts (fullRun, metamorphicRun, intake guard), src/lib/gtm.functions.ts (fullRunFn, metamorphicRunFn), src/routes/benchmark.tsx, src/test/phase05-benchmark.test.ts.

Commands: `bunx vitest run` → all pass (incl. 8 phase-05 tests). Playwright /tmp/browser/p56/check_bench.py: /benchmark run → D 24/24, FA 0/12, pairs 12/12; C 14/24, 10/12, 2/12; B 13/24, 11/12, 1/12 (all = targets, computed from rows); metamorphic 132/132; Prior research view shows r2-sealed-eb41454c3fb8; 0 console errors.

| ID | Status | Evidence |
|---|---|---|
| Q01 | VERIFIED | live scores beside targets with Wilson 95% intervals recomputed from n |
| Q02 | VERIFIED | CF-01A prepare_proposal_2000_users; CF-01B confirm_expansion_and_review_pilot_500 |
| Q03 | VERIFIED | CF-02A dispatch committed; CF-02B ready at t100, blocked · revoked at t110, no effect |
| Q04 | VERIFIED | 4 categories summing to 24, from case records |
| Q05 | VERIFIED | rename/alias/unseen tenant, reorder, duplicate (invariant); axis, exclusive expiry, known_time, revoke-after-prepare, terms/money change (responsive); failures render check · case · cause |
| Q06 | VERIFIED | source scan: no case ids / gold / valid_actions in decision modules |
| Q07 | VERIFIED | export JSON: inputs digest, rows+traces, scores, unresolved mismatches, runtime version, metamorphic |

Also: gold mutation changes scores only; unseen catalogue action rejected; nested truth payload rejected at intake. A arm UNTESTED, no score.

## Phase 06 · Contingent routes and safe unknowns — 2026-11-18

Files: src/domain/intervention.ts (cost table, frozen configs, budget ledger with founder/daily/engineering/pilot/asset dimensions, contingent policy, greedy baseline, selective router, spec composer, independent validator, generation fallback, safe states), src/evaluation/detector.ts, src/evaluation/full-run.ts (route, safe state and budget in D trace), src/test/phase06-routes.test.ts.

| ID | Status | Evidence (vitest) |
|---|---|---|
| P01 | VERIFIED | denied commercial + sandbox → isolated_pilot, 0 commercial effects; MP03-B D no dispatch |
| P02 | VERIFIED | pilot slot / engineering / daily founder rejections; only probe + fallback charged |
| P03 | VERIFIED | clean standard → catalogue, single charge |
| P04 | VERIFIED | forced failure → generation_attempt + fallback, each once |
| P05 | VERIFIED | inconclusive → request_budget_authorization; four safe states distinguished |
| P06 | VERIFIED | actor / source / terms change → clarification route |
| P07 | VERIFIED | validator rejects unauthorized capability and binding commitment |

Gaps: phase-06 policy runs in domain/tests only; no UI controls for budget/probe yet (Experiments simulation slots stay PENDING until phase 07). Detector thresholds are config inputs, no calibrated run yet. Server functions remain unauthenticated.

Next: phase 07 (policy simulation engine), then 08.

## Phase 07 · Policy simulation engine — NOT RECEIVED

No phase-07 instructions were supplied. Experiments → Policy simulation slots stay PENDING with empty fresh metrics.

## Phase 08 · MVE v2, field intake and pilot gate — 2026-11-18

Files: src/domain/{business-clock,field}.ts, src/server/fixtures/field-sim-20.json (original simulated 20-case operational fixture), src/evaluation/field-oracle.json (evaluator-only metrics oracle), src/evaluation/history.ts (PRIOR_GATES), src/server/gtm-service.server.ts (fieldReport, classifyFieldIntake with HMAC custodian check), src/lib/gtm.functions.ts (fieldReportFn, classifyIntakeFn), src/routes/{field,evidencia}.tsx, src/test/phase08-field.test.ts.

| ID | Status | Evidence |
|---|---|---|
| F01 | VERIFIED | vitest + browser: 0/20, all indicators open/unavailable, HOLD_OBSERVATION_RESOLVE_CAUSE |
| F02 | VERIFIED | vitest: declared simulated, synthetic template id, duplicate, unverifiable custodian (well-shaped hash, failed HMAC) → quarantined, parent/child substitution, prospective outcome known; browser: sample → rejected · known_synthetic_template_id |
| F03 | VERIFIED | reply 09:25 / verified 09:33 / cutoff 09:30 → not confirmed |
| F04 | VERIFIED | computed from fixture timestamps: 14/20 timely, 1/13 one-request, 12/13 sent; coverage 16/20, visible 14/20, authorized 5/20, buckets and timeliness match oracle, median 6.25 min |
| F05 | VERIFIED | real study starts 0 observed / 0 accounts; historical import never touches real counters |
| F06 | VERIFIED | FIELD_GATE_CONFIG frozen, version field-gate-1.0.0; explicit open indicators |
| F07 | VERIFIED | B1/B2/B3 CSV templates + metrics/decision JSON export on /field |

Business clock: explicit IANA zone, workdays, hours, holidays; 48 business h = 6 workdays and 2 business days = 16 h stored as distinct fields; DST start crossing and holiday skip tested. Trust boundary strengthened vs a format-only validator: origin text and hash shape are assertions; only a verified HMAC custodian attestation confirms provenance.

Gaps: intake checks are not persisted (no permitted real study); no server-owned evidence references are issued yet; cost/savings indicator stays open pending supervised rework comparison.

## Phase 09 · Guided 90-second presentation — 2026-11-18

Files: src/routes/demo.tsx (presentation bar, 5 steps, timer, keyboard/buttons, live highlights, evidence drawer, live 24-case step).

Browser /tmp/browser/p89/check_present.py at 1280x720 (+375x800 check, scrollWidth 375), 0 console errors:

| ID | Status | Evidence |
|---|---|---|
| V01 | VERIFIED | ArrowLeft/ArrowRight and Previous/Next move through steps 1–5 |
| V02 | VERIFIED | step 2 highlighted grant control → engine returns scope_mismatch_terms_digest / confirm_expansion_and_review_pilot_500 |
| V03 | VERIFIED | step 3, twice after reset each: positive committed (effects 1), revoked blocked · revoked (effects 0) |
| V04 | VERIFIED | timer ran (00:19) independently; decisions use virtual t100/t105/t110 |
| V05 | VERIFIED | usable at 1280x720 and 375px without horizontal scroll |
| V06 | VERIFIED | step 4 shows current run id (24/24, 14/24, 13/24) with origin; historical run id labeled separately |

Remaining: phase 07 not received; server functions are unauthenticated.
