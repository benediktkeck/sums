import { connection, type NextRequest } from "next/server";
import { analyticsConfig } from "@sums/core/analytics-config";

/**
 * Same-origin relay to PostHog (cookieless product analytics, see
 * analytics.ts). Mounted at /api/relay/[...path] by the app and the website. Ad blockers drop requests to analytics hosts,
 * and a relay on our own origin keeps the Datenschutz text true: the browser
 * only talks to this site.
 *
 * PostHog's cookieless mode derives its daily anonymous ID from the visitor's
 * IP address, so the relay passes it on in X-Forwarded-For. Cookies are not
 * forwarded. Without SUMS_POSTHOG_KEY the relay answers 404.
 */

/** PostHog endpoints the browser SDK uses; anything else is refused. */
const ALLOWED = new Set(["e", "i", "batch", "capture", "flags", "decide", "static", "array"]);
const MAX_BODY = 2 * 1024 * 1024;
const FORWARD_REQUEST = ["content-type", "content-encoding", "user-agent", "accept", "accept-language"];
const FORWARD_RESPONSE = ["content-type", "cache-control", "vary"];

/** Static SDK files come from PostHog's asset host for the cloud regions. */
function assetHost(host: string): string {
  return host.replace(/^https:\/\/(eu|us)\.i\.posthog\.com$/, "https://$1-assets.i.posthog.com");
}

async function relay(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  await connection();
  const config = analyticsConfig();
  const { path } = await ctx.params;
  if (!config || !ALLOWED.has(path[0] ?? "") || path.some((s) => s === ".." || s === ".")) {
    return new Response(null, { status: 404 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return new Response(null, { status: 413 });

  const asset = path[0] === "static" || path[0] === "array";
  const last = path[path.length - 1];
  // The client strips trailing slashes (Next would redirect them); PostHog's API paths end in one.
  const slash = asset || last.includes(".") ? "" : "/";
  const target = `${asset ? assetHost(config.host) : config.host}/${path.map(encodeURIComponent).join("/")}${slash}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (ip) headers.set("x-forwarded-for", ip);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
  if (body && body.byteLength > MAX_BODY) return new Response(null, { status: 413 });

  try {
    const res = await fetch(target, { method: req.method, headers, body, redirect: "manual", cache: "no-store" });
    const out = new Headers();
    for (const name of FORWARD_RESPONSE) {
      const value = res.headers.get(name);
      if (value) out.set(name, value);
    }
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return new Response(null, { status: 502 });
  }
}

/** Route handlers for `app/api/relay/[...path]/route.ts`. */
export const relayHandlers = { GET: relay, POST: relay };
