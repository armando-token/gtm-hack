import { describe, expect, it } from "vitest";
import { EffectSink, Outbox, reconcilePayments, transition, type ExpectedContract, type ReceiptEvent } from "@/domain/execution";
import { selectAction } from "@/domain/policy";

const C: ExpectedContract = { tenant: "t", beneficiary_org: "org-f500-telco", payer: "payer-telco", amount_cents: 24000000, currency: "USD", horizon_end: 200 };
const rc = (p: Partial<ReceiptEvent> = {}): ReceiptEvent => ({ kind: "receipt", receipt_id: "rcpt-1", source: "trusted_receipt_simulator", tenant: "t", beneficiary_org: "org-f500-telco", payer: "payer-telco", amount_cents: 24000000, currency: "USD", settled: true, at: 150, ...p });

describe("policy uses catalogue + readiness only (C05)", () => {
  const cat = ["prepare_proposal_2000_users", "confirm_expansion_and_review_pilot_500", "propose_isolated_technical_pilot"];
  it("maps readiness to actions", () => {
    expect(selectAction(cat, "ready_to_launch").action).toBe("prepare_proposal_2000_users");
    expect(selectAction(cat, "scope_mismatch_terms_digest").action).toBe("confirm_expansion_and_review_pilot_500");
    expect(selectAction(cat, "explicit_deny").action).toBe("propose_isolated_technical_pilot");
    expect(selectAction(["send_approved_proposal", "invalidate_send_and_confirm_new_scope"], "revoked").action).toBe("invalidate_send_and_confirm_new_scope");
  });
});

describe("X08 invalid receipts cannot create first payment", () => {
  for (const [name, p, reason] of [
    ["tenant", { tenant: "t2" }, "tenant_mismatch"], ["payer", { payer: "x" }, "payer_mismatch"],
    ["amount", { amount_cents: 1 }, "amount_mismatch"], ["currency", { currency: "EUR" }, "currency_mismatch"],
    ["unsettled", { settled: false }, "not_settled"], ["claim", { source: "claim" }, "untrusted_receipt_source"],
  ] as const) {
    it(name, () => {
      const s = reconcilePayments(C, [rc(p as Partial<ReceiptEvent>)]);
      expect(s.first_payment_receipt).toBeNull();
      expect(s.rejected[0]?.reason).toBe(reason);
    });
  }
});

describe("X09 duplicate counts once; reversal updates net", () => {
  it("works", () => {
    expect(reconcilePayments(C, [rc(), rc()]).counted).toEqual(["rcpt-1"]);
    const s = reconcilePayments(C, [rc(), { ...rc(), kind: "reversal", receipt_id: "rev-1", reverses: "rcpt-1", at: 160 }]);
    expect(s.first_payment_receipt).toBe("rcpt-1");
    expect(s.net_paid).toBe(false);
  });
});

describe("X10 late payment excluded from earlier horizon", () => {
  it("works", () => {
    expect(reconcilePayments(C, [rc({ at: 250 })], 200).first_payment_receipt).toBeNull();
    expect(reconcilePayments(C, [rc({ at: 250 })], 300).first_payment_receipt).toBe("rcpt-1");
  });
});

describe("Recovery (pure double): lease loss, timeout, no double effect or reservation", () => {
  it("retries deliver once", async () => {
    const sink = new EffectSink();
    const ob = new Outbox(sink);
    ob.enqueue("j1", "eff-key", { a: 1 });
    ob.enqueue("j1", "eff-key", { a: 1 });
    expect(ob.reservations.size).toBe(1);
    expect(ob.lease("j1", "w1")).toBe(true);
    expect((await ob.deliver("j1", "w1", { timeoutAfterSend: true })).status).toBe("timeout");
    expect(ob.lease("j1", "w2")).toBe(true);
    ob.expireLease("j1");
    expect((await ob.deliver("j1", "w2")).status).toBe("lease_lost");
    ob.lease("j1", "w3");
    expect((await ob.deliver("j1", "w3")).status).toBe("committed");
    expect(sink.count).toBe(1);
    expect(() => transition("committed", "prepared")).toThrow();
  });
});
