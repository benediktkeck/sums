"use client";

import { useEffect } from "react";
import { initAnalytics, setAnalyticsProps } from "@sums/ui/analytics";

/** Starts cookieless analytics; rendered only when a PostHog project is configured. */
export function Analytics({ token }: { token: string }) {
  useEffect(() => {
    setAnalyticsProps({ site: "web" });
    void initAnalytics(token);
  }, [token]);
  return null;
}
