import { createServerFn } from "@tanstack/react-start";

export const getBackendInfo = createServerFn({ method: "GET" }).handler(async () => {
  const { backendInfo } = await import("./gtm-service.server");
  return backendInfo();
});
