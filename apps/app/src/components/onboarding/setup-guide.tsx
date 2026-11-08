"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  DatabaseBackup,
  Eye,
  Fuel,
  History,
  Landmark,
  Scale,
  Sparkles,
  ToggleRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { setAnalyticsProps, track } from "@/lib/analytics/client";
import { emptyPlan } from "@sums/core/model/empty";
import { isBlankPlan } from "@sums/core/model/ops";
import { nextHref, setupProgress, stepForPath, type StepId, type StepProgress } from "@/lib/onboarding";
import { useAppConfig, useBackend } from "../backend-context";
import { usePlan } from "../plan-provider";
import { useUi } from "../ui-context";
import { resetGuide, setGuide, skipStep, useGuide } from "./guide-store";

/** Shown under the step bar once the page has entries: how to work with what is there. */
const STEP_TIPS: Record<StepId, string> = {
  income: "Beträge änderst du direkt in der Liste. Das Häkchen schaltet einen Eintrag aus, ohne ihn zu löschen.",
  fixed: "Jahres- oder Quartalszahlungen mit vollem Betrag eintragen – der Monatsanteil wandert automatisch in die Rücklagen.",
  variable: "Ein grober Monatsdurchschnitt reicht. Rechts siehst du sofort, was übrig bleibt.",
  savings: "Unter Sparkonten kannst du Rücklagen einem Konto zuordnen und sehen, wie es wächst.",
};

function dismissGuide() {
  track("setup_guide_dismissed");
  setGuide({ dismissed: true });
}

function countLabel(s: StepProgress): string {
  if (s.skipped) return "übersprungen";
  return `${s.count} ${s.count === 1 ? "Eintrag" : "Einträge"}`;
}

function StepMark({ step, current }: { step: StepProgress; current?: boolean }) {
  return (
    <span className={`step-mark ${step.done ? (step.skipped ? "skipped" : "done") : ""} ${current ? "current" : ""}`} aria-hidden>
      {step.done && !step.skipped && <Check size={12} strokeWidth={3} />}
    </span>
  );
}

/** Thin guide above the section pages while the plan is being set up: where you are, what comes next. */
export function SetupBar() {
  const guide = useGuide();
  const { plan } = usePlan();
  const pathname = usePathname();
  const router = useRouter();
  const step = stepForPath(pathname);
  if (!guide || guide.dismissed || guide.demo || !step || isBlankPlan(plan)) return null;
  const progress = setupProgress(plan, guide.skipped);
  if (progress.complete) return null;
  const current = progress.steps.find((s) => s.id === step.id)!;
  const index = progress.steps.indexOf(current);
  const next = nextHref(progress, step.id);
  const filled = current.count > 0;

  return (
    <div className="setup-wrap">
      <div className="setup-bar" role="region" aria-label="Erste Schritte">
        <div className="setup-top">
          <span className="setup-k">
            <span className="hide-m">Erste Schritte · </span>Schritt {index + 1} von {progress.steps.length}
          </span>
          <ol className="setup-steps">
            {progress.steps.map((s) => (
              <li key={s.id}>
                <Link href={s.href} className={s.id === step.id ? "a" : ""} aria-current={s.id === step.id ? "step" : undefined}>
                  <StepMark step={s} current={s.id === step.id} />
                  <span className="setup-l">{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
          <span className="sp" />
          {!filled && (
            <button
              className="btn ghost !h-8"
              onClick={() => {
                skipStep(current.id);
                track("setup_step_completed", { step: current.id, method: "skipped" });
                if (setupProgress(plan, [...guide.skipped, current.id]).complete) track("setup_completed");
                router.push(nextHref({ ...progress, steps: progress.steps.map((s) => (s.id === current.id ? { ...s, done: true } : s)) }, current.id).href);
              }}
            >
              Überspringen
            </button>
          )}
          {filled && (
            <Link href={next.href} className="btn p !h-8">
              Weiter: {next.label} <ArrowRight />
            </Link>
          )}
          <button className="btn ghost ibtn !h-8 !w-8" aria-label="Erste Schritte ausblenden" title="Ausblenden (über „Mehr“ wieder einblenden)" onClick={dismissGuide}>
            <X />
          </button>
        </div>
        {filled && <p className="setup-tip">{STEP_TIPS[step.id]}</p>}
      </div>
    </div>
  );
}

/**
 * True while the overview checklist still lists open steps; the overview then
 * leaves out its (still empty) section cards. `null` until the browser state is known.
 */
export function useSetupOpen(): boolean | null {
  const guide = useGuide();
  const { plan } = usePlan();
  if (!guide) return null;
  return !guide.dismissed && !guide.demo && !setupProgress(plan, guide.skipped).complete;
}

/** Start of the overview while setting up: the steps with their state; once complete, what else there is. */
export function SetupChecklist() {
  const guide = useGuide();
  const { plan } = usePlan();
  if (!guide || guide.dismissed || guide.demo) return null;
  const progress = setupProgress(plan, guide.skipped);
  const pct = Math.round((progress.doneCount / progress.steps.length) * 100);

  return (
    <section className="card setup-card mb-4" aria-label="Erste Schritte">
      <div className="setup-card-head">
        <div className="min-w-0 flex-1">
          <h2 className="!justify-start">{progress.complete ? "Dein Plan steht" : "Dein Plan in vier Schritten"}</h2>
          <p className="note !mt-1">
            {progress.complete
              ? "Rechts siehst du, was jeden Monat übrig bleibt. Ändern kannst du alles jederzeit – jede Änderung wird gespeichert und lässt sich rückgängig machen."
              : "Trag Schritt für Schritt ein, was reinkommt und was rausgeht. Rechts rechnet die Zusammenfassung live mit."}
          </p>
        </div>
        <span className="setup-count n">
          {progress.doneCount} / {progress.steps.length}
        </span>
        <button className="btn ghost ibtn !h-8 !w-8" aria-label="Erste Schritte ausblenden" title="Ausblenden (über „Mehr“ wieder einblenden)" onClick={dismissGuide}>
          <X />
        </button>
      </div>
      <div className="setup-meter" aria-hidden>
        <i style={{ width: `${pct}%` }} />
      </div>

      {!progress.complete && (
        <ol className="setup-list">
          {progress.steps.map((s, i) => {
            const isNext = progress.next?.id === s.id;
            return (
              <li key={s.id} className={isNext ? "next" : s.done ? "done" : ""}>
                <Link href={s.href} className="setup-row">
                  <StepMark step={s} current={isNext} />
                  <span className="setup-row-t">
                    <b>
                      {i + 1}. {s.label}
                    </b>
                    <span>{s.done ? countLabel(s) : s.hint}</span>
                  </span>
                  {isNext ? (
                    <span className="btn p !h-8">
                      Jetzt eintragen <ArrowRight />
                    </span>
                  ) : (
                    <ArrowRight size={16} className="setup-row-go" />
                  )}
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {/* While setting up, the steps are all there is to do; the rest comes once the plan stands. */}
      {progress.complete && (
        <>
          <h3 className="setup-sub">Das kannst du als Nächstes ausprobieren</h3>
          <Discover />
        </>
      )}
    </section>
  );
}

type Feature = { icon: LucideIcon; title: string; text: string; href?: string; onClick?: () => void };

/** Features beyond the four lists, each with one sentence on what it is for. */
function Discover() {
  const { plan } = usePlan();
  const { editSwitch, openPreview } = useUi();
  const config = useAppConfig();
  const features: Feature[] = [
    {
      icon: ToggleRight,
      title: "Szenarien",
      text: "Was wäre, wenn …? Elternzeit, neuer Job, Umzug: ein Schalter, und alle Zahlen passen sich an.",
      onClick: () => editSwitch(null),
    },
    {
      icon: Scale,
      title: "Aufteilung",
      text: "Wie das Übrige verteilt wird: gleich oder nach Einkommen, mit Obergrenze fürs Taschengeld.",
      href: "/einstellungen",
    },
    { icon: Landmark, title: "Sparkonten", text: "Ordne Rücklagen Konten zu und sieh, wie Tagesgeld oder Depot über die Jahre wachsen.", href: "/sparkonten" },
    ...(!plan.settings.commute
      ? [{ icon: Fuel, title: "Pendeln", text: "Schalte die Fahrtkosten ein: Sprit wird aus Bürotagen, Kilometern und Verbrauch berechnet.", href: "/einstellungen" }]
      : []),
    { icon: History, title: "Verlauf", text: "Jede Änderung wird gespeichert. Strg+Z macht rückgängig, wichtige Stände kannst du benennen.", href: "/verlauf" },
    ...(openPreview ? [{ icon: Eye, title: "Vorschau", text: "Nur die Zahlen, ohne Bedienelemente – gut zum gemeinsamen Durchgehen.", onClick: openPreview }] : []),
    ...(config.mode === "local"
      ? [{ icon: DatabaseBackup, title: "Sicherung", text: "Dein Plan liegt nur in diesem Browser. Lade ab und zu eine Sicherung herunter.", href: "/einstellungen/daten" }]
      : []),
  ];
  return (
    <div className="discover">
      {features.map((f) => {
        const body = (
          <>
            <f.icon size={18} className="discover-ico" />
            <b>{f.title}</b>
            <span>{f.text}</span>
          </>
        );
        return f.href ? (
          <Link key={f.title} href={f.href} className="discover-tile">
            {body}
          </Link>
        ) : (
          <button key={f.title} type="button" className="discover-tile" onClick={f.onClick}>
            {body}
          </button>
        );
      })}
    </div>
  );
}

/** Above every page while the demo plan is loaded: it's an example, and how to get your own. */
export function DemoBanner() {
  const guide = useGuide();
  const { plan, flush, adopt, undo } = usePlan();
  const backend = useBackend();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const demo = !!guide?.demo;
  useEffect(() => setAnalyticsProps({ is_demo: demo }), [demo]);
  if (!guide?.demo || isBlankPlan(plan)) return null;

  const startOwn = async () => {
    track("demo_own_plan_clicked");
    setBusy(true);
    try {
      await flush();
      adopt(await backend.replace(emptyPlan(), "Eigenen Plan begonnen"));
      resetGuide();
      router.push("/uebersicht");
      toast.success("Beispiel entfernt – leg jetzt deinen eigenen Plan an.", { action: { label: "Rückgängig", onClick: () => void undo() } });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="setup-wrap">
      <div className="demo-banner" role="region" aria-label="Beispielplan">
        <Sparkles size={18} className="flex-none text-brand" />
        <p>
          <b>Das ist der Beispielplan von Alex und Sam.</b>{" "}
          <span className="hide-m">Klick dich durch, schalte Szenarien um und ändere Beträge – nichts davon ist echt.</span>
        </p>
        <span className="sp" />
        <button className="btn p !h-8" disabled={busy} onClick={() => void startOwn()}>
          Eigenen Plan anlegen
        </button>
        <button className="btn ghost ibtn !h-8 !w-8" aria-label="Hinweis schließen" onClick={() => setGuide({ demo: false })}>
          <X />
        </button>
      </div>
    </div>
  );
}

/** Menu entry: brings the guide back after it was closed. */
export function showGuide() {
  track("setup_guide_reopened");
  setGuide({ dismissed: false, demo: false });
}
