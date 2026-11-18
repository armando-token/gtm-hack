/** Feasible next action. Uses only readiness, catalogue order and action definitions — never case labels. */
import { ACTION_BY_ID } from "./actions";
import type { ModuleStatus, ReasonCode } from "./contracts";

export const POLICY_STATUS: ModuleStatus = "PARTIAL";

export function selectAction(catalogue: readonly string[], readiness: ReasonCode): { action: string; consequential: boolean } {
  const defs = catalogue.map((id) => {
    const d = ACTION_BY_ID.get(id);
    if (!d) throw new Error(`Unsupported action ${id}`);
    return d;
  });
  const primary = defs[0];
  if (!primary) throw new Error("Empty catalogue");
  if (readiness === "ready_to_launch") return { action: primary.action_id, consequential: primary.consequential };
  const safe = defs.filter((d) => !d.consequential);
  if (readiness === "explicit_deny") {
    const pilot = safe.find((d) => d.gtm_action === "isolated_pilot");
    if (pilot) return { action: pilot.action_id, consequential: false };
  }
  const hold = safe.find((d) => d.gtm_action !== "isolated_pilot") ?? safe[0];
  if (!hold) throw new Error("No non-consequential fallback in catalogue");
  return { action: hold.action_id, consequential: false };
}
