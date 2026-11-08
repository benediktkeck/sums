"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, DatabaseBackup, SlidersHorizontal, Users } from "lucide-react";
import { usePlan } from "./plan-provider";

/** "Einstellungen" page frame: one title, tabs, then the sub page. */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { plan } = usePlan();
  const items = [
    { href: "/einstellungen", label: "Allgemein", icon: SlidersHorizontal },
    { href: "/einstellungen/personen", label: "Personen", icon: Users, count: plan.persons.length },
    ...(plan.settings.commute ? [{ href: "/einstellungen/autos", label: "Autos", icon: Car, count: plan.cars.length }] : []),
    { href: "/einstellungen/daten", label: "Daten & Sicherung", icon: DatabaseBackup },
  ];
  return (
    <main className="wrap">
      <div className="head !mb-3">
        <h1 className="h1">Einstellungen</h1>
      </div>
      <nav className="set-tabs" aria-label="Einstellungen">
        {items.map((i) => {
          const active = pathname === i.href;
          return (
            <Link key={i.href} href={i.href} className={active ? "a" : ""} aria-current={active ? "page" : undefined}>
              <i.icon size={16} />
              {i.label}
              {i.count != null && <span className="c n">{i.count}</span>}
            </Link>
          );
        })}
      </nav>
      {children}
    </main>
  );
}

/** Intro of a settings sub page; the active tab already names it, so the heading is for screen readers. */
export function SettingsHeader({ title, lead, action }: { title: string; lead?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="set-head">
      <div className="min-w-0">
        <h2 className="sr-only">{title}</h2>
        {lead && <p className="lead">{lead}</p>}
      </div>
      <div className="sp" />
      {action}
    </div>
  );
}
