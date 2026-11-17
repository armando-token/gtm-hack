import { describe, expect, it } from "vitest";
import {
  CONTRACT_VERSION, PublicCaseSchema, keyMismatch, money, tick, utc,
  type AuthorityDecision, type Key, type Tick, type UtcTimestamp,
} from "@/domain/contracts";
import { PRIOR_RESEARCH } from "@/evaluation/history";
import { INITIAL_CURRENT_RUN } from "@/evaluation/current-run";

const k: Key = { tenant: "t", organization: "o", actor: "a", capability: "c", action: "x", terms_digest: "d" };

describe("B02 typed six-axis key, integer money, separate clocks", () => {
  it("reports exact mismatched axes", () => {
    expect(keyMismatch(k, k)).toEqual([]);
    expect(keyMismatch(k, { ...k, organization: "o2", terms_digest: "d2" })).toEqual(["organization", "terms_digest"]);
  });
  it("rejects non-integer money", () => {
    expect(money(24000000, "USD").amount_minor).toBe(24000000);
    expect(() => money(10.5, "USD")).toThrow();
  });
  it("ticks and UTC cannot be silently mixed", () => {
    expect(() => tick(1.5)).toThrow();
    expect(() => utc("2026-11-16 10:00")).toThrow();
    const t: Tick = tick(100);
    const u: UtcTimestamp = utc("2026-11-16T10:00:00Z");
    // @ts-expect-error UTC is not a Tick
    const bad: Tick = u;
    // @ts-expect-error Tick is not UTC
    const bad2: UtcTimestamp = t;
    expect([bad, bad2]).toHaveLength(2);
  });
});

describe("B03 candidate cannot satisfy AuthorityDecision", () => {
  it("caller strings cannot be a permission ref (type level)", () => {
    const fake = {
      key: k, as_of: tick(1), state: "allowed", reason: "granted",
      proof: { target_key: k, as_of: tick(1), registered_sources: [], matched_record_digests: [], latest_revisions: {}, conflicts: [], mismatch_axes: [] },
      permission_ref: "caller-made",
    } as const;
    // @ts-expect-error plain string is not a server-issued PermissionRef
    const d: AuthorityDecision = fake;
    expect(d).toBeDefined();
  });
  it("decision boundary rejects evaluator-only and unknown fields", () => {
    const base = {
      case_id: "X", pair_id: "P", pair_index: "P-A", variant: "v", category: "c", mechanism: "m", title: "t",
      decision_time: 100, dispatch_time: 105, tenant_id: "t", organization_id: "o", target_key: k,
      fallback_pilot_key: null, amount_cents: 100, catalogue: [], communication_records: [], directory: [],
      service_records: [], service_approval: null, dispatch_mutation: null, crm_proxy_fields: {},
    };
    expect(PublicCaseSchema.safeParse(base).success).toBe(true);
    expect(PublicCaseSchema.safeParse({ ...base, valid_actions: ["x"] }).success).toBe(false);
    expect(PublicCaseSchema.safeParse({ ...base, trusted: true }).success).toBe(false);
  });
});

describe("B04 current run empty, historical labelled", () => {
  it("current run starts unexecuted", () => {
    expect(INITIAL_CURRENT_RUN.executed).toBe(false);
    expect(INITIAL_CURRENT_RUN.rows).toHaveLength(0);
    expect(INITIAL_CURRENT_RUN.contract_version).toBe(CONTRACT_VERSION);
  });
  it("historical values carry historical origin", () => {
    expect(PRIOR_RESEARCH.origin).toBe("historical");
    expect(PRIOR_RESEARCH.arms.map((a) => `${a.valid}/${a.total}`)).toEqual(["24/24", "14/24", "13/24"]);
  });
});
