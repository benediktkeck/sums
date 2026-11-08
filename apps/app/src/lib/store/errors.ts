/** Store errors shared by the SQLite store (server) and the browser store (local mode). */

export class ConflictError extends Error {
  /** Same shape as an HTTP error, so callers handle both backends alike. */
  readonly status = 409;
  constructor(public readonly headId: number) {
    super("Der Plan wurde inzwischen geändert.");
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
}
