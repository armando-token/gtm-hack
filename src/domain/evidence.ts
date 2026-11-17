/** Candidate extraction & as-of evidence. Status: PENDING (phase 02). */
import type { CandidateClaim, ModuleStatus } from "./contracts";
export const EVIDENCE_STATUS: ModuleStatus = "PENDING";

/** Candidate claims may update hypotheses but can never grant authority. */
export function isCandidate(x: unknown): x is CandidateClaim {
  return typeof x === "object" && x !== null && (x as { evidence_namespace?: unknown }).evidence_namespace === "candidate";
}
