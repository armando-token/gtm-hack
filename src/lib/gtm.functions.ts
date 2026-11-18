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
