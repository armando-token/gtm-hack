import { describe, expect, it } from "vitest";
import { checkApproval, resolveAuthority } from "@/domain/authority";
import { KEY_AXES, tick, type AuthorityRecord, type Key } from "@/domain/contracts";
import { issuePermission, verifyPermission } from "@/domain/permission";
import { sha256Hex } from "@/domain/canonical";

const SRC = ["registry", "buyer_admin"];
const K: Key = { tenant: "t", organization: "o", actor: "a", capability: "approve_spend", action: "standard_offer", terms_digest: "terms-2000" };
const R = (p: Partial<AuthorityRecord> = {}): AuthorityRecord => ({
  evidence_id: "e" + Math.random(), key: K, source: "registry", revision: 1,
  event_time: tick(10), known_time: tick(10), valid_from: tick(10), valid_until: tick(200), effect: "grant", ...p,
});
const resolve = (records: AuthorityRecord[], asOf = 100, key = K) => resolveAuthority({ records, key, asOf: tick(asOf), registeredSources: SRC });
// Disclosed authority-service double: test-only seal secret.
const TEST_SECRET = "test-double-secret-0123456789abcdef0123456789";

describe("SHA-256 is real", () => {
  it("matches the known vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("A01 each key axis mutation blocks", () => {
  for (const axis of KEY_AXES) {
    it(`${axis}`, async () => {
      const d = await resolve([R({ key: { ...K, [axis]: K[axis] + "-x" } })]);
      expect(d.state).toBe("unknown");
      expect(d.reason).toBe(`scope_mismatch_${axis}`);
    });
  }
});

describe("A02 expiry exclusive", () => {
  it("valid_until=100 blocks at 100, permits at 99", async () => {
    expect((await resolve([R({ valid_until: tick(100) })], 100)).reason).toBe("expired");
    expect((await resolve([R({ valid_until: tick(100) })], 99)).state).toBe("allowed");
  });
});

describe("A03 revoke then regrant", () => {
  it("rev2 revoke denies, rev3 regrant allows", async () => {
    const g1 = R({ revision: 1 }), r2 = R({ revision: 2, effect: "revoke", event_time: tick(50), known_time: tick(50), valid_from: tick(50) });
    expect((await resolve([g1, r2])).reason).toBe("revoked");
    const g3 = R({ revision: 3, event_time: tick(60), known_time: tick(60), valid_from: tick(60) });
    expect((await resolve([g1, r2, g3])).state).toBe("allowed");
  });
});

describe("A04 future-known / future-effective", () => {
  it("unavailable at earlier cutoff", async () => {
    expect((await resolve([R({ known_time: tick(130) })])).reason).toBe("not_yet_known");
    expect((await resolve([R({ valid_from: tick(130) })])).reason).toBe("not_yet_effective");
  });
});

describe("A05 distinct latest records conflict", () => {
  it("same stream, same revision, even same effect", async () => {
    const d = await resolve([R({ evidence_id: "x1" }), R({ evidence_id: "x2" })]);
    expect(d.state).toBe("conflict");
    const same = R({ evidence_id: "dup" });
    expect((await resolve([same, { ...same }])).state).toBe("allowed");
  });
});

describe("A06 grant + explicit deny across sources", () => {
  it("denied/explicit_deny with both logged", async () => {
    const d = await resolve([R({ source: "buyer_admin" }), R({ effect: "explicit_deny" })]);
    expect([d.state, d.reason]).toEqual(["denied", "explicit_deny"]);
    expect(d.proof.conflicts.some((c) => c.source === "buyer_admin")).toBe(true);
    expect(d.log.join(" ")).toMatch(/disagreement/);
  });
});

describe("A07 expired newest grant does not fall back", () => {
  it("older valid grant is ignored", async () => {
    const older = R({ revision: 1, valid_until: tick(300) });
    const newer = R({ revision: 2, event_time: tick(20), known_time: tick(20), valid_from: tick(20), valid_until: tick(90) });
    expect((await resolve([older, newer])).reason).toBe("expired");
  });
});

describe("A08 sandbox grant cannot authorize spend / parent / altered terms", () => {
  it("each blocks", async () => {
    const sandbox = R({ key: { ...K, capability: "approve_sandbox" } });
    expect((await resolve([sandbox])).state).not.toBe("allowed");
    expect((await resolve([R({ key: { ...K, organization: "o-sub" } })])).reason).toBe("scope_mismatch_organization");
    expect((await resolve([R()], 100, { ...K, terms_digest: "terms-2000-v2" })).reason).toBe("scope_mismatch_terms_digest");
  });
});

describe("A09 approval failures are independent", () => {
  const base = { key: K, asOf: tick(100), records: [R()], registeredSources: SRC };
  const ok = { key: K, occurred_at: tick(20), known_at: tick(25), explicit: true };
  it("valid passes", async () => expect((await checkApproval({ ...base, approval: ok })).ok).toBe(true));
  it("missing", async () => expect((await checkApproval({ ...base, approval: null })).reason).toBe("missing_approval"));
  it("implicit", async () => expect((await checkApproval({ ...base, approval: { ...ok, explicit: false } })).reason).toBe("approval_not_explicit"));
  it("terms changed", async () => expect((await checkApproval({ ...base, approval: { ...ok, key: { ...K, terms_digest: "v2" } } })).reason).toBe("approval_terms_changed"));
  it("scope changed", async () => expect((await checkApproval({ ...base, approval: { ...ok, key: { ...K, organization: "p" } } })).reason).toBe("scope_mismatch_organization"));
  it("timeline invalid", async () => expect((await checkApproval({ ...base, approval: { ...ok, known_at: tick(150) } })).reason).toBe("approval_timeline_invalid"));
  it("no authority at occurrence", async () => expect((await checkApproval({ ...base, approval: { ...ok, occurred_at: tick(5), known_at: tick(6) } })).ok).toBe(false));
});

describe("A10 forged / replayed permission refs fail", () => {
  it("only matching session+tenant+key+as_of verifies", async () => {
    const d = await resolve([R()]);
    const ref = await issuePermission(d, { session: "sess-aaaaaaaa", tenant: "t", registry_version: 1 }, TEST_SECRET);
    const exp = { session: "sess-aaaaaaaa", tenant: "t", key: K, as_of: tick(100) };
    expect((await verifyPermission(ref, exp, TEST_SECRET)).ok).toBe(true);
    expect(await verifyPermission(ref, { ...exp, session: "sess-bbbbbbbb" }, TEST_SECRET)).toEqual({ ok: false, reason: "session_mismatch" });
    expect(await verifyPermission(ref, { ...exp, tenant: "t2" }, TEST_SECRET)).toEqual({ ok: false, reason: "tenant_mismatch" });
    const [p, body, sig] = ref.split(".");
    const tampered = `${p}.${body!.slice(0, -2)}xx.${sig}`;
    expect((await verifyPermission(tampered, exp, TEST_SECRET)).ok).toBe(false);
    expect((await verifyPermission("pr1.client.made", exp, TEST_SECRET)).ok).toBe(false);
    expect((await verifyPermission(ref, exp, "another-secret-0123456789abcdef0123456789")).ok).toBe(false);
  });
});
