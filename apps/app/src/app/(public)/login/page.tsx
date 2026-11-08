import type { Metadata } from "next";
import { Suspense } from "react";
import { LockKeyhole } from "lucide-react";
import { safeNext } from "@/server/auth";
import { appName } from "@/server/config";

export const metadata: Metadata = { title: "Anmelden" };

async function LoginForm({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const failed = params.error === "1";
  const locked = params.error === "locked";
  return (
    <form method="post" action="/api/login" className="card grid gap-3">
      <h1 className="h1 inline-flex items-center gap-2 !text-[22px]">
        <LockKeyhole size={20} className="text-brand" /> Anmelden
      </h1>
      <p className="text-fg-2">Diese {appName()}-Installation ist mit einem Passwort geschützt.</p>
      <input type="hidden" name="next" value={next} />
      <label className="grid gap-1.5">
        <span className="text-[13.5px] text-fg-2">Passwort</span>
        <input className="field" type="password" name="password" autoComplete="current-password" autoFocus required aria-invalid={failed || undefined} />
      </label>
      {failed && (
        <p className="text-[14px] text-neg" role="alert">
          Das Passwort stimmt nicht.
        </p>
      )}
      {locked && (
        <p className="text-[14px] text-neg" role="alert">
          Zu viele falsche Versuche. Bitte warte eine Viertelstunde und versuch es dann noch einmal.
        </p>
      )}
      <button type="submit" className="btn p justify-self-start">
        Anmelden
      </button>
    </form>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="wrap max-w-[440px] pt-16">
      <Suspense fallback={<div className="card h-56 animate-pulse" />}>
        <LoginForm searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
