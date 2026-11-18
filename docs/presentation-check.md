# Presentation vs today's live results (2026-11-18)
Presentation: /presentation (reference HTML served unchanged; package verify.mjs passed).
| Claim in presentation | Live result today | Match |
|---|---|---|
| 24 cases: GTM 24/24, rules 14/24, CRM proxy 13/24 | run-24-6d27244a30: 24/24, 14/24, 13/24 | yes |
| Traps: 0 / 10 / 11 false authorizations | 0/12, 10/12, 11/12 | yes |
| 12 pairs | D 12/12 (C 2/12, B 1/12) | yes |
| CF-01A allow, CF-01B confirm expansion + 500 pilot, CF-02A allow, CF-02B blocked at t110 | app + presentation logic both | yes |
| Operational trial 14/20 on time, 12/13 ≤1 request, 1/13 valid | field recalculation 14/20, 12/13, 1/13 | yes |
| Real field 0/20, HOLD | 0 / 20, HOLD | yes |
| D01 36.07 / 50.46 / 50.84 per 100; G4 44.06 / 49.67 / 52.62 | not reproduced: today's simulator is a new protocol (greedy 23.3, contingent 24.2 per 100) | historical only — correctly labeled in the slides |
| G1 882/882, gates G0–G6 | historical record; not rerun | historical only |
