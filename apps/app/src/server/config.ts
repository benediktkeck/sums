import type { AppConfig, LegalLinks, StorageMode } from "@/lib/backend/types";
import { analyticsConfig, httpUrl as url } from "@sums/core/analytics-config";
import { env } from "@sums/core/env";

export { analyticsConfig, DEFAULT_POSTHOG_HOST, type AnalyticsConfig } from "@sums/core/analytics-config";

/**
 * Runtime configuration from environment variables (`SUMS_*`, see `env()`).
 * Read at request time, so one build serves both modes.
 *
 * - SUMS_STORAGE=local   plan lives in the visitor's browser; the server stores nothing.
 * - SUMS_PASSWORD        protects the app with a password (see src/proxy.ts).
 * - SUMS_IMPRINT_URL, SUMS_PRIVACY_URL   links to the operator's legal notice and privacy policy.
 * - SUMS_APP_NAME      the name shown in the app, titles and the installed app (default "Sums").
 * - SUMS_POSTHOG_KEY, SUMS_POSTHOG_HOST   cookieless product analytics (off unless a key is set).
 * - SUMS_HOSTING_PROVIDER   who hosts the site, named on the built-in privacy page.
 */
export const DEFAULT_APP_NAME = "Sums";

export function appName(): string {
  const v = env("APP_NAME")?.trim();
  return v ? v.slice(0, 40) : DEFAULT_APP_NAME;
}

export function storageMode(): StorageMode {
  return env("STORAGE")?.trim().toLowerCase() === "local" ? "local" : "server";
}

/** Free text naming the hosting provider on the privacy page, e.g. "Example Hosting GmbH, Musterstraße 1, 12345 Berlin". */
export function hostingProvider(): string | null {
  return env("HOSTING_PROVIDER")?.trim().slice(0, 300) || null;
}

/** Path of the built-in privacy page (src/app/(public)/datenschutz). */
export const PRIVACY_PATH = "/datenschutz";

/**
 * The operator's own privacy policy wins. Otherwise public installs (local
 * mode) and installs with analytics link the built-in page; a private
 * household server shows no legal links.
 */
export function legalLinks(): LegalLinks {
  const own = url(env("PRIVACY_URL"));
  const builtIn = storageMode() === "local" || analyticsConfig() !== null;
  return { imprintUrl: url(env("IMPRINT_URL")), privacyUrl: own ?? (builtIn ? PRIVACY_PATH : null) };
}

export function appConfig(): AppConfig {
  return { name: appName(), mode: storageMode(), auth: !!env("PASSWORD"), legal: legalLinks(), analytics: analyticsConfig() !== null };
}
