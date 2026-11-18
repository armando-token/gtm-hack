import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Session = z.string().regex(/^[a-zA-Z0-9-]{8,64}$/);

export const listDemoCasesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listDemoCases } = await import("@/server/gtm-service.server");
  return listDemoCases();
});

export const evaluateCaseFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ sessionId: Session, caseId: z.string().max(32), asOf: z.number().int().nonnegative().optional() }).strict().parse(d))
  .handler(async ({ data }) => {
    const { evaluateCase } = await import("@/server/gtm-service.server");
    return evaluateCase(data);
  });

export const verifyPermissionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ sessionId: Session, caseId: z.string().max(32), asOf: z.number().int().nonnegative(), ref: z.string().max(4096) }).strict().parse(d))
  .handler(async ({ data }) => {
    const { checkPermission } = await import("@/server/gtm-service.server");
    return checkPermission(data);
  });

const Base = { sessionId: Session, caseId: z.string().max(32) };

export const prepareActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object(Base).strict().parse(d))
  .handler(async ({ data }) => {
    const { prepareAction } = await import("@/server/gtm-service.server");
    return prepareAction(data);
  });

export const dispatchActionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ...Base, intentId: z.string().uuid(), idempotencyKey: z.string().min(4).max(80) }).strict().parse(d))
  .handler(async ({ data }) => {
    const { dispatchAction } = await import("@/server/gtm-service.server");
    return dispatchAction(data);
  });

export const insertRevocationFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ ...Base, at: z.number().int().nonnegative().optional() }).strict().parse(d))
  .handler(async ({ data }) => {
    const { insertRevocation } = await import("@/server/gtm-service.server");
    return insertRevocation(data);
  });

export const batchReplayFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ sessionId: Session }).strict().parse(d))
  .handler(async ({ data }) => {
    const { batchReplay } = await import("@/server/gtm-service.server");
    return batchReplay(data);
  });

const Seats = z.union([z.literal(500), z.literal(2000)]);
export const evaluateScopeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    requestedSeats: Seats, grantSeats: Seats,
    grantOrganization: z.enum(["org-f500-telco", "org-f500-telco-emea-sub"]),
    grantCapability: z.enum(["approve_spend", "approve_sandbox"]),
    asOf: z.number().int().min(0).max(1000), grantValidUntil: z.number().int().min(0).max(1000),
  }).strict().parse(d))
  .handler(async ({ data }) => {
    const { evaluateScopeScenario } = await import("@/server/gtm-service.server");
    return evaluateScopeScenario(data);
  });

export const fourCaseRunFn = createServerFn({ method: "POST" }).handler(async () => {
  const { fourCaseRun } = await import("@/server/gtm-service.server");
  return fourCaseRun();
});

export const sessionTimelineFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object(Base).strict().parse(d))
  .handler(async ({ data }) => {
    const { sessionTimeline } = await import("@/server/gtm-service.server");
    return sessionTimeline(data);
  });

export const fullRunFn = createServerFn({ method: "POST" }).handler(async () => {
  const { fullRun } = await import("@/server/gtm-service.server");
  return fullRun();
});

export const metamorphicRunFn = createServerFn({ method: "POST" }).handler(async () => {
  const { metamorphicRun } = await import("@/server/gtm-service.server");
  return metamorphicRun();
});

export const fieldReportFn = createServerFn({ method: "GET" }).handler(async () => {
  const { fieldReport } = await import("@/server/gtm-service.server");
  return fieldReport();
});

const Num = z.number().int().nonnegative();
export const classifyIntakeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    opportunity_id: z.string().max(80), anonymized_account_id: z.string().max(80), legal_entity_id: z.string().max(80), approval_entity_id: z.string().max(80),
    parent_entity_id: z.string().max(80).nullable().optional(), cohort: z.enum(["retrospective", "prospective"]),
    enrolled_at: Num, outcome_known_at_enrollment: z.boolean(), event_time: Num, known_time: Num,
    sent_at: Num.nullable().optional(), responded_at: Num.nullable().optional(), verified_at: Num.nullable().optional(),
    dataset_origin: z.string().max(32), custodian_id: z.string().max(80), custodian_attestation: z.string().max(128).nullable().optional(),
    evidence_ref: z.string().max(256).nullable().optional(), reviewer_resolution: z.enum(["resolved", "disagreement"]).nullable(),
    batch_id: z.string().max(80).optional(), source_reference_id: z.string().max(120).optional(),
  }).strict().parse(d))
  .handler(async ({ data }) => {
    const { classifyFieldIntake } = await import("@/server/gtm-service.server");
    return classifyFieldIntake(data as never);
  });
