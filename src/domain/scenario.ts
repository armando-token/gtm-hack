/**
 * Scene 1 (scope) synthetic scenario builder — pure. The request side (requested seats) and the
 * permission side (grant + explicit approval) are built independently: changing the request never
 * touches the approval, and changing the permission fixture changes grant and approval keys together.
 */
import { checkApproval, readinessReason, resolveAuthority } from "./authority";
import { digestOf } from "./canonical";
import { tick, type Approval, type AuthorityRecord, type Key, type PublicCase } from "./contracts";
import { selectAction } from "./policy";

export const SEAT_TERMS = { 500: "terms-access-500-pilot-only", 2000: "terms-access-2000-seats-annual" } as const;
export const PRICE_PER_SEAT_MINOR = 12_000; // $120/seat/yr — synthetic
export type Seats = keyof typeof SEAT_TERMS;

export interface ScopeControls {
  readonly requestedSeats: Seats;
  readonly grantSeats: Seats;
  readonly grantOrganization: string;
  readonly grantCapability: string;
  readonly asOf: number;
  readonly grantValidUntil: number;
}

export function requestOf(base: PublicCase, c: Pick<ScopeControls, "requestedSeats">): { key: Key; amount_minor: number; seats: Seats } {
  return { key: { ...base.target_key, terms_digest: SEAT_TERMS[c.requestedSeats] }, amount_minor: c.requestedSeats * PRICE_PER_SEAT_MINOR, seats: c.requestedSeats };
}

export function permissionOf(base: PublicCase, c: Omit<ScopeControls, "requestedSeats" | "asOf">): { record: AuthorityRecord; approval: Approval } {
  const key: Key = { ...base.target_key, organization: c.grantOrganization, capability: c.grantCapability, terms_digest: SEAT_TERMS[c.grantSeats] };
  const record: AuthorityRecord = {
    evidence_id: `ev-scene1-grant-${c.grantSeats}`, key, source: "registry", revision: 1,
    event_time: tick(80), known_time: tick(80), valid_from: tick(80), valid_until: tick(c.grantValidUntil), effect: "grant",
  } as AuthorityRecord;
  const approval = { evidence_id: `ev-scene1-approval-${c.grantSeats}`, key, occurred_at: 82, known_at: 82, explicit: true } as unknown as Approval;
  return { record, approval };
}

export async function evaluateScope(base: PublicCase, c: ScopeControls, registeredSources: readonly string[]) {
  const request = requestOf(base, c);
  const perm = permissionOf(base, c);
  const records = [perm.record];
  const asOf = tick(c.asOf);
  const authority = await resolveAuthority({ records, key: request.key, asOf, registeredSources });
  const approval = await checkApproval({ approval: perm.approval, key: request.key, asOf, records, registeredSources });
  const readiness = readinessReason(authority, approval);
  const action = selectAction(base.catalogue, readiness);
  return {
    request, permission: perm, as_of: c.asOf, authority, approval, readiness, action,
    request_version: (await digestOf({ key: request.key, amount: request.amount_minor })).slice(0, 12),
    permission_version: (await digestOf({ record: perm.record, approval: perm.approval })).slice(0, 12),
  };
}
