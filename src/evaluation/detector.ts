/** Evaluator-side: trap recall and clean retention computed together for a configured threshold. */
export function recallAndRetention(rows: readonly { score: number; is_trap: boolean }[], threshold: number) {
  const traps = rows.filter((r) => r.is_trap), clean = rows.filter((r) => !r.is_trap);
  return {
    threshold,
    trap_recall: traps.length ? traps.filter((r) => r.score >= threshold).length / traps.length : null,
    clean_retention: clean.length ? clean.filter((r) => r.score < threshold).length / clean.length : null,
    n_traps: traps.length, n_clean: clean.length,
  };
}
