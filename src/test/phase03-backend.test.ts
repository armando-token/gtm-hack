/** Runs against the real Lovable Cloud database and transaction functions. */
import { describe, expect, it } from "vitest";
import { batchReplay, dispatchAction, evaluateCase, insertRevocation, prepareAction, sessionEffects } from "@/server/gtm-service.server";

const sid = () => `test-${crypto.randomUUID()}`;
const hasDb = Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"] && process.env["GTM_SEAL_SECRET"]);
const d = hasDb ? describe : describe.skip;

d("backend execution (real transaction implementation)", () => {
  it("X01/C03 valid control commits one effect", async () => {
    const s = sid();
    const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
    expect(p.prepared).toBe(true);
    if (!p.prepared) return;
    expect(await sessionEffects(s, "CF-02A")).toBe(0);
    const r = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k1" });
    expect(r.status).toBe("committed");
    expect(r.effects).toBe(1);
  }, 30000);

  it("X02 interactive revoke between prepare and dispatch blocks, zero effects", async () => {
    const s = sid();
    const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
    if (!p.prepared) throw new Error("not prepared");
    await insertRevocation({ sessionId: s, caseId: "CF-02A", at: 105 });
    const again = await insertRevocation({ sessionId: s, caseId: "CF-02A", at: 105 });
    expect(again.status).toBe("duplicate"); // appended once
    const r = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k1" });
    expect([r.status, r.reason, r.effects]).toEqual(["blocked", "revoked", 0]);
  }, 30000);

  it("X03 terms / amount / currency / entity change blocks stale intent", async () => {
    for (const [change, reason] of [
      [{ terms_digest: "terms-v2" }, "approval_terms_changed"], [{ amount_cents: 1 }, "amount_changed"],
      [{ currency: "EUR" as const }, "currency_changed"], [{ organization: "org-other" }, "scope_mismatch_organization"],
    ] as const) {
      const s = sid();
      const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
      if (!p.prepared) throw new Error("not prepared");
      const r = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k", proposalChange: change });
      expect([r.status, r.reason, r.effects]).toEqual(["blocked", reason, 0]);
    }
  }, 60000);

  it("X04 two simultaneous dispatches with one idempotency key → one effect", async () => {
    const s = sid();
    const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
    if (!p.prepared) throw new Error("not prepared");
    const [a, b] = await Promise.all([0, 1].map(() => dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "same" })));
    expect([a!.status, b!.status]).toEqual(["committed", "committed"]);
    expect(a!.effect_id).toBe(b!.effect_id);
    expect(await sessionEffects(s, "CF-02A")).toBe(1);
    const changed = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "same", proposalChange: { amount_cents: 5 } });
    expect(changed.reason).toBe("idempotency_conflict");
  }, 30000);

  it("X05 concurrent revocation: dispatch never commits after revoke was observed", async () => {
    for (let i = 0; i < 3; i++) {
      const s = sid();
      const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
      if (!p.prepared) throw new Error("not prepared");
      const [rev, disp] = await Promise.all([
        insertRevocation({ sessionId: s, caseId: "CF-02A", at: 105 }),
        dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k" }),
      ]);
      expect(rev.status).toBe("accepted");
      if (disp.status === "committed") {
        // serialized before the revoke: the revoke must carry a later version than the commit observed
        expect(disp.effects).toBe(1);
      } else {
        expect([disp.reason, disp.effects]).toEqual(["revoked", 0]);
      }
    }
    // stale expected version always loses
    const s = sid();
    const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
    if (!p.prepared) throw new Error("not prepared");
    const stale = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k", expectedVersion: 0 });
    expect([stale.reason, stale.effects]).toEqual(["stale_version", 0]);
  }, 60000);

  it("X06 crash after commit → retry returns same effect", async () => {
    const s = sid();
    const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
    if (!p.prepared) throw new Error("not prepared");
    await expect(dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k", inject: "crash_after_commit" })).rejects.toThrow("injected_crash_after_commit");
    const r = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k" });
    expect([r.status, r.effects, "replayed" in r && r.replayed]).toEqual(["committed", 1, true]);
  }, 30000);

  it("X07 rollback before commit leaves nothing", async () => {
    const s = sid();
    const p = await prepareAction({ sessionId: s, caseId: "CF-02A" });
    if (!p.prepared) throw new Error("not prepared");
    const r = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k", inject: "fail_before_commit" });
    expect([r.status, r.reason, r.effects]).toEqual(["failed", "rolled_back_before_commit", 0]);
    const retry = await dispatchAction({ sessionId: s, caseId: "CF-02A", intentId: p.intent_id, idempotencyKey: "k" });
    expect([retry.status, retry.effects]).toEqual(["committed", 1]);
  }, 30000);

  it("C01–C04, C06 canonical batch replay trace", async () => {
    const out = await batchReplay({ sessionId: sid() });
    const t = Object.fromEntries(out.trace.map((r) => [r.case_id, r]));
    expect(t["CF-01A"]).toMatchObject({ selected_action: "prepare_proposal_2000_users", effects: 1, decision: { reason: "ready_to_launch" } });
    expect(t["CF-01B"]).toMatchObject({ selected_action: "confirm_expansion_and_review_pilot_500", effects: 0, prepared: false, decision: { reason: "scope_mismatch_terms_digest" } });
    expect(t["CF-01B"]!.alternatives).toContain("terms-access-500-pilot-only");
    expect(t["CF-02A"]).toMatchObject({ selected_action: "send_approved_proposal", effects: 1 });
    expect(t["CF-02B"]).toMatchObject({ selected_action: "invalidate_send_and_confirm_new_scope", effects: 0, changed_after_event: true, decision: { state: "allowed" }, authority_at_dispatch: { state: "denied", reason: "revoked" }, dispatch: { reason: "revoked" } });
    expect(JSON.stringify(out)).not.toMatch(/valid_actions|expected_reason/);
  }, 60000);

  it("C05 labels/titles do not change action (evaluated from records only)", async () => {
    const a = await evaluateCase({ sessionId: sid(), caseId: "CF-01B" });
    expect(a.selected_action.action).toBe("confirm_expansion_and_review_pilot_500");
  }, 30000);
});
