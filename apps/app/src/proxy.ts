import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authPassword, isValidSession } from "./server/auth";

/** Reachable without the password: the login itself, the privacy page and health checks. */
const PUBLIC = ["/login", "/datenschutz", "/api/login", "/api/health"];
/** The analytics relay carries no plan data and has to work on the login page too. */
const PUBLIC_PREFIXES = ["/api/relay/"];

/**
 * `/` opens the plan (the landing page is a separate website, apps/web). With
 * SUMS_PASSWORD set, every page and API call needs a valid session cookie.
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === "/") return NextResponse.redirect(new URL("/uebersicht", req.url));
  const password = authPassword();
  if (!password) return NextResponse.next();
  if (PUBLIC.includes(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return NextResponse.next();
  if (await isValidSession(req.cookies.get(AUTH_COOKIE)?.value, password)) return NextResponse.next();
  if (path.startsWith("/api/")) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const login = new URL("/login", req.url);
  if (path !== "/") login.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  // Static assets and icons stay public so the login page and the install prompt render.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon|app-icon|manifest.webmanifest|sw.js).*)"],
};
