/** Seedable PRNG + stable hashing for the TypeScript simulator. Not Python-compatible by design. */
export const GENERATOR_VERSION = "gtm-ts-sim-v1/sfc32+fnv1a" as const;

export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** 64-bit-ish hex digest from two independent FNV lanes over canonical JSON. */
export function stableHash(value: unknown): string {
  const s = canonicalJson(value);
  const a = fnv1a(s), b = fnv1a("§" + s + s.length);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k])).join(",") + "}";
}
export type Rng = () => number;
export function sfc32(seed: string): Rng {
  let a = fnv1a(seed + ":a"), b = fnv1a(seed + ":b"), c = fnv1a(seed + ":c"), d = 1;
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0;
    const r = (t + d) | 0; c = (c + r) | 0; return (r >>> 0) / 4294967296;
  };
  for (let i = 0; i < 12; i++) next();
  return next;
}
/** Draw keyed by name: same key → same value, independent of call order (common random numbers). */
export function keyedUniform(...parts: (string | number)[]): number { return sfc32(parts.join("|"))(); }
