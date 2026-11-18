/** The ONLY type a policy may receive. Contains no latent truth. */
import type { ConfirmSignal, Gate, ProposeSignal } from "./grammar";
export interface ObsEvent { tick: number; action: string; gate?: Gate; signal: ConfirmSignal | ProposeSignal; dependence_group?: string; source_verified?: boolean }
export interface PublicObservation {
  org_id: string; world: number; cluster: string; buyer_group: string;
  tick: number; horizon: number; hours_left: number; events: ObsEvent[]; closed: boolean;
}
export const LATENT_FIELDS = ["truth", "hypothesis", "latent", "gold", "expected", "shock", "future", "approve_draw"] as const;
/** R01: boundary rejects any object carrying latent truth fields (deep). */
export function assertPublic(o: unknown, path = "$"): void {
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o)) {
      if ((LATENT_FIELDS as readonly string[]).includes(k)) throw new Error(`latent field rejected at ${path}.${k}`);
      assertPublic(v, `${path}.${k}`);
    }
  }
}
