/** Exact-scope resolution and proof. Status: PENDING (phase 02). */
import type { AuthorityRecord, ModuleStatus, Tick } from "./contracts";
export const AUTHORITY_STATUS: ModuleStatus = "PENDING";

/** C03 visibility: max(event_time, known_time, valid_from) <= as_of. */
export function isVisible(r: AuthorityRecord, asOf: Tick): boolean {
  return Math.max(r.event_time, r.known_time, r.valid_from) <= asOf;
}
