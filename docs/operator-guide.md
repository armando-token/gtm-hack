# 90-second operator guide (verified buttons)
1. (0–20 s) Decision → Scene 1 · Scope. Keep 2,000 / 2,000 → **Evaluate** → ALLOW, prepare_proposal_2000_users.
2. (20–40 s) Choose permission **500 seats** → **Evaluate** → BLOCK scope_mismatch_terms_digest, next confirm_expansion_and_review_pilot_500. Message unchanged.
3. (40–65 s) **Scene 2 · Revocation** → **Prepare (t100)** → **Revoke approval (t105)** → **Dispatch simulation (t110)** → BLOCK revoked, simulated effects 0. Dispatch button disables (same key cannot re-commit).
4. (65–80 s) Benchmark → **Run 24-case benchmark** → D 24/24, C 14/24, B 13/24 with new run_id.
5. (80–90 s) Field study → 0 / 20 and HOLD. Experiments → **Build evidence bundle** → **Download evidence JSON**.
Reset: **Reset scenario** on each scene (new session = clean fixture state). Presentation mode button runs the same five steps with a timer.
