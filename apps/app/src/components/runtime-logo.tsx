import { connection } from "next/server";
import { appName } from "@/server/config";
import { Logo } from "@sums/ui/logo";

/** Logo with the name configured at runtime. Render inside <Suspense fallback={<Logo />}>. */
export async function RuntimeLogo(props: { href?: string; label?: string }) {
  await connection();
  return <Logo name={appName()} {...props} />;
}
