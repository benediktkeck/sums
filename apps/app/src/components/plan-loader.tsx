import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AUTH_COOKIE, authPassword, isValidSession } from "@/server/auth";
import { appConfig } from "@/server/config";
import { getStore } from "@/server/store";
import { LocalBackendLoader, ServerBackend } from "./backend-provider";

/**
 * Hands the plan to the client. Server mode reads the current version at
 * request time; local mode leaves loading to the browser.
 */
export async function PlanLoader({ children }: { children: React.ReactNode }) {
  await connection();
  const config = appConfig();
  // The proxy already guards every route; this keeps the plan from rendering if it ever doesn't.
  const password = authPassword();
  if (password && !(await isValidSession((await cookies()).get(AUTH_COOKIE)?.value, password))) redirect("/login");
  if (config.mode === "local") return <LocalBackendLoader config={config}>{children}</LocalBackendLoader>;
  return (
    <ServerBackend config={config} initial={getStore().getState()}>
      {children}
    </ServerBackend>
  );
}
