"use client";

import Link from "next/link";
import { formatEur } from "@sums/core/format";
import { usePlan } from "./plan-provider";
import { Summary } from "./summary";

export function PageHeader({ title, lead, action }: { title: string; lead?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="head">
      <div className="min-w-0">
        <h1 className="h1">{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      <div className="sp" />
      {action}
    </div>
  );
}

/** Compact free amount for mobile section pages (the full summary lives on Übersicht). */
function MobileFree() {
  const { result } = usePlan();
  const neg = result.free < 0;
  return (
    <Link href="/uebersicht" className="mobile-free card mb-3 items-center justify-between !px-4 !py-3">
      <span className="text-fg-2">{neg ? "Fehlt pro Monat" : "Frei verfügbar"}</span>
      <b className={`n text-lg ${neg ? "text-neg" : ""}`}>{formatEur(result.free)}</b>
    </Link>
  );
}

/** Main column + sticky summary sidebar. */
export function PageGrid({ children, overview = false }: { children: React.ReactNode; overview?: boolean }) {
  return (
    <div className="grid-main">
      <div>
        {!overview && <MobileFree />}
        {children}
      </div>
      <Summary className={overview ? "" : "only-desktop"} />
    </div>
  );
}

export function Wrap({ children }: { children: React.ReactNode }) {
  return <main className="wrap">{children}</main>;
}
