/**
 * Trusted fixture service — server only (.server.ts never enters client bundle).
 * Persistence and transaction boundary: PENDING (phase 03).
 */
import { CONTRACT_VERSION } from "@/domain/contracts";

export function backendInfo() {
  return {
    contract_version: CONTRACT_VERSION,
    runtime: "tanstack-start-server-function",
    persistence: "PENDING" as const,
    checked_at: new Date().toISOString(),
  };
}
