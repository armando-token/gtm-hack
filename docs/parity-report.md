# Parity report · gtm-lovable-rebuild-v1

Implementation: TypeScript rewrite on TanStack Start (new language — numerical parity with the Python reference is not claimed). Full capability coverage reconciles with 14_MATRIZ_DE_FIDELIDAD.md in phase 10.

| Capability | Status | Owning module | Evidence run | Executed assertion | Next unresolved condition |
|---|---|---|---|---|---|
| Contract schemas (C02) | PARTIAL | src/domain/contracts.ts | phase 01 vitest | B02/B03 | proof hashing (phase 02) |
| Authority resolution (C03) | PENDING | src/domain/authority.ts | — | — | phase 02 |
| Approval & execution (C04) | PENDING | src/domain/execution.ts | — | — | phase 03 |
| Policy & generation (C05) | PENDING | src/domain/policy.ts | — | — | phase 06 |
| Simulation & learning (C06) | PENDING | src/domain/research.ts | — | — | phase 07 |
| Canonical benchmark (C07/C08) | PENDING | src/evaluation | — | — | phase 05 |
| Field measurement (C09) | PENDING | src/domain/field.ts | — | real cohort 0/20 | phase 08 |

## Reference history (separate from runtime)
Historical run r2-sealed-eb41454c3fb8: D 24/24, C 14/24, B 13/24 — origin historical, not reproduced.
