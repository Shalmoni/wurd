const WURD_LIFETIME_MS = 24 * 60 * 60 * 1000;

// A saved Wurd is already published. A cached UI clock (or a slightly slower
// device clock) must not turn it back into an unsubmitted draft.
export function isSavedWurdActive(createdAt: string | null, now: number): boolean {
  if (!createdAt) return false;
  const postedAt = Date.parse(createdAt);
  return Number.isFinite(postedAt) && now < postedAt + WURD_LIFETIME_MS;
}

export function createAccountLoadGuard() {
  let revision = 0;
  return {
    invalidate: () => ++revision,
    isCurrent: (request: number) => request === revision,
  };
}
