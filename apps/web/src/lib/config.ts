import { httpUrl } from "@sums/core/analytics-config";
import { env } from "@sums/core/env";
import type { LegalLinks } from "@sums/ui/legal-links";

/**
 * Website settings (`SUMS_*`). The landing page is prerendered, so these are
 * read at build time; hosts like Vercel pass env vars to the build.
 *
 * - SUMS_APP_NAME     product name shown on the site (default "Sums").
 * - SUMS_APP_URL      where the app runs (e.g. https://app.example.com); every call to action links there.
 * - SUMS_SOURCE_URL   link to the source code, shown in the footer.
 * - SUMS_IMPRINT_URL, SUMS_PRIVACY_URL   the operator's legal notice and privacy policy.
 * - SUMS_POSTHOG_KEY, SUMS_POSTHOG_HOST   cookieless analytics (off unless a key is set).
 */
export function siteName(): string {
  return env("APP_NAME")?.trim().slice(0, 40) || "Sums";
}

export function appUrl(): string {
  return (httpUrl(env("APP_URL")) ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function sourceUrl(): string | null {
  return httpUrl(env("SOURCE_URL"));
}

export function legalLinks(): LegalLinks {
  return { imprintUrl: httpUrl(env("IMPRINT_URL")), privacyUrl: httpUrl(env("PRIVACY_URL")) };
}
