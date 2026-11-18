/** Evaluator-side runner: owns worlds, applies policies through the public boundary, accounts resources and outcomes. */
import { CONTRACT_VERSION } from "../contracts";
import { generateWorld, OrgEnv, ACTION_HOURS, WORLD_FAMILIES, type OrgTruth, type WorldFamily } from "./env";
import { POLICIES, DEFAULT_PARAMS } from "./policies";
import { GENERATOR_VERSION, stableHash } from "./prng";
import { pairedBootstrap, wilson } from "./stats";

export const SIM_ENGINE_REVISION = "sim-engine-ts@phase07-v1";
export const CONTRACT_HASH = stableHash({ contract: CONTRACT_VERSION, engine: SIM_ENGINE_REVISION });

export interface SimConfig {
  seed: string; worlds: number; orgsPerWorld: number; horizon: number; hoursCapPerWorld: number;
  strategies: string[]; reference: string; bootstrap: number; families?: WorldFamily[] | undefined;
  split?: "dev" | "cal" | "eval" | undefined;
}
export const DEFAULT_SIM: SimConfig = {
  seed: "event-sim-1", worlds: 12, orgsPerWorld: 20, horizon: 6, hoursCapPerWorld: 50,
  strategies: ["greedy", "catalogue_only", "fixed_sequence", "spiced", "random_feasible", "deterministic_contingent", "beam", "exact_dp", "oracle"],
  reference: "greedy", bootstrap: 500,
};
export function seedManifest(c: SimConfig) {
  return { generator_version: GENERATOR_VERSION, development: [0, 1, 2, 3].map((i) => `${c.seed}/dev/w${i}`), calibration: [0, 1, 2, 3].map((i) => `${c.seed}/cal/w${i}`), evaluation: Array.from({ length: c.worlds }, (_, i) => `${c.seed}/${c.split ?? "eval"}/w${i}`) };
}

export interface Prediction { family: WorldFamily; p: number; y: 0 | 1 | null; buyer_group: string; world: number }
export interface StrategyWorld {
  strategy: string; world: number; orgs: number; payments: number; pending: number; approvals: number; responses: number;
  hours: number; cap_rejections: number; cap_violations: number; effects: string[]; predictions: Prediction[];
}

export function simulateStrategyWorld(c: SimConfig, truths: OrgTruth[], strategy: string, world: number): StrategyWorld {
  const pol = POLICIES[strategy]; if (!pol) throw new Error(`unknown strategy ${strategy}`);
  const r: StrategyWorld = { strategy, world, orgs: truths.length, payments: 0, pending: 0, approvals: 0, responses: 0, hours: 0, cap_rejections: 0, cap_violations: 0, effects: [], predictions: [] };
  const seed = `${c.seed}/${c.split ?? "eval"}/w${world}`;
  for (const t of truths) {
    const env = new OrgEnv(t, seed, c.horizon);
    const perAccountCap = 4; let accHours = 0; let pred: number | null = null;
    for (let step = 0; step < c.horizon + 1 && !env.isClosed; step++) {
      const hoursLeft = Math.min(c.hoursCapPerWorld - r.hours, perAccountCap - accHours);
      const obs = env.observe(hoursLeft);
      const ctx = { params: DEFAULT_PARAMS, seed, oracle_hypothesis: pol.diagnostic ? t.hypothesis.id : undefined };
      const a = pol.decide(obs, ctx);
      const cost = ACTION_HOURS[a.type];
      if (cost > hoursLeft) { r.cap_rejections++; env.act({ type: "stop" }); break; }
      if (a.type === "propose") pred = pol.predict(obs, ctx);
      env.act(a); r.hours += cost; accHours += cost;
    }
    const o = env.outcome();
    r.responses += o.buyer_responses;
    if (o.approved) r.approvals++;
    if (o.paid) { r.payments++; r.effects.push(`${seed}:${t.org_id}:${strategy}:payment`); }
    if (o.pending) r.pending++;
    if (pred !== null) r.predictions.push({ family: t.family, p: pred, y: o.pending ? null : o.approved ? 1 : 0, buyer_group: t.buyer_group, world });
  }
  if (r.hours > c.hoursCapPerWorld) r.cap_violations++;
  return r;
}

export interface Checkpoint { config_hash: string; worlds: Record<number, StrategyWorld[]>; effects: string[] }
export function newCheckpoint(c: SimConfig): Checkpoint { return { config_hash: stableHash(c), worlds: {}, effects: [] }; }

export function runWorld(c: SimConfig, w: number): StrategyWorld[] {
  const truths = generateWorld({ seed: c.seed, split: c.split ?? "eval", orgsPerWorld: c.orgsPerWorld, horizon: c.horizon, families: c.families }, w);
  return c.strategies.map((s) => simulateStrategyWorld(c, truths, s, w));
}
/** Idempotent commit of one world into the checkpoint: re-running a committed world never duplicates effects. */
export function commitWorld(cp: Checkpoint, w: number, rows: StrategyWorld[]) {
  if (cp.worlds[w]) return false;
  cp.worlds[w] = rows; const seen = new Set(cp.effects);
  for (const r of rows) for (const e of r.effects) if (!seen.has(e)) { seen.add(e); cp.effects.push(e); }
  return true;
}

export async function runSimulation(c: SimConfig, opts: { signal?: AbortSignal; checkpoint?: Checkpoint; onProgress?: (done: number) => void; yieldEvery?: () => Promise<void> } = {}) {
  const cp = opts.checkpoint ?? newCheckpoint(c);
  if (cp.config_hash !== stableHash(c)) throw new Error("checkpoint belongs to a different configuration");
  const started = Date.now();
  for (let w = 0; w < c.worlds; w++) {
    if (opts.signal?.aborted) return { status: "cancelled" as const, checkpoint: cp };
    if (!cp.worlds[w]) commitWorld(cp, w, runWorld(c, w));
    opts.onProgress?.(Object.keys(cp.worlds).length);
    if (opts.yieldEvery) await opts.yieldEvery();
  }
  return { status: "completed" as const, checkpoint: cp, report: summarize(c, cp, Date.now() - started) };
}

export function summarize(c: SimConfig, cp: Checkpoint, elapsedMs: number) {
  const rows = Object.values(cp.worlds).flat();
  const by = (s: string) => rows.filter((r) => r.strategy === s).sort((a, b) => a.world - b.world);
  const strategies = c.strategies.map((s) => {
    const rs = by(s); const orgs = rs.reduce((a, r) => a + r.orgs, 0); const pay = rs.reduce((a, r) => a + r.payments, 0); const hours = rs.reduce((a, r) => a + r.hours, 0);
    const ref = by(c.reference); const diffs = rs.map((r, i) => (r.payments / r.orgs - ref[i]!.payments / ref[i]!.orgs) * 100);
    const ci = wilson(pay, orgs);
    return {
      strategy: s, diagnostic: !!POLICIES[s]?.diagnostic, organizations: orgs, payments: pay,
      payments_per_100: orgs ? (pay / orgs) * 100 : null, payments_per_hour: hours ? pay / hours : null,
      wilson95_per_100: { lo: ci.lo === null ? null : ci.lo * 100, hi: ci.hi === null ? null : ci.hi * 100 },
      pending: rs.reduce((a, r) => a + r.pending, 0), approvals: rs.reduce((a, r) => a + r.approvals, 0), buyer_responses: rs.reduce((a, r) => a + r.responses, 0),
      hours, cap_rejections: rs.reduce((a, r) => a + r.cap_rejections, 0), cap_violations: rs.reduce((a, r) => a + r.cap_violations, 0),
      paired_vs_reference: s === c.reference ? null : pairedBootstrap(diffs, c.bootstrap, `${c.seed}/bootstrap/${s}`),
    };
  });
  const content = { config: c, strategies, effects: [...cp.effects].sort() };
  return {
    origin: "current_run" as const, run_id: `sim-${stableHash(content).slice(0, 8)}-${Date.now().toString(36)}`,
    contract_hash: CONTRACT_HASH, generator_version: GENERATOR_VERSION, software_revision: SIM_ENGINE_REVISION,
    seed_manifest: seedManifest(c), config: c, worlds: Object.keys(cp.worlds).length, organizations_per_world: c.orgsPerWorld,
    cluster_structure: "4 clusters per world (c0–c3); buyer_group = cluster unless unknown_actor", families: c.families ?? WORLD_FAMILIES,
    outcome_denominator: "all assigned organizations (intention-to-treat)", strategies, effects_committed: cp.effects.length,
    real_customer_increment: 0, elapsed_ms: elapsedMs, content_hash: stableHash(content),
    numeric_parity: "UNVERIFIED — new TypeScript generator/PRNG; a new experiment protocol, not a replay of the Python study",
    predictions: rows.filter((r) => r.strategy === c.reference).flatMap((r) => r.predictions),
  };
}
export type SimReport = NonNullable<Awaited<ReturnType<typeof runSimulation>>["report"]>;
