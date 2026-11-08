"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = { dark: "#0c0c0e", light: "#f6f6f7" };

/** Registers the service worker and keeps the phone's status bar in the app's theme. */
export function PwaSetup() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Dev assets change constantly and the worker only adds the offline page.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    const color = THEME_COLORS[resolvedTheme === "light" ? "light" : "dark"];
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }, [resolvedTheme]);

  return null;
}
