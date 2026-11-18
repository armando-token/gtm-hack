/** Supported action definitions (public catalogue from file 12). */
export interface ActionDef { readonly action_id: string; readonly gtm_action: string; readonly description: string; readonly consequential: boolean }
export const ACTIONS: readonly ActionDef[] = [
 {
  "action_id": "prepare_proposal_2000_users",
  "gtm_action": "standard_offer",
  "description": "Prepare and send commercial expansion proposal for 2,000 Cloudflare Access seats",
  "consequential": true
 },
 {
  "action_id": "confirm_expansion_and_review_pilot_500",
  "gtm_action": "request_budget_authorization",
  "description": "Hold 2,000-seat commercial proposal; confirm expansion authority and offer 500-user pilot review",
  "consequential": false
 },
 {
  "action_id": "execute_parent_enterprise_rollout",
  "gtm_action": "standard_offer",
  "description": "Execute enterprise production rollout across parent corporation",
  "consequential": true
 },
 {
  "action_id": "clarify_parent_entity_authority",
  "gtm_action": "request_budget_authorization",
  "description": "Block parent rollout on subsidiary-only grant; request parent entity authorization",
  "consequential": false
 },
 {
  "action_id": "issue_commercial_order_form",
  "gtm_action": "standard_offer",
  "description": "Issue binding annual commercial order form",
  "consequential": true
 },
 {
  "action_id": "request_budget_owner_signoff_or_run_sandbox",
  "gtm_action": "request_budget_authorization",
  "description": "Hold commercial order form (actor only has technical sandbox authority); request budget owner sign-off",
  "consequential": false
 },
 {
  "action_id": "send_approved_proposal",
  "gtm_action": "standard_offer",
  "description": "Dispatch commercial proposal under active valid authorization",
  "consequential": true
 },
 {
  "action_id": "invalidate_send_and_confirm_new_scope",
  "gtm_action": "request_budget_authorization",
  "description": "Abort dispatch after revocation/expiration/terms change; request re-confirmation of scope",
  "consequential": false
 },
 {
  "action_id": "escalate_conflicting_sources_for_clarification",
  "gtm_action": "request_it_authorization",
  "description": "Hold execution due to conflicting or untrusted authority sources; request targeted clarification",
  "consequential": false
 },
 {
  "action_id": "propose_isolated_technical_pilot",
  "gtm_action": "isolated_pilot",
  "description": "Offer permitted isolated technical sandbox pilot while commercial spend is denied or pending",
  "consequential": false
 },
 {
  "action_id": "wait_for_security_prerequisite_check",
  "gtm_action": "request_it_authorization",
  "description": "Hold production connector rollout and route to prerequisite IT/Security verification",
  "consequential": false
 }
] as const;
export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.action_id, a]));
