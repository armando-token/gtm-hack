import { describe, expect, it } from "vitest";
import cases from "@/server/fixtures/public-cases.json";
import gold from "@/evaluation/gold.json";
import { checkApproval, readinessReason, resolveAuthority } from "@/domain/authority";
import { PublicCaseSchema, tick, type Approval, type AuthorityRecord } from "@/domain/contracts";

const SRC = ["buyer_admin", "delegation_service", "registry"];
// Authority-level reasons only. Identity (MP11-B), dispatch mutation (MP06-B) and dispatch revalidation (CF-02B) belong to later layers.
const AUTHORITY_LAYER = ["CF-01A", "CF-01B", "MP02-A", "MP02-B", "MP03-A", "MP03-B", "MP05-B", "MP07-B", "MP08-B", "MP09-B", "MP10-B", "MP12-B"];

describe("Fixture authority reasons (resolver never reads gold)", () => {
  for (const id of AUTHORITY_LAYER) {
    it(id, async () => {
      const c = PublicCaseSchema.parse((cases as unknown[]).find((x) => (x as { case_id: string }).case_id === id));
      const records = c.service_records as AuthorityRecord[];
      const asOf = tick(c.decision_time);
      const cur = await resolveAuthority({ records, key: c.target_key, asOf, registeredSources: SRC });
      const ap = await checkApproval({ approval: c.service_approval as Approval | null, key: c.target_key, asOf, records, registeredSources: SRC });
      const expected = (gold as { case_id: string; expected_reason: string }[]).find((g) => g.case_id === id)!.expected_reason;
      expect(readinessReason(cur, ap)).toBe(expected);
    });
  }
  it("CF-02B: allowed at decision 100, revoked at dispatch 110", async () => {
    const c = PublicCaseSchema.parse((cases as unknown[]).find((x) => (x as { case_id: string }).case_id === "CF-02B"));
    const r = c.service_records as AuthorityRecord[];
    expect((await resolveAuthority({ records: r, key: c.target_key, asOf: tick(100), registeredSources: SRC })).state).toBe("allowed");
    expect((await resolveAuthority({ records: r, key: c.target_key, asOf: tick(110), registeredSources: SRC })).reason).toBe("revoked");
  });
});
