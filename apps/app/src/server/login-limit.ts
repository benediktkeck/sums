/**
 * Limits failed logins so a password can't be guessed by trying many. Counts
 * per client address and for the whole installation, in memory (a restart
 * resets it; one process serves an install). Successful logins don't count.
 */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_CLIENT = 10;
export const MAX_FAILS_TOTAL = 100;
const MAX_TRACKED = 10_000;

type Entry = { count: number; since: number };

export class LoginLimiter {
  private clients = new Map<string, Entry>();
  private total: Entry = { count: 0, since: 0 };

  constructor(private readonly now: () => number = Date.now) {}

  private fresh(e: Entry | undefined): Entry | undefined {
    return e && this.now() - e.since < LOGIN_WINDOW_MS ? e : undefined;
  }

  /** false while this client (or the install as a whole) has too many recent failures. */
  allowed(client: string): boolean {
    const c = this.fresh(this.clients.get(client));
    const t = this.fresh(this.total);
    return (c?.count ?? 0) < MAX_FAILS_PER_CLIENT && (t?.count ?? 0) < MAX_FAILS_TOTAL;
  }

  fail(client: string): void {
    const now = this.now();
    const c = this.fresh(this.clients.get(client)) ?? { count: 0, since: now };
    c.count++;
    this.clients.delete(client);
    this.clients.set(client, c);
    if (this.clients.size > MAX_TRACKED) this.clients.delete(this.clients.keys().next().value!);
    this.total = this.fresh(this.total) ?? { count: 0, since: now };
    this.total.count++;
  }
}

/**
 * The client address as the nearest proxy saw it: the last X-Forwarded-For
 * entry (clients can prepend fake ones), else X-Real-IP. Without a proxy every
 * request looks the same, so the installation-wide limit applies.
 */
export function clientAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) || headers.get("x-real-ip")?.trim() || "direct";
}
