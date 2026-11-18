/**
 * Comparator arms (contract C08). C = superficial surface-polarity rules; B = local Boolean CRM proxy.
 * Both intentionally lack exact key binding, known_time checks and dispatch revalidation.
 */
import type { PublicCase } from "./contracts";
import type { ExtractedCandidate } from "./evidence";
import { ACTION_BY_ID } from "./actions";

export const BASELINE_LIMITATIONS = ["no exact six-axis key binding", "no known_time check", "no dispatch revalidation"] as const;

function fallback(catalogue: readonly string[]) {
  const safe = catalogue.filter((a) => !ACTION_BY_ID.get(a)?.consequential);
  return safe.find((a) => ACTION_BY_ID.get(a)?.gtm_action !== "isolated_pilot") ?? safe[0] ?? catalogue[catalogue.length - 1]!;
}

export function baselineC(c: PublicCase, candidates: readonly ExtractedCandidate[]): string {
  const seen = c.service_records.filter((r) => r.event_time <= c.decision_time);
  const explicitDeny = seen.some((r) => r.effect === "explicit_deny") || candidates.some((x) => x.polarity === "deny");
  const rev1 = new Set(seen.filter((r) => r.revision === 1).map((r) => r.effect));
  const conflicting = rev1.size > 1;
  if (explicitDeny) return c.catalogue.find((a) => a === "propose_isolated_technical_pilot") ?? fallback(c.catalogue);
  if (conflicting) return fallback(c.catalogue);
  return candidates.some((x) => x.polarity === "affirm") ? c.catalogue[0]! : fallback(c.catalogue);
}

export function proxyB(c: PublicCase): string {
  const f = c.crm_proxy_fields as Record<string, unknown>;
  const ok = ["Proposal", "Negotiation", "Pilot"].includes(String(f["stage_name"])) && f["account_has_active_approval"] === true
    && c.decision_time < Number(f["approval_valid_until"]) && f["explicit_deny"] === false;
  return ok ? c.catalogue[0]! : fallback(c.catalogue);
}
