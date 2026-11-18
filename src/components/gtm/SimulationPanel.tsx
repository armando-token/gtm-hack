import { useRef, useState } from "react";
import { Panel } from "@/components/gtm/AppShell";
import { btn, btnPrimary, field } from "@/components/gtm/DemoParts";
import { DEFAULT_SIM, newCheckpoint, runSimulation, type Checkpoint, type SimConfig, type SimReport } from "@/domain/sim/runner";
import { fitAndScore } from "@/domain/sim/inference";
import { approxRegret, DEFAULT_PLAN } from "@/domain/sim/planner";
import { leaveGroupOut } from "@/domain/sim/transfer";

const E_STRATS = ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7"];
const fmt = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? "—" : x.toFixed(d));
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export const PROTOCOL_STATUS = [
  { id: "R01", item: "Truth boundary / no evaluator import", impl: "VERIFIED", note: "vitest phase07-sim R01" },
  { id: "R02", item: "Deterministic content hash, A/A", impl: "VERIFIED", note: "R02" },
  { id: "R03", item: "Delayed observation visibility", impl: "VERIFIED", note: "R03" },
  { id: "R04", item: "Exact DP vs hand controls; beam budget + regret", impl: "VERIFIED", note: "R04" },
  { id: "R05", item: "Matched worlds, identical caps", impl: "VERIFIED", note: "R05" },
  { id: "R06", item: "Leave-group-out, low-history abstention", impl: "VERIFIED", note: "R06" },
  { id: "R07", item: "Ambiguity sets, dependence groups once", impl: "VERIFIED", note: "R07" },
  { id: "R08", item: "Per-100, per-hour, caps, maturity from outcomes", impl: "VERIFIED", note: "R08" },
  { id: "R09", item: "Cancel/restart without duplicate effects", impl: "VERIFIED", note: "R09 (in-memory checkpoint, not a durable worker)" },
  { id: "R10", item: "Historical numbers isolated", impl: "VERIFIED", note: "R10" },
  { id: "MCTS", item: "Original MCTS planner", impl: "NOT REBUILT", note: "beam expectimax used instead; identified per run" },
  { id: "G2-G5 parity", item: "Historical numeric parity", impl: "UNVERIFIED", note: "new generator/PRNG = new protocol" },
];

export function SimulationPanel() {
  const [cfg, setCfg] = useState<SimConfig>(DEFAULT_SIM);
  const [mode, setMode] = useState<"strategies" | "attribution">("strategies");
  const [report, setReport] = useState<SimReport | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "cancelled" | "completed">("idle");
  const [done, setDone] = useState(0);
  const cpRef = useRef<Checkpoint | null>(null);
  const ctl = useRef<AbortController | null>(null);
  const [extra, setExtra] = useState<{ pred: ReturnType<typeof fitAndScore>; regret: ReturnType<typeof approxRegret>; lgo: ReturnType<typeof leaveGroupOut> } | null>(null);

  const active: SimConfig = mode === "attribution" ? { ...cfg, strategies: E_STRATS, reference: "E0" } : cfg;
  const run = async (resume: boolean) => {
    ctl.current = new AbortController(); setStatus("running");
    if (!resume || !cpRef.current) { cpRef.current = newCheckpoint(active); setDone(0); }
    try {
      const r = await runSimulation(active, { signal: ctl.current.signal, checkpoint: cpRef.current, onProgress: setDone, yieldEvery: tick });
      if (r.status === "cancelled") { setStatus("cancelled"); return; }
      setReport(r.report!); setStatus("completed");
      const [dev, cal] = await Promise.all(["dev", "cal"].map(async (split) => (await runSimulation({ ...active, worlds: 4, split: split as "dev" | "cal", strategies: [active.reference] })).report!.predictions));
      const ev = r.report!.predictions;
      setExtra({ pred: fitAndScore(dev!, cal!, ev), regret: approxRegret({ events: [], tick: 0, horizon: active.horizon, hours: 4 }, DEFAULT_PLAN, { depth: 1, maxExpansions: 20 }), lgo: leaveGroupOut(ev.filter((p) => p.y !== null).map((p) => ({ buyer_group: p.buyer_group, y: p.y as 0 | 1 })), "bg-c0") });
    } catch (e) { setStatus("idle"); throw e; }
  };
  const num = (k: keyof SimConfig, label: string, min: number, max: number) => (
    <label className="text-xs text-muted-foreground">{label}
      <input type="number" aria-label={label} className={field} min={min} max={max} value={cfg[k] as number} disabled={status === "running"}
        onChange={(e) => { setCfg({ ...cfg, [k]: Math.max(min, Math.min(max, Number(e.target.value) || min)) }); cpRef.current = null; }} />
    </label>
  );
  const exportHref = report ? `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ ...report, prediction: extra?.pred, regret: extra?.regret, leave_group_out: extra?.lgo, protocol_status: PROTOCOL_STATUS }, null, 2))}` : undefined;

  return (
    <Panel title="Policy simulation · live engine" status={report ? "VERIFIED" : "PARTIAL"}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <label className="text-xs text-muted-foreground">Seed<input aria-label="Seed" className={field} value={cfg.seed} disabled={status === "running"} onChange={(e) => { setCfg({ ...cfg, seed: e.target.value }); cpRef.current = null; }} /></label>
        {num("worlds", "Worlds", 2, 60)}{num("orgsPerWorld", "Organizations per world", 2, 100)}{num("hoursCapPerWorld", "Hours cap per world", 4, 400)}{num("horizon", "Horizon (ticks)", 2, 8)}
        <label className="text-xs text-muted-foreground">Comparison
          <select aria-label="Comparison" className={field} value={mode} disabled={status === "running"} onChange={(e) => { setMode(e.target.value as typeof mode); cpRef.current = null; }}>
            <option value="strategies">Strategies vs greedy</option><option value="attribution">E0–E7 attribution</option>
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className={btnPrimary} disabled={status === "running"} onClick={() => run(false)}>Run simulation</button>
        <button className={btn} disabled={status !== "running"} onClick={() => ctl.current?.abort()}>Cancel</button>
        <button className={btn} disabled={status !== "cancelled"} onClick={() => run(true)}>Resume from checkpoint</button>
        {exportHref && <a className={btn} download={`${report!.run_id}.json`} href={exportHref}>Export simulation JSON</a>}
        <span className="font-mono text-xs" aria-live="polite">status {status} · worlds {done}/{active.worlds}</span>
      </div>
      <p className="mt-2 text-xs">Synthetic worlds only — never counted as real customers. Mode E-bits: 1 verified extraction, 2 belief model, 4 exact DP planner.</p>

      {report && (
        <div className="mt-3 space-y-3">
          <p className="font-mono text-[11px]">run_id {report.run_id} · content {report.content_hash} · {report.generator_version} · {report.software_revision} · contract {report.contract_hash} · {report.worlds} worlds × {report.organizations_per_world} orgs · {report.elapsed_ms} ms · {report.numeric_parity}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground"><tr><th className="py-1">Strategy</th><th>Payments/100</th><th>Wilson 95%</th><th>Δ vs {active.reference} (paired bootstrap)</th><th>Payments/hour</th><th>Hours</th><th>Pending</th><th>Cap rejections</th><th>Cap violations</th></tr></thead>
              <tbody className="font-mono">
                {report.strategies.map((s) => (
                  <tr key={s.strategy} className="border-t border-border">
                    <td className="py-1">{s.strategy}{s.diagnostic ? " (diagnostic)" : ""}</td><td>{fmt(s.payments_per_100)}</td><td>[{fmt(s.wilson95_per_100.lo)}, {fmt(s.wilson95_per_100.hi)}]</td>
                    <td>{s.paired_vs_reference ? `${fmt(s.paired_vs_reference.mean)} [${fmt(s.paired_vs_reference.lo)}, ${fmt(s.paired_vs_reference.hi)}]` : "reference"}</td>
                    <td>{fmt(s.payments_per_hour, 3)}</td><td>{s.hours}</td><td>{s.pending}</td><td>{s.cap_rejections}</td><td className={s.cap_violations ? "text-denied" : ""}>{s.cap_violations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {extra && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <h3 className="mb-1 text-xs font-semibold">Prediction by family (eval, matured n={extra.pred.eval_matured}, pending {extra.pred.eval_pending}; α={extra.pred.calibrated_alpha} fit on calibration)</h3>
                <table className="w-full text-left text-[11px]"><thead className="text-muted-foreground"><tr><th>Family</th><th>n</th><th>Brier cand.</th><th>Brier ref.</th><th>Pooled online</th><th>Decision</th></tr></thead>
                  <tbody className="font-mono">{extra.pred.per_family.map((f) => <tr key={f.family} className="border-t border-border"><td>{f.family}</td><td>{f.n}</td><td>{fmt(f.brier_candidate, 3)}</td><td>{fmt(f.brier_reference, 3)}</td><td>{fmt(f.brier_pooled_online, 3)}{f.pooled_comparator_better ? " ★" : ""}</td><td>{f.decision}</td></tr>)}</tbody></table>
                <p className="mt-1 text-[11px]">★ pooled comparator beats both on this family — shown even when the fallback passes its own rule.</p>
              </div>
              <div className="space-y-1 text-[11px]">
                <h3 className="text-xs font-semibold">Planner and transfer diagnostics</h3>
                <p className="font-mono">Exact root value {fmt(extra.regret.exact, 4)} · beam choice under exact Q {fmt(extra.regret.approx_choice_exact_q, 4)} · regret {fmt(extra.regret.regret, 4)} · expansions {extra.regret.approx_expansions}/{extra.regret.budget}</p>
                <p className="font-mono">Leave-group-out {extra.lgo.held_out}: train n={extra.lgo.train_n}, test n={extra.lgo.test_n}, prediction {fmt(extra.lgo.prediction, 3)}, Brier {fmt(extra.lgo.brier, 3)} · authorization {extra.lgo.authorization}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <details className="mt-3 text-xs"><summary className="cursor-pointer">Protocol and parity status</summary>
        <table className="mt-2 w-full text-left text-[11px]"><tbody className="font-mono">{PROTOCOL_STATUS.map((p) => <tr key={p.id} className="border-t border-border"><td className="py-1">{p.id}</td><td>{p.item}</td><td>{p.impl}</td><td>{p.note}</td></tr>)}</tbody></table>
      </details>
    </Panel>
  );
}
