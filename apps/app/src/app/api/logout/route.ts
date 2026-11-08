import { AUTH_COOKIE } from "@/server/auth";

/** Clears the session cookie. */
export async function POST() {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/login",
      "set-cookie": `${AUTH_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    },
  });
}
