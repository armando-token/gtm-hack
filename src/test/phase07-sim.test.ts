import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ambiguitySet, initBelief, update } from "@/domain/sim/belief";
import { generateWorld, OrgEnv } from "@/domain/sim/env";
import { HYPOTHESES } from "@/domain/sim/grammar";
import { assertPublic } from "@/domain/sim/observation";
import { approxRegret, solveExact, DEFAULT_PLAN } from "@/domain/sim/planner";
import { DEFAULT_SIM, newCheckpoint, runSimulation, runWorld, type SimConfig } from "@/domain/sim/runner";
import { fitAndScore } from "@/domain/sim/inference";
import { leaveGroupOut, partialPool } from "@/domain/sim/transfer";
import { PRIOR_GATES } from "@/evaluation/history";

const small: SimConfig = { ...DEFAULT_SIM, worlds: 4, orgsPerWorld: 8, bootstrap: 200 };
const point = (id: string) => Object.fromEntries(HYPOTHESES.map((h) => [h.id, h.id === id ? 1 : 1e-12]));
const hp = DEFAULT_PLAN.hourPenalty;

describe("phase 07 simulator", () => {
  it("R01 boundary rejects latent fields; policies never import env/evaluation", () => {
    expect(() => assertPublic({ org_id: "x", events: [{ truth: 1 }] })).toThrow(/latent/);
    expect(() => assertPublic({ hypothesis: "AND" })).toThrow();
    const src = readFileSync("src/domain/sim/policies.ts", "utf8");
    const imports = [...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    expect(imports.some((i) => /env|evaluation|gold|fixtures/.test(i!))).toBe(false);
    const t = generateWorld({ seed: "s", split: "eval", orgsPerWorld: 3, horizon: 6 }, 0)[0]!;
    const obs = new OrgEnv(t, "s", 6).observe(4);
    expect(() => assertPublic(obs)).not.toThrow();
    expect(JSON.stringify(obs)).not.toContain(t.hypothesis.id);
  });
  it("R02 same seed/config → identical content hash; A/A rerun deterministic", async () => {
    const a = await runSimulation(small), b = await runSimulation(small);
    expect(a.report!.content_hash).toBe(b.report!.content_hash);
    expect(a.report!.run_id).not.toBe(b.report!.run_id);
    const c = await runSimulation({ ...small, seed: "other" });
    expect(c.report!.content_hash).not.toBe(a.report!.content_hash);
  });
  it("R03 delayed observations are invisible at the earlier decision", () => {
    const t = { ...generateWorld({ seed: "s", split: "eval", orgsPerWorld: 1, horizon: 6 }, 0)[0]!, lag: 1 };
    const env = new OrgEnv(t, "s", 6);
    env.act({ type: "confirm", gate: "it" });
    // tick advanced to 1; event recorded at tick 0 visible at 1
    expect(env.observe(4).events.length).toBe(1);
    const env2 = new OrgEnv({ ...t, lag: 3 }, "s", 6); env2.act({ type: "confirm", gate: "it" });
    expect(env2.observe(4).events.length).toBe(0);
  });
  it("R04 exact DP matches hand-computed controls; approximate obeys budget and reports regret", () => {
    const s0 = { events: [], tick: 0, horizon: 3, hours: 4 };
    expect(solveExact(s0, { ...DEFAULT_PLAN, prior: point("NONE") }).value).toBeCloseTo(0.7 - hp, 9);
    expect(solveExact(s0, { ...DEFAULT_PLAN, prior: point("NONE") }).action.type).toBe("propose");
    expect(solveExact(s0, { ...DEFAULT_PLAN, prior: point("UNKNOWN") }).value).toBeCloseTo(0.3 - hp, 9);
    const and = solveExact(s0, { ...DEFAULT_PLAN, prior: point("AND(it,budget)") });
    expect(and.value).toBeCloseTo(-hp + 0.75 * (-hp + 0.75 * (0.7 - hp)), 9);
    expect(and.action.type).toBe("confirm");
    expect(solveExact({ ...s0, horizon: 0 }).value).toBe(0); // negative control
    const r = approxRegret({ events: [], tick: 0, horizon: 5, hours: 4 }, DEFAULT_PLAN, { depth: 1, maxExpansions: 5 });
    expect(r.approx_expansions).toBeLessThanOrEqual(5);
    expect(r.regret).toBeGreaterThanOrEqual(-1e-12);
  });
  it("R05 matched worlds: every strategy sees same orgs and same cap", () => {
    const rows = runWorld(small, 0);
    expect(new Set(rows.map((r) => r.orgs)).size).toBe(1);
    for (const r of rows) { expect(r.hours).toBeLessThanOrEqual(small.hoursCapPerWorld); expect(r.cap_violations).toBe(0); }
  });
  it("R06 held-out group untouched by fit; low history abstains; no authorization transfer", () => {
    const recs = [...Array(20)].map((_, i) => ({ buyer_group: i < 12 ? "bg-a" : "bg-b", y: (i % 2) as 0 | 1 }));
    const a = leaveGroupOut(recs, "bg-b");
    const mutated = recs.map((r) => (r.buyer_group === "bg-b" ? { ...r, y: 1 as const } : r));
    expect(leaveGroupOut(mutated, "bg-b").prediction).toBe(a.prediction);
    expect(partialPool(recs, "novel-1").route).toBe("confirmation_route");
    expect(partialPool(recs, "novel-1").estimate).toBeNull();
    expect(partialPool(recs, "bg-a").authorization).toBe("none");
  });
  it("R07 indistinguishable hypotheses stay in the ambiguity set", () => {
    const b = update(initBelief(), [{ tick: 0, action: "confirm", gate: "it", signal: "required_cleared" }, { tick: 1, action: "confirm", gate: "budget", signal: "required_cleared" }]);
    const amb = ambiguitySet(b);
    expect(amb).toContain("AND(it,budget)"); expect(amb).toContain("ORDER(it>budget)"); expect(amb).toContain("ORDER(budget>it)");
    const dup = update(initBelief(), [{ tick: 0, action: "confirm", gate: "it", signal: "required_cleared", dependence_group: "g" }, { tick: 0, action: "confirm", gate: "it", signal: "required_cleared", dependence_group: "g" }]);
    const once = update(initBelief(), [{ tick: 0, action: "confirm", gate: "it", signal: "required_cleared" }]);
    expect(dup.logw).toEqual(once.logw);
  });
  it("R08 metrics derive from outcomes", async () => {
    const r = (await runSimulation(small)).report!;
    for (const s of r.strategies) {
      expect(s.payments_per_100).toBeCloseTo((s.payments / s.organizations) * 100, 9);
      if (s.hours) expect(s.payments_per_hour).toBeCloseTo(s.payments / s.hours, 9);
      expect(s.cap_violations).toBe(0);
    }
    expect(r.real_customer_increment).toBe(0);
    const pred = fitAndScore(r.predictions, r.predictions, r.predictions);
    expect(pred.per_family.length).toBeGreaterThan(0);
  });
  it("R09 cancel + restart preserves checkpoint and never duplicates effects", async () => {
    const full = (await runSimulation(small)).report!;
    const ctl = new AbortController(); const cp = newCheckpoint(small);
    const part = await runSimulation(small, { signal: ctl.signal, checkpoint: cp, onProgress: (n) => n >= 2 && ctl.abort() });
    expect(part.status).toBe("cancelled");
    expect(Object.keys(cp.worlds).length).toBe(2);
    const resumed = await runSimulation(small, { checkpoint: cp });
    expect(resumed.report!.content_hash).toBe(full.content_hash);
    expect(new Set(cp.effects).size).toBe(cp.effects.length);
  });
  it("R10 historical numbers live only in history; fresh run derives its own", async () => {
    const hist = JSON.stringify(PRIOR_GATES);
    expect(hist).toContain("39.903"); expect(hist).toContain("52.6167");
    const src = ["runner.ts", "policies.ts", "inference.ts", "env.ts"].map((f) => readFileSync(`src/domain/sim/${f}`, "utf8")).join();
    expect(/39\.9|40\.97|52\.6/.test(src)).toBe(false);
    const r = (await runSimulation(small)).report!;
    expect(r.origin).toBe("current_run"); expect(r.numeric_parity).toMatch(/UNVERIFIED/);
  });
});
