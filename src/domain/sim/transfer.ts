/** Partial-pooling transfer across buyer groups. Produces route priors only — never authorization. */
export interface GroupRecord { buyer_group: string; y: 0 | 1 }
export interface TransferEstimate { group: string; n: number; estimate: number | null; route: "learned_route" | "frozen_reference" | "confirmation_route"; authorization: "none" }

export function partialPool(records: GroupRecord[], group: string, opts = { strength: 10, minSupport: 5, reference: 0.5 }): TransferEstimate {
  const others = records.filter((r) => r.buyer_group !== group);
  const pooled = others.length ? others.reduce((a, r) => a + r.y, 0) / others.length : opts.reference;
  const own = records.filter((r) => r.buyer_group === group); const k = own.reduce((a, r) => a + r.y, 0);
  if (own.length < opts.minSupport) return { group, n: own.length, estimate: null, route: group.startsWith("novel") ? "confirmation_route" : "frozen_reference", authorization: "none" };
  return { group, n: own.length, estimate: (k + opts.strength * pooled) / (own.length + opts.strength), route: "learned_route", authorization: "none" };
}
/** Leave-group-out: the held-out group's records are removed before fitting; the estimate is the pooled rate from other groups. */
export function leaveGroupOut(records: GroupRecord[], heldOut: string, opts = { strength: 10, minSupport: 5, reference: 0.5 }) {
  const train = records.filter((r) => r.buyer_group !== heldOut);
  const pooled = train.length ? train.reduce((a, r) => a + r.y, 0) / train.length : opts.reference;
  const test = records.filter((r) => r.buyer_group === heldOut);
  const brierScore = test.length ? test.reduce((a, r) => a + (pooled - r.y) ** 2, 0) / test.length : null;
  return { held_out: heldOut, train_n: train.length, test_n: test.length, prediction: pooled, brier: brierScore, authorization: "none" as const };
}
