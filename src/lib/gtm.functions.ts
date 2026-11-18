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
