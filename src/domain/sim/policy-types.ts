import type { Gate } from "./grammar";
export type SimAction = { type: "confirm"; gate: Gate } | { type: "propose" } | { type: "wait" } | { type: "stop" };
