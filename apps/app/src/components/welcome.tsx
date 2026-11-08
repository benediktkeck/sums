"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { track } from "@/lib/analytics/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Equal, Fuel, HardDrive, PiggyBank, Plus, Receipt, Server, Sparkles, Upload, Users, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { demoPlan } from "@sums/core/fixtures/demo-plan";
import { DEMO_PARAM } from "@sums/core/links";
import { addPerson } from "@sums/core/model/ops";
import { useAppConfig, useBackend } from "./backend-context";
import { LegalLinks } from "@sums/ui/legal-links";
import { usePlan } from "./plan-provider";
import { resetGuide, setGuide } from "./onboarding/guide-store";
import { useBackup } from "./use-backup";

/** The calculation in one line, with the colors the summary uses. */
const FLOW = [
  { op: "", label: "Einkommen", examples: "Gehalt, Kindergeld, Nebenjob", icon: Wallet, color: "var(--fg-2)" },
  { op: "−", label: "Fixkosten", examples: "Miete, Versicherungen, Abos", icon: Receipt, color: "var(--s-fixed)" },
  { op: "−", label: "Variable Kosten", examples: "Lebensmittel, Freizeit", icon: Fuel, color: "var(--c-var)" },
  { op: "−", label: "Rücklagen", examples: "Notgroschen, Urlaub", icon: PiggyBank, color: "var(--sav)" },
  { op: "=", label: "Frei verfügbar", examples: "Taschengeld und Überschuss", icon: Equal, color: "var(--pos)" },
];

/** Blank plan in the app: what the app does in one line, then three ways in (own plan, example, backup). */
export function Welcome() {
  const config = useAppConfig();
  const backend = useBackend();
  const router = useRouter();
  const { update, flush, adopt } = usePlan();
  const { importBackup } = useBackup();
  const [names, setNames] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const local = config.mode === "local";

  const loadDemo = async () => {
    setBusy(true);
    try {
      await flush();
      adopt(await backend.replace(demoPlan(), "Beispielplan geladen"));
      setGuide({ demo: true });
      track("plan_started", { source: "demo" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Arriving from the landing page's "Beispiel ansehen": load it right away (the plan is blank, nothing is lost).
  const autoDemo = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (autoDemo.current || !params.has(DEMO_PARAM)) return;
    autoDemo.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    void loadDemo();
  });

  const start = () => {
    const list = names.map((n) => n.trim()).filter(Boolean);
    const persons = list.length ? list : ["Ich"];
    resetGuide();
    track("plan_started", { source: "own", person_count: persons.length });
    update((d) => persons.forEach((n) => addPerson(d, n)), { summary: persons.length === 1 ? `Person „${persons[0]}“ angelegt` : `${persons.length} Personen angelegt` });
    router.push("/einkommen");
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await importBackup(file);
      track("plan_started", { source: "backup" });
      toast.success("Sicherung geladen.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <main className="wrap welcome">
      <header className="welcome-hero">
        <span className="welcome-eyebrow">Willkommen bei {config.name}</span>
        <h1>Was bleibt jeden Monat übrig?</h1>
        <p>
          Du trägst ein, was reinkommt und was regelmäßig rausgeht. {config.name} rechnet live aus, was übrig bleibt – und wie es zwischen euch
          aufgeteilt wird.
        </p>
      </header>

      <ol className="welcome-flow" aria-label="So wird gerechnet">
        {FLOW.map((f) => (
          <li key={f.label} style={{ "--wf": f.color } as React.CSSProperties}>
            {f.op && (
              <span className="wf-op" aria-hidden>
                {f.op}
              </span>
            )}
            <span className="wf-card">
              <f.icon size={18} className="wf-ico" />
              <b>{f.label}</b>
              <span>{f.examples}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="welcome-start">
        <section className="card welcome-main">
          <span className="welcome-ico">
            <Users size={20} />
          </span>
          <h2>Eigenen Plan anlegen</h2>
          <p>Wer plant mit? Allein, zu zweit oder zu mehreren – jede Person bekommt später ihren Anteil am Übrigen.</p>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            {names.map((n, i) => (
              <div key={i} className="flex gap-2">
                <input
                  {...NO_AUTOFILL}
                  className="field flex-1"
                  aria-label={`Name ${i + 1}`}
                  placeholder={i === 0 ? "Dein Name" : "Name"}
                  value={n}
                  maxLength={40}
                  autoFocus={i > 0 && i === names.length - 1}
                  onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {names.length > 1 && (
                  <button type="button" className="btn ibtn ghost" aria-label="Person entfernen" onClick={() => setNames(names.filter((_, j) => j !== i))}>
                    <X />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {names.length < 4 && (
                <button type="button" className="btn ghost" onClick={() => setNames([...names, ""])}>
                  <Plus /> Weitere Person
                </button>
              )}
              <span className="sp" />
              <button type="submit" className="btn p welcome-go">
                Los geht&apos;s <ArrowRight />
              </button>
            </div>
          </form>
          <ol className="welcome-next" aria-label="Danach">
            <li>Danach führen dich fünf kurze Schritte durch den Plan: Einkommen, Fixkosten, variable Kosten, Rücklagen.</li>
            <li>Leg am besten Kontoauszüge oder die Banking-App bereit. Alles lässt sich später ändern.</li>
          </ol>
        </section>

        <div className="welcome-side">
          <section className="card welcome-alt">
            <Sparkles size={18} className="text-brand" />
            <div className="min-w-0 flex-1">
              <h3>Erst mal umschauen</h3>
              <p>Ein fertiger Beispielhaushalt (Alex und Sam) mit Szenarien und Sparkonten. Den eigenen Plan legst du danach mit einem Klick an.</p>
              <button className="btn" disabled={busy} onClick={() => void loadDemo()}>
                Beispiel ansehen
              </button>
            </div>
          </section>

          <section className="card welcome-alt">
            <Upload size={18} className="text-brand" />
            <div className="min-w-0 flex-1">
              <h3>Sicherung laden</h3>
              <p>Du hast {config.name} schon benutzt? Lade eine Sicherungsdatei (.json), zum Beispiel von einem anderen Gerät.</p>
              <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload /> Datei wählen
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void restore(e.target.files?.[0])} />
            </div>
          </section>
        </div>
      </div>

      <p className="welcome-privacy">
        {local ? <HardDrive size={16} /> : <Server size={16} />}
        <span>
          {local
            ? "Deine Daten bleiben in diesem Browser. Nichts wird an einen Server geschickt – lade ab und zu eine Sicherung herunter (Einstellungen → Daten & Sicherung)."
            : `Dein Plan wird auf dem Server dieser ${config.name}-Installation gespeichert.`}
        </span>
      </p>
      <LegalLinks links={config.legal} className="mt-6" />
    </main>
  );
}
