// Thrown when an atomic conditional update (updateMany with a guard clause,
// e.g. "only if walletBalance >= amount" or "only if status = OPEN") affects
// zero rows, meaning another request already changed the row first. The
// message carries the specific reason so each route can report it as-is.
export class ConcurrencyError extends Error {}
