import type { NextConfig } from "next";
import path from "node:path";
import { env } from "../../packages/core/src/env";
import pkg from "./package.json" with { type: "json" };

/** Sent with every response. No full CSP: Next's inline scripts would need nonces. */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Trace from the monorepo root so the standalone build includes the workspace packages.
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  cacheComponents: true,
  partialPrefetching: true,
  // Metadata depends on runtime config (SUMS_APP_NAME), so Next would stream it
  // into <body>. Browsers only read the manifest link and the web-app tags from
  // <head>, so every client gets blocking metadata, or the app isn't installable.
  htmlLimitedBots: /.*/,
  experimental: {
    // For the same reason the implicit dev check flags every page as "not instant".
    // Its documented fix (a connection() marker on the page) isn't honoured in this
    // Next version; only pages that set `instant` are checked.
    instantInsights: { validationLevel: "manual-warning" },
  },
  // Hostnames (comma-separated) allowed to load dev resources when the dev
  // server is opened from another machine, e.g. SUMS_DEV_ORIGINS=dev.example.com
  allowedDevOrigins: env("DEV_ORIGINS")?.split(",").map((s) => s.trim()).filter(Boolean),
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      { source: "/personen", destination: "/einstellungen/personen", permanent: false },
    ];
  },
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
