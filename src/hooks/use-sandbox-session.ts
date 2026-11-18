import { useCallback, useEffect, useState } from "react";

const KEY = "gtm-sandbox-session";
const fresh = () => `sess-${crypto.randomUUID()}`;

/** Sandbox session id; reset starts a new session (old sessions stay auditable server-side). */
export function useSandboxSession() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const existing = sessionStorage.getItem(KEY);
    const v = existing ?? fresh();
    sessionStorage.setItem(KEY, v);
    setId(v);
  }, []);
  const reset = useCallback(() => {
    const v = fresh();
    sessionStorage.setItem(KEY, v);
    setId(v);
  }, []);
  return { sessionId: id, reset };
}
