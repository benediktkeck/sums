import { AUTH_COOKIE, AUTH_MAX_AGE, authPassword, safeEqual, safeNext, sessionToken } from "@/server/auth";
import { clientAddress, LoginLimiter } from "@/server/login-limit";

const globalForLimit = globalThis as unknown as { sumsLoginLimit?: LoginLimiter };
const limiter = (globalForLimit.sumsLoginLimit ??= new LoginLimiter());

/**
 * 303: the browser follows with GET after the form POST. The location stays
 * relative: behind a proxy or a 0.0.0.0 bind, `req.url` doesn't carry the
 * host the browser used.
 */
function redirect(path: string) {
  return new Response(null, { status: 303, headers: { location: path } });
}

/** Checks the password from the login form and sets the session cookie. */
export async function POST(req: Request) {
  const password = authPassword();
  const form = await req.formData();
  const next = safeNext(form.get("next"));
  if (!password) return redirect(next);
  const back = (error: string) => redirect(`/login?error=${error}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);
  const client = clientAddress(req.headers);
  if (!limiter.allowed(client)) return back("locked");
  const given = String(form.get("password") ?? "");
  if (!safeEqual(given, password)) {
    limiter.fail(client);
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 600));
    return back("1");
  }
  const res = redirect(next);
  const secure = new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
  res.headers.append(
    "set-cookie",
    `${AUTH_COOKIE}=${await sessionToken(password)}; Path=/; Max-Age=${AUTH_MAX_AGE}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
  );
  return res;
}
