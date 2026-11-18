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

Next phase: 03 · Cases and execution. Attach `03_FASE_CASOS_Y_EJECUCION.md`.
