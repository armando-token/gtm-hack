/** Evidence intake: append-only event log, candidate extraction, identity, point-in-time. */
import { digestOf } from "./canonical";
import type { AuthorityRecord, ModuleStatus, Tick } from "./contracts";

export const EVIDENCE_STATUS: ModuleStatus = "PARTIAL";

/* ======================= Append-only event log ======================= */
export interface EvidenceEventInput {
  readonly tenant: string;
  readonly organization: string;
  readonly source: string;
  readonly stream: string;
  readonly revision: number;
  readonly occurred_time: number;
  readonly known_time: number;
  readonly payload: unknown;
  readonly superseded_event_id?: string | undefined;
}
export interface EvidenceEvent extends EvidenceEventInput {
  readonly id: string;
  readonly payload_hash: string;
  readonly registry_version: number;
}
export type AppendResult =
  | { status: "accepted"; event: EvidenceEvent }
  | { status: "duplicate"; event: EvidenceEvent }
  | { status: "conflict"; event: EvidenceEvent; conflicts_with: string[] };

/** Per-session, tenant-partitioned log. Every read/write names tenant + organization. */
export class EvidenceLog {
  private readonly byTenant = new Map<string, EvidenceEvent[]>();
  private version = 0;

  get registryVersion() {
    return this.version;
  }

  async append(input: EvidenceEventInput): Promise<AppendResult> {
    if (!input.tenant || !input.organization) throw new Error("tenant and organization are required");
    const payload_hash = await digestOf(input.payload);
    const list = this.byTenant.get(input.tenant) ?? [];
    const same = list.filter(
      (e) => e.organization === input.organization && e.source === input.source && e.stream === input.stream && e.revision === input.revision,
    );
    const dup = same.find((e) => e.payload_hash === payload_hash);
    if (dup) return { status: "duplicate", event: dup };
    this.version += 1;
    const event: EvidenceEvent = Object.freeze({
      ...input,
      payload_hash,
      registry_version: this.version,
      id: `evt-${this.version}-${payload_hash.slice(0, 12)}`,
    });
    list.push(event);
    this.byTenant.set(input.tenant, list);
    return same.length
      ? { status: "conflict", event, conflicts_with: same.map((e) => e.id) }
      : { status: "accepted", event };
  }

  read(tenant: string, organization?: string): readonly EvidenceEvent[] {
    const list = this.byTenant.get(tenant) ?? [];
    return organization ? list.filter((e) => e.organization === organization) : [...list];
  }

  count(tenant: string, organization?: string): number {
    return this.read(tenant, organization).length;
  }

  /** Same-stream, same-revision events with distinct payloads. */
  conflicts(tenant: string, organization: string): EvidenceEvent[][] {
    const groups = new Map<string, EvidenceEvent[]>();
    for (const e of this.read(tenant, organization)) {
      const k = `${e.source}|${e.stream}|${e.revision}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  }

  async stateHash(tenant: string): Promise<string> {
    return digestOf(this.read(tenant).map((e) => ({ id: e.id, h: e.payload_hash, v: e.registry_version })));
  }

  allEvents(): EvidenceEventInput[] {
    return [...this.byTenant.values()].flat().sort((a, b) => a.registry_version - b.registry_version);
  }

  static async replay(events: readonly EvidenceEventInput[]): Promise<EvidenceLog> {
    const log = new EvidenceLog();
    for (const e of events) {
      const { tenant, organization, source, stream, revision, occurred_time, known_time, payload, superseded_event_id } = e;
      await log.append({ tenant, organization, source, stream, revision, occurred_time, known_time, payload, superseded_event_id });
    }
    return log;
  }
}

/** Trusted authority record → event. Only the server-controlled loader calls this. */
export function authorityRecordEvent(tenant: string, r: AuthorityRecord): EvidenceEventInput {
  return {
    tenant,
    organization: r.key.organization,
    source: r.source,
    stream: `${r.source}:${r.key.actor}:${r.key.capability}:${r.key.action}:${r.key.terms_digest}`,
    revision: r.revision,
    occurred_time: r.event_time,
    known_time: r.known_time,
    payload: r,
  };
}

/* ======================= Point-in-time ======================= */
export function visibleTick(r: Pick<AuthorityRecord, "event_time" | "known_time" | "valid_from">): number {
  return Math.max(r.event_time, r.known_time, r.valid_from);
}
export function visibleAt<T extends Pick<AuthorityRecord, "event_time" | "known_time" | "valid_from">>(records: readonly T[], asOf: Tick): T[] {
  return records.filter((r) => visibleTick(r) <= asOf);
}

/* ======================= Directory / identity ======================= */
export interface DirectoryRow {
  readonly tenant: string;
  readonly organization: string;
  readonly actor_id: string;
  readonly display_name: string;
  readonly role: string;
}
export type IdentityResolution =
  | { status: "resolved"; actor_id: string; role: string }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "name_only"; candidates: string[] }
  | { status: "unresolved" };

/** Trusted identifiers resolve; names/titles never confer identity or authority. */
export function resolveActor(
  directory: readonly DirectoryRow[],
  q: { tenant: string; organization: string; actor_id?: string | null | undefined; display_name?: string | undefined },
): IdentityResolution {
  const scoped = directory.filter((d) => d.tenant === q.tenant);
  const sameName = q.display_name ? scoped.filter((d) => d.display_name.trim().toLowerCase() === q.display_name!.trim().toLowerCase()) : [];
  if (q.actor_id) {
    const hit = scoped.filter((d) => d.actor_id === q.actor_id && d.organization === q.organization);
    if (hit.length === 1) return { status: "resolved", actor_id: hit[0]!.actor_id, role: hit[0]!.role };
    return { status: "unresolved" };
  }
  if (sameName.length > 1) return { status: "ambiguous", candidates: sameName.map((d) => d.actor_id).sort() };
  if (sameName.length === 1) return { status: "name_only", candidates: [sameName[0]!.actor_id] };
  return { status: "unresolved" };
}

/* ======================= Candidate extraction ======================= */
export type CandidatePolarity = "affirm" | "deny" | "hedge" | "past" | "conditional" | "quoted" | "quarantined";
export interface CommunicationInput {
  readonly record_id: string;
  readonly source_id: string;
  readonly source_version: string;
  readonly tenant_id: string;
  readonly organization_id: string;
  readonly speaker: string;
  readonly actor_id?: string | null | undefined;
  readonly speaker_role?: string | undefined;
  readonly dependence_group?: string | undefined;
  readonly text: string;
}
export interface ExtractedCandidate {
  readonly evidence_namespace: "candidate";
  readonly source_id: string;
  readonly record_id: string;
  readonly source_version: string;
  readonly span: { start: number; end: number };
  readonly slice: string;
  readonly speaker: string;
  readonly speaker_role: string | null;
  readonly identity: IdentityResolution;
  readonly quoted_subject: string | null;
  readonly polarity: CandidatePolarity;
  readonly abstention_reason: string | null;
  readonly dependence_group: string | null;
  readonly counts_as_independent: boolean;
  readonly grants_authority: false;
}

const RULES: { polarity: CandidatePolarity; re: RegExp; reason: string | null }[] = [
  { polarity: "quarantined", re: /\b(ignore (all |the )?(previous |prior )?(rules|instructions)|mark (it |this |as )*verified|system prompt|override policy)\b/i, reason: "suspicious_embedded_instruction" },
  { polarity: "deny", re: /\b(do not|don't|cannot|can't|not) (approve|proceed|send|sign)|\b(denied|rejected|declined)\b|\bno (podemos|aprobamos)\b/i, reason: "explicit_denial" },
  { polarity: "past", re: /\b(was|were) (approved|signed off)\b.*\b(last|previous|prior|in 20\d\d)\b|\bpreviously approved\b|\blast year\b/i, reason: "past_permission_not_current" },
  { polarity: "conditional", re: /\b(if|once|provided( that)?|subject to|pending)\b.*\b(approv|sign)|\bapprov\w* (if|once|provided|subject to)\b/i, reason: "conditional_permission" },
  { polarity: "hedge", re: /\b(may|might|could|possibly|perhaps|probably|likely|hope to)\b.*\b(approv|sign|proceed)/i, reason: "hedged_language" },
  { polarity: "quoted", re: /\b(?<subject>(the )?(CFO|CEO|CIO|CTO|VP [A-Z][a-z]+|[A-Z][a-z]+ [A-Z][a-z]+))\b (said|says|told|mentioned|confirmed)\b.*\b(approv|good to go|sign)/i, reason: "attributed_to_third_party" },
  { polarity: "affirm", re: /\b(approv(ed|e|al)|good to go|cleared|signed off|sign-?off|okay to proceed)\b|\b(pueden enviarnos|podemos avanzar|aprobado)\b/i, reason: null },
];

/** Splits body into sentences with absolute offsets in the original text. */
function sentences(text: string): { start: number; end: number; s: string }[] {
  const out: { start: number; end: number; s: string }[] = [];
  const re = /[^\n.!?]+[.!?]?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const s = raw.trim();
    if (!s || /^From:/i.test(s)) continue;
    out.push({ start: m.index + lead, end: m.index + lead + s.length, s });
  }
  return out;
}

export function extractCandidates(rec: CommunicationInput, directory: readonly DirectoryRow[]): ExtractedCandidate[] {
  const identity = resolveActor(directory, {
    tenant: rec.tenant_id,
    organization: rec.organization_id,
    actor_id: rec.actor_id ?? null,
    display_name: rec.speaker,
  });
  const out: ExtractedCandidate[] = [];
  for (const sent of sentences(rec.text)) {
    const rule = RULES.find((r) => r.re.test(sent.s));
    if (!rule) continue;
    const quoted = rule.polarity === "quoted" ? (sent.s.match(RULES[5]!.re)?.groups?.["subject"] ?? null) : null;
    const identityReason = identity.status === "ambiguous" ? "ambiguous_actor_identity" : identity.status !== "resolved" ? "unresolved_actor_identity" : null;
    out.push({
      evidence_namespace: "candidate",
      source_id: rec.source_id,
      record_id: rec.record_id,
      source_version: rec.source_version,
      span: { start: sent.start, end: sent.end },
      slice: rec.text.slice(sent.start, sent.end),
      speaker: rec.speaker,
      speaker_role: rec.speaker_role ?? null,
      identity,
      quoted_subject: quoted,
      polarity: rule.polarity,
      abstention_reason: rule.reason ?? identityReason,
      dependence_group: rec.dependence_group ?? null,
      counts_as_independent: true,
      grants_authority: false,
    });
  }
  return out;
}

/** Correlated copies keep traceability but do not add independent weight. */
export function dedupeByDependence(cands: readonly ExtractedCandidate[]): ExtractedCandidate[] {
  // First record seen in a dependence group is the original; other records in that group are copies.
  const owner = new Map<string, string>();
  return cands.map((c) => {
    if (!c.dependence_group) return c;
    const first = owner.get(c.dependence_group);
    if (!first) owner.set(c.dependence_group, c.record_id);
    return first && first !== c.record_id ? { ...c, counts_as_independent: false } : c;
  });
}
export function independentCount(cands: readonly ExtractedCandidate[]) {
  return cands.filter((c) => c.counts_as_independent).length;
}
