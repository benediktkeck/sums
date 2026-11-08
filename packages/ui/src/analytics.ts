import type { PostHog } from "posthog-js";

/**
 * Browser side of product analytics. Everything is a no-op until
 * `initAnalytics` runs, which only happens when the operator configured a
 * PostHog project (SUMS_POSTHOG_KEY). posthog-js is loaded on demand, so
 * installs without analytics never download it.
 *
 * Cookieless: nothing is stored on the device, PostHog derives a daily
 * anonymous ID on its servers. No session replay, no autocapture of element
 * text (it could contain plan content).
 *
 * Visitors can turn it off (Einstellungen → Daten); that choice is kept in
 * this browser's local storage, and the SDK is then never loaded.
 *
 * Shared by the app and the website. Each declares its own typed `track()`
 * on top of `send()`.
 */

/** Path of the same-origin relay to PostHog (see relay.ts). */
export const RELAY_PATH = "/api/relay";

let posthog: PostHog | null = null;
let starting = false;
/** Events fired before the SDK finished loading (child effects run before the provider's). */
let pending: { event: string; props: object }[] = [];
const MAX_PENDING = 50;
let props: Record<string, unknown> = {};
let configuredToken: string | null = null;
let optedOut = false;

const OPT_OUT_KEY = "sums:analytics-off";

/** The visitor turned analytics off in this browser. */
export function analyticsOptedOut(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** The browser sends Do Not Track / Global Privacy Control; nothing is captured either way. */
export function browserRefusesTracking(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  return [nav.doNotTrack, win.doNotTrack, nav.msDoNotTrack].some((v) => v === "1" || v === "yes") || nav.globalPrivacyControl === true;
}

/** Turns analytics off (or back on) for this browser, effective immediately. */
export function setAnalyticsOptOut(off: boolean): void {
  try {
    if (off) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    // Storage blocked: the choice still holds for this page view.
  }
  optedOut = off || browserRefusesTracking();
  if (optedOut) {
    pending = [];
    posthog?.opt_out_capturing();
  } else if (posthog) {
    posthog.opt_in_capturing();
  } else if (configuredToken) {
    void initAnalytics(configuredToken);
  }
}

export async function initAnalytics(token: string): Promise<void> {
  configuredToken = token;
  // Do Not Track / Global Privacy Control count as an opt-out, without loading the SDK.
  optedOut = analyticsOptedOut() || browserRefusesTracking();
  if (posthog || starting || optedOut) return;
  starting = true;
  const { default: ph } = await import("posthog-js");
  ph.init(token, {
    api_host: window.location.origin + RELAY_PATH,
    // The relay adds trailing slashes back; without this Next would redirect `/e/` to `/e`.
    rewriteRequestPath: (url) => {
      url.pathname = url.pathname.replace(/\/+$/, "");
      return url;
    },
    defaults: "2026-08-30",
    cookieless_mode: "always",
    person_profiles: "never",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    enable_heatmaps: true,
    capture_exceptions: true,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    advanced_disable_flags: true,
    respect_dnt: true,
  });
  ph.register(props);
  posthog = ph;
  const queued = pending;
  pending = [];
  for (const e of queued) ph.capture(e.event, e.props as Record<string, unknown>);
}

/** Sends one event (queued until the SDK has loaded; dropped when the visitor opted out). */
export function send(event: string, props: object = {}): void {
  if (optedOut) return;
  if (posthog) posthog.capture(event, props as Record<string, unknown>);
  else if (pending.length < MAX_PENDING) pending.push({ event, props });
}

/** Properties sent with every following event (plan shape, storage mode). */
export function setAnalyticsProps(next: Record<string, unknown>): void {
  props = { ...props, ...next };
  posthog?.register(next);
}
