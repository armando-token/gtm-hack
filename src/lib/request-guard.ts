/** Monotonic request guard: only the newest issued token may write results (U04). */
export function createRequestGuard() {
  let latest = 0;
  return {
    next: () => ++latest,
    isCurrent: (token: number) => token === latest,
    invalidate: () => { latest++; },
  };
}
