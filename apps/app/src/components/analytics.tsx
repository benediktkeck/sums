"use client";

import { useEffect } from "react";
import { initAnalytics, setAnalyticsProps, track } from "@/lib/analytics/client";
import type { StorageMode } from "@/lib/backend/types";

/** Starts cookieless product analytics; rendered only when the operator configured a PostHog project. */
export function Analytics({ token, mode }: { token: string; mode: StorageMode }) {
  useEffect(() => {
    setAnalyticsProps({ storage_mode: mode, is_pwa: window.matchMedia("(display-mode: standalone)").matches });
    void initAnalytics(token);
    const onInstalled = () => track("pwa_installed");
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, [token, mode]);
  return null;
}
