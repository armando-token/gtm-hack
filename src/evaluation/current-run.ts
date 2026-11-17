import { CONTRACT_VERSION, type RunReport } from "@/domain/contracts";
/** Current-run report starts unexecuted; populated by phase 05. */
export const INITIAL_CURRENT_RUN: RunReport = {
  run_id: "unexecuted",
  origin: "current_run",
  contract_version: CONTRACT_VERSION,
  code_revision: "unrecorded",
  executed: false,
  rows: [],
};
