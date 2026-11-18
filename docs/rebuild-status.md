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
