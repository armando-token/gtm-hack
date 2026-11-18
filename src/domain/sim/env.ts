/** Evaluator-owned environment. Holds latent truth; policies never import this module. */
import { HYPOTHESES, approveProb, confirmLikelihood, CONFIRM_SIGNALS, type ConfirmSignal, type Gate, type Hypothesis } from "./grammar";
import type { ObsEvent, PublicObservation } from "./observation";
import { keyedUniform, sfc32 } from "./prng";

export const WORLD_FAMILIES = ["and", "or", "veto", "order", "expiry", "selective_response", "capability_corruption", "cluster_shock", "delay", "unknown_actor", "unknown_mechanism"] as const;
export type WorldFamily = (typeof WORLD_FAMILIES)[number];

export interface OrgTruth {
  org_id: string; world: number; cluster: string; buyer_group: string; family: WorldFamily;
  hypothesis: Hypothesis; deadline: number; lag: number; corruption: number; shock: number; pay_delay: number;
}
export interface WorldConfig { seed: string; split: "dev" | "cal" | "eval"; orgsPerWorld: number; horizon: number; families?: readonly WorldFamily[] | undefined }

const pick = <T,>(xs: readonly T[], u: number) => xs[Math.min(xs.length - 1, Math.floor(u * xs.length))]!;
const byKind = (k: string) => HYPOTHESES.filter((h) => h.kind === k);

export function generateWorld(cfg: WorldConfig, world: number): OrgTruth[] {
  const rng = sfc32(`${cfg.seed}/${cfg.split}/w${world}`);
  const fams = cfg.families ?? WORLD_FAMILIES;
  const clusters = ["c0", "c1", "c2", "c3"]; const shocks = Object.fromEntries(clusters.map((c) => [c, rng() < 0.25 ? 0.6 : 1]));
  const out: OrgTruth[] = [];
  for (let i = 0; i < cfg.orgsPerWorld; i++) {
    const family = pick(fams, rng()); const cluster = pick(clusters, rng());
    let pool: Hypothesis[];
    switch (family) {
      case "and": pool = byKind("AND"); break; case "or": pool = byKind("OR"); break;
      case "veto": pool = byKind("VETO"); break; case "order": pool = byKind("ORDER"); break;
      case "unknown_mechanism": pool = byKind("UNKNOWN"); break;
      default: pool = HYPOTHESES.filter((h) => h.kind !== "UNKNOWN");
    }
    const hypothesis = pick(pool, rng());
    out.push({
      org_id: `w${world}-o${i}`, world, cluster, family, hypothesis,
      buyer_group: family === "unknown_actor" ? `novel-${i}` : `bg-${cluster}`,
      deadline: family === "expiry" ? Math.max(1, cfg.horizon - 2) : cfg.horizon,
      lag: family === "delay" ? 1 : 0,
      corruption: family === "capability_corruption" ? 0.4 : 0,
      shock: family === "cluster_shock" ? shocks[cluster]! * 0.8 : shocks[cluster]!,
      pay_delay: family === "delay" ? 2 : 1,
    });
  }
  return out;
}

export type { SimAction } from "./policy-types";
import type { SimAction } from "./policy-types";
export const ACTION_HOURS = { confirm: 1, propose: 1, wait: 0, stop: 0 } as const;

interface Stored extends ObsEvent { visibleAt: number }
export interface OrgOutcome { action_success: number; buyer_responses: number; approved: boolean; paid: boolean; pending: boolean; payment_tick: number | null; predicted?: number }

/** One organization's environment. Draws are keyed by (seed, org, action, gate) — common random numbers across strategies. */
export class OrgEnv {
  private events: Stored[] = []; private trueCleared: Gate[] = []; private asked = new Set<Gate>();
  private t = 0; private closed = false; private out: OrgOutcome = { action_success: 0, buyer_responses: 0, approved: false, paid: false, pending: false, payment_tick: null };
  constructor(private truth: OrgTruth, private seed: string, private horizon: number) {}
  observe(hoursLeft: number): PublicObservation {
    const vis = this.events.filter((e) => e.visibleAt <= this.t).map(({ visibleAt: _v, ...e }) => e);
    return { org_id: this.truth.org_id, world: this.truth.world, cluster: this.truth.cluster, buyer_group: this.truth.buyer_group, tick: this.t, horizon: Math.min(this.horizon, this.truth.deadline), hours_left: hoursLeft, events: vis, closed: this.closed };
  }
  get tick() { return this.t; }
  get isClosed() { return this.closed || this.t >= Math.min(this.horizon, this.truth.deadline); }
  act(a: SimAction): void {
    if (this.isClosed) return;
    const k = [this.seed, this.truth.org_id];
    if (a.type === "stop") { this.closed = true; return; }
    if (a.type === "wait") { this.t++; return; }
    this.out.action_success++;
    if (a.type === "confirm") {
      const n = this.asked.has(a.gate) ? 1 : 0; this.asked.add(a.gate);
      const u = keyedUniform(...k, "confirm", a.gate, n);
      let acc = 0; let sig: ConfirmSignal = "no_response";
      for (const s of CONFIRM_SIGNALS) { acc += confirmLikelihood(this.truth.hypothesis, a.gate, s); if (u < acc) { sig = s; break; } }
      if (sig === "required_cleared" || sig === "not_required") this.trueCleared.push(a.gate);
      if (sig !== "no_response") this.out.buyer_responses++;
      let shown: ConfirmSignal = sig;
      if (sig === "no_response" && keyedUniform(...k, "corrupt", a.gate, n) < this.truth.corruption) shown = "required_cleared";
      this.events.push({ tick: this.t, action: "confirm", gate: a.gate, signal: shown, source_verified: shown === sig, visibleAt: this.t + this.truth.lag });
      if (sig === "veto") this.closed = true;
      this.t++; return;
    }
    // propose
    const p = approveProb(this.truth.hypothesis, this.trueCleared) * this.truth.shock;
    const approved = keyedUniform(...k, "approve") < p;
    this.events.push({ tick: this.t, action: "propose", signal: approved ? "approved" : "rejected", visibleAt: this.t + this.truth.lag });
    if (approved) {
      this.out.approved = true; this.out.buyer_responses++;
      const pt = this.t + this.truth.pay_delay; this.out.payment_tick = pt;
      if (pt <= Math.min(this.horizon, this.truth.deadline)) this.out.paid = true; else this.out.pending = true;
    }
    this.closed = true; this.t++;
  }
  outcome(): OrgOutcome { return { ...this.out }; }
}
