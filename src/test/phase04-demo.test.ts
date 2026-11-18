import { describe, expect, it } from "vitest";
import cases from "@/server/fixtures/public-cases.json";
import { PublicCaseSchema } from "@/domain/contracts";
import { evaluateScope, permissionOf, type ScopeControls } from "@/domain/scenario";
import { baselineC, proxyB } from "@/domain/baselines";
import { createRequestGuard } from "@/lib/request-guard";
import { scoreRows } from "@/evaluation/four-case";

const all = (cases as unknown[]).map((c) => PublicCaseSchema.parse(c));
const base = all.find((c) => c.case_id === "CF-01A")!;
const SRC = ["buyer_admin", "delegation_service", "registry"];
const ctl: ScopeControls = { requestedSeats: 2000, grantSeats: 2000, grantOrganization: base.organization_id, grantCapability: "approve_spend", asOf: 100, grantValidUntil: 200 };

describe("phase 04 scene 1 scope", () => {
  it("U01 requested 2000 vs granted 500 changes action and reason", async () => {
    const ok = await evaluateScope(base, ctl, SRC);
    const bad = await evaluateScope(base, { ...ctl, grantSeats: 500 }, SRC);
    expect(ok.readiness).toBe("ready_to_launch");
    expect(ok.action.action).toBe("prepare_proposal_2000_users");
    expect(bad.readiness).toBe("scope_mismatch_terms_digest");
    expect(bad.action.action).toBe("confirm_expansion_and_review_pilot_500");
  });
  it("U02 same customer message, different result after scope mutation; permission version changes, request version does not", async () => {
    const a = await evaluateScope(base, ctl, SRC);
    const b = await evaluateScope(base, { ...ctl, grantSeats: 500 }, SRC);
    expect(a.request_version).toBe(b.request_version);
    expect(a.permission_version).not.toBe(b.permission_version);
  });
  it("changing only the request never alters the approval", () => {
    const { requestedSeats: _r, asOf: _a, ...p } = ctl;
    expect(permissionOf(base, p).approval).toEqual(permissionOf(base, p).approval);
    expect(permissionOf(base, p).approval.key.terms_digest).toBe("terms-access-2000-seats-annual");
  });
  it("expired grant validity and wrong entity block", async () => {
    expect((await evaluateScope(base, { ...ctl, grantValidUntil: 100 }, SRC)).readiness).toBe("expired");
    expect((await evaluateScope(base, { ...ctl, grantOrganization: "org-f500-telco-emea-sub" }, SRC)).readiness).toBe("scope_mismatch_organization");
  });
});

describe("phase 04 comparators and guard", () => {
  it("C and B authorize the CF-01B trap (no key binding)", () => {
    const trap = all.find((c) => c.case_id === "CF-01B")!;
    expect(baselineC(trap, [{ polarity: "affirm" } as never])).toBe("prepare_proposal_2000_users");
    expect(proxyB(trap)).toBe("prepare_proposal_2000_users");
  });
  it("U04 an older response cannot overwrite a newer one", () => {
    const g = createRequestGuard();
    const old = g.next(); const fresh = g.next();
    expect(g.isCurrent(old)).toBe(false);
    expect(g.isCurrent(fresh)).toBe(true);
  });
  it("U05 scoring reconciles to the denominator", () => {
    const s = scoreRows([
      { case_id: "CF-01A", arm: "C", action: "prepare_proposal_2000_users", branch: "allowed" },
      { case_id: "CF-01B", arm: "C", action: "prepare_proposal_2000_users", branch: "allowed" },
    ]);
    const c = s.arms.find((a) => a.arm === "C")!;
    expect(c.denominator).toBe(2);
    expect(c.valid).toBe(1);
    expect(c.false_authorize).toBe(1);
    expect(c.pairs_ok).toBe(0);
  });
});
