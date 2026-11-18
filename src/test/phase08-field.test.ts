import { describe, expect, it } from "vitest";
import sim from "@/server/fixtures/field-sim-20.json";
import oracle from "@/evaluation/field-oracle.json";
import { addBusinessHours, deadlines, type BusinessCalendar } from "@/domain/business-clock";
import { FIELD_GATE_CONFIG, classifyIntake, computeMetrics, confirmedAt, emptyRealStudy, gateDecision, type FieldRecord, type IntakeSubmission } from "@/domain/field";

const NY: BusinessCalendar = { timeZone: "America/New_York", workdays: [1, 2, 3, 4, 5], start: "09:00", end: "17:00", holidays: [] };
const iso = (ms: number) => new Date(ms).toISOString();

describe("business clock", () => {
  it("48 business hours = 6 workdays; 2 business days = 16 working hours (distinct fields)", () => {
    const start = Date.parse("2026-03-02T14:00:00Z"); // Mon 09:00 EST
    const d = deadlines(start, NY, Date.parse("2026-04-01T00:00:00Z"));
    expect(d.workdays_for_48h).toBe(6);
    expect(iso(d.business_48h_deadline_ms)).toBe("2026-03-09T21:00:00.000Z"); // Mon+6 workdays → next Mon 17:00 EDT? see DST test
    expect(iso(d.two_business_days_deadline_ms)).toBe("2026-03-03T22:00:00.000Z"); // Tue 17:00 EST
  });
  it("crosses US DST start (Mar 8 2026) without server-local defaults", () => {
    const start = Date.parse("2026-03-06T21:00:00Z"); // Fri 16:00 EST
    expect(iso(addBusinessHours(start, 2, NY))).toBe("2026-03-09T14:00:00.000Z"); // Mon 10:00 EDT
  });
  it("skips holidays and requires explicit zone", () => {
    const start = Date.parse("2026-12-24T22:00:00Z"); // Thu 17:00 EST
    expect(iso(addBusinessHours(start, 1, { ...NY, holidays: ["2026-12-25"] }))).toBe("2026-12-28T15:00:00.000Z");
    expect(() => addBusinessHours(start, 1, { ...NY, timeZone: "" })).toThrow(/IANA/);
  });
});

describe("phase 08 field readiness", () => {
  const recs = sim as unknown as FieldRecord[];
  const o = (oracle as unknown as { recalculated_metrics_v2: Record<string, Record<string, unknown>> }).recalculated_metrics_v2;
  it("F04 reconstructed synthetic example: 14/20 timely, 1/13 one-request confirmations, 12/13 sent", () => {
    const m = computeMetrics(recs);
    expect([m.timely_verified.numerator, m.timely_verified.denominator]).toEqual([14, 20]);
    expect([m.single_request_resolution.numerator, m.single_request_resolution.denominator]).toEqual([1, 13]);
    expect([m.requests_sent_le_1.numerator, m.requests_sent_le_1.denominator]).toEqual([12, 13]);
    expect(m.direct_trusted_coverage.numerator).toBe(o["verifiable_coverage"]!["direct_coverage_count"]);
    expect(m.visible_verifiable_coverage.numerator).toBe(o["verifiable_coverage"]!["visible_verifiable_at_cutoff_count"]);
    expect(m.authorized_at_cutoff.numerator).toBe(o["verifiable_coverage"]!["authorized_at_cutoff_count"]);
    expect(m.buckets).toEqual(o["verifiable_coverage"]!["cutoff_bucket_distribution"]);
    expect(m.timeliness).toEqual(Object.fromEntries(Object.entries(o["in_time_coverage"]!["timeliness_status_distribution"] as Record<string, number>).filter(([k]) => k !== "uncalculable_deadline")));
    expect(m.median_human_minutes).toBe(6.25);
    expect([m.structured_subsegment_coverage.numerator, m.structured_subsegment_coverage.denominator]).toEqual([16, 19]);
    expect([m.restricted_subsegment_coverage.numerator, m.restricted_subsegment_coverage.denominator]).toEqual([9, 9]);
    expect(m.severe_improper).toBe(0);
    const g = gateDecision(m, { origin: "simulated", provenance_confirmed: false, cohort_mature: false });
    expect(g.decision).toBe("HOLD_OBSERVATION_RESOLVE_CAUSE");
    expect(g.indicators.find((i) => i.name.startsWith("valid confirmed"))!.status).toBe("fail");
  });
  it("F03 reply 09:25, verification 09:33, cutoff 09:30 is not confirmed at 09:30", () => {
    const t = (hm: string) => Date.parse(`2026-11-16T${hm}:00Z`) / 1000;
    expect(confirmedAt({ responded_at: t("09:25"), verified_at: t("09:33") }, t("09:30"))).toBe(false);
    expect(confirmedAt({ responded_at: t("09:25"), verified_at: t("09:33") }, t("09:35"))).toBe(true);
  });
  it("F01/F05 empty real study: 0/20, rates unavailable, HOLD, no accounts", () => {
    const s = emptyRealStudy();
    expect([s.observed, s.target, s.assigned_accounts]).toEqual([0, 20, 0]);
    const m = computeMetrics([]);
    expect(m.timely_verified.pct).toBeNull();
    expect(m.single_request_resolution.unavailable_reason).toBe("no case required buyer contact");
    const g = gateDecision(m, { origin: "real", provenance_confirmed: false, cohort_mature: false });
    expect(g.decision).toBe("HOLD_OBSERVATION_RESOLVE_CAUSE");
    expect(g.indicators.every((i) => i.status === "open")).toBe(true);
  });
  it("F06 thresholds are frozen and versioned", () => {
    expect(Object.isFrozen(FIELD_GATE_CONFIG)).toBe(true);
    expect(FIELD_GATE_CONFIG.version).toBe("field-gate-1.0.0");
    expect([FIELD_GATE_CONFIG.coverage_min_pct, FIELD_GATE_CONFIG.restricted_subsegment_min_pct, FIELD_GATE_CONFIG.timely_min_pct, FIELD_GATE_CONFIG.median_human_minutes_max, FIELD_GATE_CONFIG.single_request_min_pct]).toEqual([65, 80, 60, 10, 75]);
  });
  it("F02 simulated, duplicate, unverifiable custodian and parent/child substitution are rejected or quarantined", async () => {
    const base: IntakeSubmission = { opportunity_id: "op-7f3a", anonymized_account_id: "acc-91", legal_entity_id: "ent-sub", approval_entity_id: "ent-sub", cohort: "prospective", enrolled_at: 10, outcome_known_at_enrollment: false, event_time: 1, known_time: 2, dataset_origin: "real", custodian_id: "cust-1", reviewer_resolution: "resolved" };
    const yes = async () => true, no = async () => false;
    expect((await classifyIntake(base, new Set(), yes)).status).toBe("accepted");
    expect((await classifyIntake({ ...base, dataset_origin: "simulado" }, new Set(), yes)).reasons).toContain("declared_non_real_origin");
    expect((await classifyIntake({ ...base, opportunity_id: "opp-w01a01" }, new Set(), yes)).reasons).toContain("known_synthetic_template_id");
    expect((await classifyIntake(base, new Set(["op-7f3a"]), yes)).reasons).toContain("duplicate_opportunity");
    const q = await classifyIntake({ ...base, custodian_attestation: "a".repeat(64) }, new Set(), no);
    expect(q).toMatchObject({ status: "quarantined", provenance: "unconfirmed" });
    expect(q.reasons).toContain("custodian_unverifiable");
    expect((await classifyIntake({ ...base, approval_entity_id: "ent-parent", parent_entity_id: "ent-parent" }, new Set(), yes)).reasons).toContain("parent_child_scope_substitution");
    expect((await classifyIntake({ ...base, outcome_known_at_enrollment: true }, new Set(), yes)).status).toBe("rejected");
  });
});
