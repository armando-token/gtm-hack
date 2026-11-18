/**
 * Opaque permission references. Sealed with HMAC-SHA256 under a server-only secret.
 * The secret is injected by the trusted server (or a disclosed test double in unit tests).
 */
import { canonicalJson, sha256Hex } from "./canonical";
import { keyEquals, type Key, type PermissionRef, type Tick } from "./contracts";
import type { ResolvedAuthority } from "./authority";

export interface PermissionClaims {
  readonly v: 1;
  readonly session: string;
  readonly tenant: string;
  readonly key: Key;
  readonly as_of: number;
  readonly proof_digest: string;
  readonly source_revisions: Readonly<Record<string, number>>;
  readonly registry_version: number;
}

const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

async function hmac(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issuePermission(
  decision: ResolvedAuthority,
  ctx: { session: string; tenant: string; registry_version: number },
  secret: string,
): Promise<PermissionRef> {
  if (decision.state !== "allowed") throw new Error("Cannot issue a permission for a non-allowed decision");
  if (!secret || secret.length < 32) throw new Error("Seal secret missing");
  const claims: PermissionClaims = {
    v: 1,
    session: ctx.session,
    tenant: ctx.tenant,
    key: decision.key,
    as_of: decision.as_of,
    proof_digest: decision.proof_digest,
    source_revisions: decision.source_revisions,
    registry_version: ctx.registry_version,
  };
  const body = b64u(canonicalJson(claims));
  return `pr1.${body}.${await hmac(secret, body)}` as PermissionRef;
}

export type VerifyResult = { ok: true; claims: PermissionClaims } | { ok: false; reason: string };

export async function verifyPermission(
  ref: string,
  expect: { session: string; tenant: string; key: Key; as_of: Tick; proof_digest?: string },
  secret: string,
): Promise<VerifyResult> {
  const [prefix, body, seal, ...rest] = ref.split(".");
  if (prefix !== "pr1" || !body || !seal || rest.length) return { ok: false, reason: "malformed" };
  const sig = await hmac(secret, body);
  if ((await sha256Hex(sig)) !== (await sha256Hex(seal))) return { ok: false, reason: "bad_seal" };
  let claims: PermissionClaims;
  try {
    claims = JSON.parse(unb64u(body));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (claims.session !== expect.session) return { ok: false, reason: "session_mismatch" };
  if (claims.tenant !== expect.tenant) return { ok: false, reason: "tenant_mismatch" };
  if (!keyEquals(claims.key, expect.key)) return { ok: false, reason: "key_mismatch" };
  if (claims.as_of !== expect.as_of) return { ok: false, reason: "as_of_mismatch" };
  if (expect.proof_digest && claims.proof_digest !== expect.proof_digest) return { ok: false, reason: "proof_mismatch" };
  return { ok: true, claims };
}
