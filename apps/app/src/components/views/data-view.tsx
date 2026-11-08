"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChartNoAxesColumn, Download, HardDrive, History, RotateCcw, Server, Sparkles, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { analyticsOptedOut, browserRefusesTracking, setAnalyticsOptOut } from "@/lib/analytics/client";
import { demoPlan } from "@sums/core/fixtures/demo-plan";
import { emptyPlan } from "@sums/core/model/empty";
import { useAppConfig, useBackend } from "../backend-context";
import { usePlan } from "../plan-provider";
import { SettingsHeader } from "../settings-shell";
import { FormDialog, Toggle } from "../ui-bits";
import { LegalLinks } from "@sums/ui/legal-links";
import { resetGuide, setGuide } from "../onboarding/guide-store";
import { useBackup } from "../use-backup";

/** Where the data lives, backups, and starting over. */
export function DataView() {
  const config = useAppConfig();
  const backend = useBackend();
  const router = useRouter();
  const { flush, adopt, undo } = usePlan();
  const { exportBackup, importBackup } = useBackup();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"demo" | "empty" | null>(null);
  const local = config.mode === "local";

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await importBackup(file);
      toast.success("Sicherung geladen.", {
        action: { label: "Rückgängig", onClick: () => void undo() },
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const startOver = async (kind: "demo" | "empty") => {
    setConfirm(null);
    try {
      await flush();
      adopt(await backend.replace(kind === "demo" ? demoPlan() : emptyPlan(), kind === "demo" ? "Beispielplan geladen" : "Neu angefangen"));
      if (kind === "demo") setGuide({ demo: true });
      else resetGuide();
      toast.success(kind === "demo" ? "Beispielplan geladen." : "Neuer, leerer Plan.", {
        action: { label: "Rückgängig", onClick: () => void undo() },
      });
      router.push("/uebersicht");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <SettingsHeader title="Daten & Sicherung" lead="Wo dein Plan gespeichert ist, Sicherungen und ein Neuanfang." />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2>
            <span className="inline-flex items-center gap-2">
              {local ? <HardDrive size={17} className="text-brand" /> : <Server size={17} className="text-brand" />}
              {local ? "Gespeichert in diesem Browser" : "Gespeichert auf dem Server"}
            </span>
          </h2>
          {local ? (
            <p className="note">
              Dein Plan liegt nur auf diesem Gerät, in diesem Browser. Kein Server bekommt deine Zahlen zu sehen. Wer die Browserdaten löscht, löscht
              auch den Plan – lade deshalb ab und zu eine Sicherung herunter. Mit ihr kannst du auch auf ein anderes Gerät oder in eine eigene
              Installation umziehen.
            </p>
          ) : (
            <p className="note">
              Dein Plan liegt auf dem Server dieser {config.name}-Installation. Alle Geräte, die {config.name} hier öffnen, sehen denselben Stand. Eine Sicherung ist
              trotzdem praktisch, etwa zum Umziehen.
            </p>
          )}
          {!backend.persistent && (
            <p className="note !text-neg inline-flex gap-2" role="alert">
              <TriangleAlert size={16} className="mt-0.5 flex-none" />
              Dieser Browser erlaubt gerade keinen dauerhaften Speicher (privates Fenster?). Änderungen gehen beim Schließen verloren – sichere
              sie vorher.
            </p>
          )}
        </section>

        <section className="card">
          <h2>Sicherung</h2>
          <p className="note !mt-1">Eine JSON-Datei mit dem aktuellen Plan. Laden legt eine neue Version an; der bisherige Stand bleibt im Verlauf.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn p" onClick={() => void exportBackup().catch((e: Error) => toast.error(e.message))}>
              <Download /> Sicherung herunterladen
            </button>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Upload /> Sicherung laden
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void restore(e.target.files?.[0])} />
          </div>
        </section>

        <section className="card">
          <h2>Verlauf</h2>
          <p className="note !mt-1">Jede Änderung ist eine Version. Speicherstände sind Versionen mit Namen.</p>
          <div className="mt-3">
            <Link href="/verlauf" className="btn">
              <History /> Verlauf &amp; Speicherstände
            </Link>
          </div>
        </section>

        <section className="card">
          <h2>Neu anfangen</h2>
          <p className="note !mt-1">Ersetzt den Plan. Das lässt sich rückgängig machen, und alte Stände bleiben im Verlauf.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" onClick={() => setConfirm("demo")}>
              <Sparkles /> Beispielplan laden
            </button>
            <button className="btn danger" onClick={() => setConfirm("empty")}>
              <RotateCcw /> Leerer Plan
            </button>
          </div>
        </section>
      </div>
      {config.analytics && <AnalyticsCard privacyUrl={config.legal.privacyUrl} />}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <LegalLinks links={config.legal} />
        <span className="text-[13.5px] text-fg-3">
          {config.name} {process.env.NEXT_PUBLIC_APP_VERSION}
        </span>
      </div>
      {confirm && (
        <FormDialog
          title={confirm === "demo" ? "Beispielplan laden?" : "Mit einem leeren Plan anfangen?"}
          description={
            confirm === "demo"
              ? "Der Haushalt von Alex und Sam ersetzt deinen aktuellen Plan. Dein Stand bleibt im Verlauf."
              : "Alle Einträge verschwinden aus dem aktuellen Plan. Dein Stand bleibt im Verlauf."
          }
          saveLabel={confirm === "demo" ? "Beispiel laden" : "Leer anfangen"}
          onClose={() => setConfirm(null)}
          onSave={() => void startOver(confirm)}
        >
          <p className="text-fg-2">Du kannst danach jederzeit mit „Rückgängig“ zurück.</p>
        </FormDialog>
      )}
    </>
  );
}

/** Lets the visitor turn the anonymous usage statistics off for this browser. */
function AnalyticsCard({ privacyUrl }: { privacyUrl: string | null }) {
  // Read after mount: the server render can't know this browser's choice.
  const [state, setState] = useState<{ on: boolean; dnt: boolean } | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore client-only state after hydration
    setState({ on: !analyticsOptedOut(), dnt: browserRefusesTracking() });
  }, []);
  if (!state) return null;
  const toggle = () => {
    setAnalyticsOptOut(state.on);
    setState({ ...state, on: !state.on });
  };
  return (
    <section className="card mt-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2>
            <span className="inline-flex items-center gap-2">
              <ChartNoAxesColumn size={17} className="text-brand" />
              Anonyme Nutzungsstatistik
            </span>
          </h2>
          <p className="note !mt-1">
            {state.dnt
              ? "Dein Browser sendet „Do Not Track“, deshalb wird keine Statistik erfasst."
              : "Zählt, welche Funktionen genutzt werden – ohne Cookies und nie mit deinen Beträgen oder Namen. Die Einstellung gilt für diesen Browser."}{" "}
            {privacyUrl && (
              <a href={privacyUrl} className="underline hover:text-brand">
                Mehr dazu
              </a>
            )}
          </p>
        </div>
        {!state.dnt && <Toggle on={state.on} onToggle={toggle} label="Anonyme Nutzungsstatistik" />}
      </div>
    </section>
  );
}
