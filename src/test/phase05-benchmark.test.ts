import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import cases from "@/server/fixtures/public-cases.json";
import gold from "@/evaluation/gold.json";
import { PublicCaseSchema, assertNoTruthFields } from "@/domain/contracts";
import { executeArms, fullRunReport } from "@/evaluation/full-run";
import { runMetamorphic } from "@/evaluation/metamorphic";
import { scoreRows } from "@/evaluation/four-case";

const all = (cases as unknown[]).map((c) => PublicCaseSchema.parse(c));

describe("phase 05 canonical 24-case benchmark", () => {
  it("Q01 conformance: D 24/0/12, C 14/10/2, B 13/11/1", async () => {
    const r = await fullRunReport(all, "test");
    const m = Object.fromEntries(r.arms.map((a) => [a.arm, [a.valid, a.false_authorize, a.pairs_ok, a.denominator, a.traps, a.pairs_total]]));
    expect(m["D"]).toEqual([24, 0, 12, 24, 12, 12]);
    expect(m["C"]).toEqual([14, 10, 2, 24, 12, 12]);
    expect(m["B"]).toEqual([13, 11, 1, 24, 12, 12]);
    expect(r.unresolved_mismatches).toEqual([]);
    expect(r.inputs_digest).toMatch(/^[0-9a-f]{64}$/);
  });
  it("Q02/Q03 canonical routes", async () => {
    const rows = await executeArms(all);
    const d = (id: string) => rows.find((r) => r.case_id === id && r.arm === "D")!;
    expect(d("CF-01A").action).toBe("prepare_proposal_2000_users");
    expect(d("CF-01B").action).toBe("confirm_expansion_and_review_pilot_500");
    expect(d("CF-02A").trace!.dispatch_committed).toBe(true);
    expect(d("CF-02B").trace!.decision_reason).toBe("ready_to_launch");
    expect(d("CF-02B").trace!.dispatch_committed).toBe(false);
    expect(d("CF-02B").reason).toBe("revoked");
  });
  it("Q04 four group breakdowns come from case records", async () => {
    const r = await fullRunReport(all, "test");
    const d = r.arms.find((a) => a.arm === "D")!;
    expect(d.categories.length).toBe(4);
    expect(d.categories.reduce((s, c) => s + c.total, 0)).toBe(24);
  });
  it("Q05 metamorphic controls all pass and failures would name case and cause", async () => {
    const r = await runMetamorphic(all);
    expect(r.checks.length).toBeGreaterThan(72);
    expect(r.failed).toEqual([]);
  });
  it("mutated gold changes scores only, not policy outputs", async () => {
    const rows = await executeArms(all);
    const before = rows.map((r) => r.action);
    (gold as { valid_actions: string[] }[])[0]!.valid_actions = ["nope"];
    const after = (await executeArms(all)).map((r) => r.action);
    expect(after).toEqual(before);
    expect(scoreRows(rows).arms.find((a) => a.arm === "D")!.valid).toBe(23);
    (gold as { valid_actions: string[] }[])[0]!.valid_actions = ["prepare_proposal_2000_users"];
  });
  it("unseen action in catalogue is rejected, not guessed", async () => {
    const c = structuredClone(all[0]!) as typeof all[number]; (c as { catalogue: string[] }).catalogue = ["brand_new_action"];
    await expect(executeArms([c])).rejects.toThrow(/Unsupported action/);
  });
  it("server intake rejects nested truth payloads", () => {
    expect(() => assertNoTruthFields({ a: { b: [{ expected_reason: "x" }] } })).toThrow(/truth_field_rejected at \$\.a\.b\[0\]\.expected_reason/);
    expect(() => assertNoTruthFields(all[0])).not.toThrow();
  });
  it("Q06 decision modules contain no case_id or expected-action lookup", () => {
    for (const f of ["decide", "policy", "authority", "baselines", "intervention"]) {
      const src = readFileSync(`src/domain/${f}.ts`, "utf8");
      expect(src, f).not.toMatch(/CF-0|MP\d\d|case_id|valid_actions|gold/);
    }
  });
});
