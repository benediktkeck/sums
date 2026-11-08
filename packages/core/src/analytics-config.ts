import { env } from "./env";

/** Only absolute http(s) URLs; anything else is ignored rather than rendered as a link. */
export function httpUrl(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const DEFAULT_POSTHOG_HOST = "https://eu.i.posthog.com";

export type AnalyticsConfig = { key: string; host: string };

/** PostHog project for product analytics (SUMS_POSTHOG_KEY, SUMS_POSTHOG_HOST); `null` (the default) sends nothing. */
export function analyticsConfig(): AnalyticsConfig | null {
  const key = env("POSTHOG_KEY")?.trim();
  if (!key) return null;
  const host = httpUrl(env("POSTHOG_HOST")) ?? DEFAULT_POSTHOG_HOST;
  return { key, host: host.replace(/\/+$/, "") };
}
