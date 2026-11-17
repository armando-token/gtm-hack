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

Next phase: 02 · Verified core (evidence, identity, extraction, authority). Attach `02_FASE_NUCLEO_VERIFICADO.md`.
