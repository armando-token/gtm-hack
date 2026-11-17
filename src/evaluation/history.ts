/** Prior research — historical origin only. Never mixed with current-run results. */
export const PRIOR_RESEARCH = {
  origin: "historical" as const,
  run_id: "r2-sealed-eb41454c3fb8",
  reference_revision: "571f9fa503eba1b86c2f695c84823076856a9805",
  evaluated_revision: "632a084",
  published_revision: "651dfbc",
  arms: [
    { arm: "D", label: "Exact GTM", valid: 24, total: 24 },
    { arm: "C", label: "Superficial rules", valid: 14, total: 24 },
    { arm: "B", label: "Local Boolean proxy", valid: 13, total: 24 },
  ],
} as const;
