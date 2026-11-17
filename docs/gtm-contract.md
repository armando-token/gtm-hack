# GTM rebuild contract · gtm-lovable-rebuild-v1

This is the persistent behavior contract for a new implementation written during the event. The reference is Test-GTM at 571f9fa503eba1b86c2f695c84823076856a9805. Original sealed experiment r2-sealed-eb41454c3fb8 evaluated632a084 and was published at 651dfbc. The event implementation has its own code revision, runtime, protocols and evidence.

## C01 Product and language

Implement the complete specified GTM behavior using the native Lovable stack. Domain logic is portable TypeScript, separated from UI, trusted backend, simulator and independent evaluator. Keep external dispatch simulated. A control must mutate its real input, and its output must be recalculated. Public UI is English. The teaching case is Cloudflare Access500/2000 seats. Data in that case is synthetic.

Use whichever native project architecture exists. Current Lovable may create TanStack Start applications with server functions. Other projects may use Vite and edge functions. Persist domain state on the backend and use transactionally serialized updates for consequential effects. Pure-domain diagnostic tests are useful but cannot establish server concurrency guarantees by themselves.

## C02 Domain records

Six-axis Key is an exact tuple ordered tenant, organization, actor, capability, action, terms_digest. Compare strings exactly after validated normalization at intake. Preserve meaningful distinctions across tenant, entity, actor identity, capability, action and versioned terms. Amount is integer cents and currency explicit. Terms include the sanctioned offer version, number of users, deployment mode and commercial conditions in the simulator's canonical digest.

AuthorityRecord contains evidence_id, key, registered source, revision, event_time, known_time, valid_from, valid_until and effect grant/revoke/explicit_deny. The event_time/known_time/validity values are integer ticks in canonical benchmarks. Field captures use UTC dates and an explicit IANA business calendar. Translate neither clock silently.

Approval contains exact key, occurred_at, known_at and explicit. Proposal contains id, exact key, money and approval requirement. CandidateClaim contains the originating source span, speaker, quoted subject, polarity and candidate namespace. Claims may update hypotheses but cannot grant authority. DirectoryEntry contains tenant, organization and canonical actor_id, with display name as an attribute rather than identity.

## C03 Resolve authority

A record is visible if max(event_time,known_time,valid_from)<=as_of. Match the exact six-axis key and registered trusted sources. Group by source. Select the greatest visible revision in each source. Deduplicate identical records by canonical digest. Multiple distinct records at the greatest revision yield conflict. They are conflicting even if their effect field is the same.

For a selected record, grant/explicit_deny participates only if as_of<valid_until. A selected revoke remains a denial until a later visible regrant supersedes that source stream. Expired newest grant does not reactivate an older grant.

If any selected source explicitly denies, return denied with explicit_deny. Otherwise any selected revoke returns denied with revoked. Log cross-source disagreement where it exists. Otherwise an active grant returns allowed. Otherwise return unknown and diagnose missing or mismatched evidence. The order is chosen to preserve the original contract.

Reason codes include ready_to_launch, granted, candidate_only_no_authority, untrusted_source, scope_mismatch_tenant, scope_mismatch_organization, scope_mismatch_actor, scope_mismatch_capability, scope_mismatch_action, scope_mismatch_terms_digest, scope_mismatch_multiple, not_yet_known, not_yet_effective, expired, revoked, explicit_deny, conflict and no_grant. An exact trusted stream whose newest grant expired should diagnose expired. Future-known exact records diagnose not_yet_known. A closest partial match may explain a scope mismatch but never grants the requested authority.

Proof includes the target key, as_of, registered sources, matched record digests, latest per-source revisions, conflicting sources/effects and mismatch axes. Canonical hash uses recursively sorted object keys, array ordering specified by the schema and stable integer/string serialization. Where equal-byte Python hashing matters, compare canonical payload bytes explicitly.

Only the trusted backend resolver can issue a valid permission reference. Bind it to session, tenant, exact key, as_of, proof and version. Browser-supplied strings, HMAC values or flags cannot mint authority. Runtime trust derives from an authenticated simulator fixture registry or later verified real source, not from the contents of candidate text.

## C04 Approval and execution

To prepare an action, validate the decision key, token/reference, as_of, explicit approval and exact proposal. The approval timeline must obey occurred_at<=known_at<=decision_time. Verify authority at the approval occurrence and the current decision. Terms-only changes use approval_terms_changed when validating the approval. Exact reason parity is checked separately from permit/block behavior.

Freeze proposal digest, key, amount, currency, decision time, approval, proof reference and server versions. At dispatch validate its integrity, historical and current authority, new proposal digest, time, expected aggregate version and source revisions. Serialize registry mutation and effect commit in one transaction using the same scoped lock or serializable state. A revoke completed before the commit is observed and prevents the effect.

The dispatch sink accepts only calls through this boundary. It records one effect using an idempotency key. Repeated identical committed requests return the same effect. A reused key with different content is conflict. Recover queue/worker leases and partial failures without double effects or duplicate budget reservations. Outbox jobs, ledger transitions and reconciliation persist across reload.

Reconcile payments against an expected contract and independent trusted simulated receipt. Validate payer, beneficiary entity, tenant, settled status, currency, amount and receipt uniqueness. One first qualifying payment per buyer organization per evaluation cohort/horizon. Handle reversals as new events. Keep paid, signed, approved and verbal intent separate.

## C05 Actions, policy and generation

Canonical actions standard_offer, isolated_pilot, deferred_invoice, isolated_deferred, request_it_authorization and request_budget_authorization have respective reference founder-hour costs1/3/2/4/1/1 and virtual delays2/3/3/4/1/1. Experiment config may change them with a protocol version.

Deterministic contingent defaults use IT probe, isolated yes-route, deferred no-route, deferred safe default and standard secondary. Choose only currently feasible actions with available founder/engineering/day/pilot budgets. Resource schedules charge one-time shared assets once and marginal delivery per account. Greedy uses the same observations, feasible inventory and capacity but selects immediate expected value. Fixed, random-feasible and SPICED-style rubric are separate comparison policies. The oracle has its declared extra latent state solely in the evaluator and cannot see future random draws.

Selective intervention generation sees pre-action features only. Compose a typed candidate from the allowed capability registry and validate its scope, artifact, deadline, costs and buyer commitment. If generation fails, account for actual generation work and charge the executed fallback once. Preserve a viable standard route on clean cases. A source of uncertainty can require a narrower confirmation while leaving an already-authorized alternative available.

## C06 Independent simulation and learning

World grammar covers prerequisites AND/OR, veto, precedence, expiry, selective response, capability corruption, correlated shocks, lag, unknown mechanisms, unfamiliar actors and nonidentifiability. Environment and evaluator own hidden truth and future randomness. Agent gets observable events and permitted queries. Splits isolate dev, calibration and held-out world roots. No runtime dependency lets an agent read gold or future outcomes.

Beliefs enumerate finite candidate mechanisms and normalized prior/likelihood updates. Dependence groups prevent copied messages counting as independent evidence. Preserve ambiguity if all feasible observations are observationally equivalent. Score predictions on common matured support. Brier/log loss and calibration are calculated by family, with predictor and fallback decisions exposed.

Plan with exact dynamic programming on bounded fixtures. Add bounded beam/MCTS, horizon/convergence and regret checks. Compare fixed sequence, greedy, contingent and catalogue selection with shared capacity. Transfer uses group-aware split, partial pooling and support-sensitive fallback. A learned route is distinct from a transferred permission.

Use a manifest for every run including seed and PRNG algorithm/version, source split, worlds, organizations, scenario weights, costs, capacity, time horizon, maturity and software revision. Historical Python PRNG and iteration order must be reconstructed to claim exact same numerical benchmark. A different deterministic generator produces a new experiment whose values are measured independently.

## C07 Canonical benchmark input

File12 supplies24 cases as public fixture inputs with private_state_summary removed. The service owns the fixture registry. The policy may use communication_records, resolved directory, exact target/fallback keys, current visible service records, service approval and supported actions. The server validates which sources are trusted. expected labels and private fields are evaluator-only. Do not branch on case_id/pair_id/variant labels or private names.

For time-sensitive cases load the complete record timeline into the service and ask as_of at decision and dispatch separately. CF-02B has future-visible revoke in service_records. Its dispatch_mutation may be null. This field's absence does not disable timeline revalidation.

The three executable arms are D exact GTM, C superficial rules and B local Boolean proxy. Aligned is untested. Current metric values derive from the executed output table. Historical 24/24,14/24 and 13/24 are conformance expectations in the scorer only.

## C08 Baseline details and scoring

C extracts affirmative surface polarity. At decision time inspect records whose event_time<=decision_time. It holds on explicit_deny or distinct effects sharing revision1. It selects the primary action for affirmed, non-denied, non-conflicting input. For explicit denial and a catalogue containing propose_isolated_technical_pilot, choose that alternative. Otherwise choose the fallback. C intentionally lacks exact key binding, known_time checks and revalidation; label these limitations.

B reads crm_proxy_fields. It proceeds when stage_name is Proposal/Negotiation/Pilot, account_has_active_approval is true, decision_time<approval_valid_until and explicit_deny is false. Otherwise fallback. Label it local proxy. Its score does not measure Salesforce's deployed product.

Score valid actions on all 24, false authorize on12 B-traps and forbidden consequential outputs, pair accuracy on12 pairs requiring both correct. UNTESTED contributes no metric denominator. Keep observed action separate from evaluator outcome. Test random-ID invariance, reordering, duplicates, changed terms, money, time, entity, unknown actor and mutated oracle labels.

## C09 Field measurement

Origin is simulated or real, separately scoped. Custody hash format and origin label alone do not authenticate an external record. Server-owned evidence references or verified attestations establish confirmed provenance. Reject duplicate opportunity/decision ids, invalid parent links, false chronology and simulated rows routed to real.

Record sent/responded/verified times separately. Numerator for one-request resolution requires buyer_contact_required, confirmation valid and verified before the decision cutoff/deadline and request_count<=1. Denominator includes all eligible required-contact cases, including pending/rejected. An empty denominator is unavailable with reason.

Publish direct trusted-source coverage, visible coverage and actual positive authority separately. Timely evidence requires the applicable48 business-hour deadline and next commercial milestone. Source coverage may include known negative or insufficient-scope evidence. Work minutes sum search+contact+review and excludes elapsed waiting. All elapsed-wait measures retain their own denominator.

Real study target20 with 12 retrospective stratified descriptive and 8 prospective consecutive records with unknown outcome at enrollment. Gates are65% complete-segment coverage or80% predefined-subsegment,60% timely, median<=10min,75% valid one-request confirmation where applicable,0 severe improper advances and 0 unresolved reviewer disputes. Source validation and follow-up have precedence. Empty/incomplete real observation yields HOLD. Cost/savings is unavailable until a real comparative estimate exists.

Pilot comparison is process as usual against process plus GTM/human review. Primary30d hours spent on later-invalidated presales, secondary60/90d reconciled first payment. Existing hours-outcome power estimates use delta3h,sd4.5h,alpha.05. N48 has 61.83% and N74 has 80.76% exact unclustered power. Those assumptions do not establish power for a payment endpoint. Cluster and attrition adjustments require an explicit design.

## C10 Origin, parity and completion

Historical sealed statistics and fresh event runs have separate origins, ids and code revisions. Match a behavior by executed acceptance criteria. Numerical parity requires actual identical reference inputs/protocol and output comparison. Real-field efficacy requires actual real outcomes. At zero real records, keep it pending.

Every phase writes its tests and artifacts into docs/rebuild-status.md. Final parity report names the owning implementation, evidence and unverified scope for each capability. Exhaustive recreation includes research modules, full corpus/generator protocols and durable behavior. A successful24-case demo is evidence for its diagnostic coverage.


## C11 V2 sequence and presentation

The main routes are /, /demo, /benchmark and /evidencia. A Research tab/route hosts the experimental module. Phases are base, verified core, cases/execution, interactive demo, executable benchmark, policies, research, field/evidence, presentation and final verification.

Reset starts a fresh synthetic session and restores the initial fixture state, while previous sessions stay auditable. A presentation timer is separate from the virtual authorization clock. Evaluate, Prepare and Dispatch are separate operator transitions.

Prior-research totals may be fixed in a labeled historical view. Current-run totals always derive from executed rows. The comparison scorer retains the canonical baseline C, local Boolean proxy B, independent gold and metamorphic checks. A caller-set trust flag never grants backend authority.
