import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@sums/ui/logo";
import { RuntimeLogo } from "@/components/runtime-logo";

export const metadata: Metadata = { title: "Seite nicht gefunden" };

/** 404. The runtime logo also lets the root layout read the configured name per request. */
export default function NotFound() {
  return (
    <>
      <header className="top">
        <div className="tb">
          <Suspense fallback={<Logo />}>
            <RuntimeLogo />
          </Suspense>
        </div>
      </header>
      <main className="wrap max-w-xl">
        <div className="card grid gap-3">
          <h1 className="h1 !text-[22px]">Seite nicht gefunden</h1>
          <p className="text-fg-2">Diese Adresse gibt es nicht (mehr).</p>
          <Link href="/uebersicht" className="btn p justify-self-start">
            Zur Übersicht
          </Link>
        </div>
      </main>
    </>
  );
}
