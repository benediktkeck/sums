import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type CSSProperties } from "react";
import { Check, CloudOff, Download, HardDrive, History, Smartphone } from "lucide-react";
import { HeroDemo } from "@/components/hero-demo";
import { LandingCtas, NavCta } from "@/components/landing-cta";
import { LandingMotion } from "@/components/landing-motion";
import { LegalLinks } from "@sums/ui/legal-links";
import { Logo } from "@sums/ui/logo";
import { calculate, calculateWithSwitch, monthlyEquivalent } from "@sums/core/engine/calculate";
import { projectSavings } from "@sums/core/engine/project";
import { demoPlan } from "@sums/core/fixtures/demo-plan";
import { formatDelta, formatEur } from "@sums/core/format";
import { INTERVAL_LABEL } from "@sums/core/model/ops";
import { appUrl, legalLinks, siteName, sourceUrl } from "@/lib/config";

// Prerendered: settings are read at build time (see lib/config.ts).
const NAME = siteName();
const APP_URL = appUrl();
const SOURCE_URL = sourceUrl();

export const metadata: Metadata = {
  title: { absolute: `${NAME} – Haushaltsplaner: sieh, was jeden Monat übrig bleibt` },
  description:
    "Trag Einkommen, Fixkosten und Sparraten ein und sieh, wie viel jeden Monat frei bleibt. Mit Szenarien für Umzug, Elternzeit oder Jobwechsel. Kostenlos, ohne Anmeldung, dein Plan bleibt in deinem Browser.",
};

async function LegalFooterLinks() {
  await connection();
  return <LegalLinks links={legalLinks()} />;
}

function SourceLink() {
  if (!SOURCE_URL) return null;
  return (
    <a href={SOURCE_URL} className="lp-source" target="_blank" rel="noopener">
      Open Source · selbst hosten
    </a>
  );
}

/** Everything on this page is computed from the same example plan the app offers. */
function example() {
  const plan = demoPlan();
  const r = calculate(plan);
  const scenarios = plan.switches.map((s) => ({ name: s.name, delta: calculateWithSwitch(plan, s.id, true).free - r.free }));
  const persons = plan.persons.map((p) => ({ ...p, amount: r.allowance.perPerson[p.id] ?? 0, share: r.allowance.share[p.id] ?? 0 }));
  const yearly = plan.expenses
    .filter((e) => e.interval !== "monthly")
    .map((e) => ({ name: e.name, amount: e.amount, interval: e.interval, monthly: monthlyEquivalent(e.amount, e.interval) }));
  const growth = projectSavings(plan, r, 120).total;
  return { plan, r, scenarios, persons, yearly, growth };
}

function GrowthChart({ series }: { series: number[] }) {
  const w = 320;
  const h = 120;
  const max = Math.max(...series);
  const min = series[0] * 0.8;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * w, h - ((v - min) / (max - min)) * (h - 8) - 4]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="lp-growth" role="img" aria-label={`Von ${formatEur(series[0])} auf ${formatEur(series.at(-1)!)} in zehn Jahren`}>
      <defs>
        <linearGradient id="lp-growth-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--brand)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#lp-growth-fill)" className="lp-growth-area" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="lp-growth-line" />
    </svg>
  );
}

function FlowSketch() {
  const node = (x: number, y: number, label: string, tone = "") => (
    <g transform={`translate(${x},${y})`}>
      <rect width="104" height="34" rx="9" className={`lp-flow-node ${tone}`} />
      <text x="52" y="21.5" textAnchor="middle" className="lp-flow-label">
        {label}
      </text>
    </g>
  );
  const edge = (d: string) => <path d={d} className="lp-flow-edge" />;
  return (
    <svg viewBox="0 0 420 170" className="lp-flow" role="img" aria-label="Gehälter fließen auf ein Gemeinschaftskonto und von dort zu Miete, Sparen und Taschengeld">
      {edge("M106,34 C140,34 140,85 158,85")}
      {edge("M106,136 C140,136 140,85 158,85")}
      {edge("M262,85 C290,85 290,22 314,22")}
      {edge("M262,85 L314,85")}
      {edge("M262,85 C290,85 290,148 314,148")}
      {node(2, 17, "Gehalt Alex")}
      {node(2, 119, "Gehalt Sam")}
      {node(158, 68, "Gemeinsam", "brand")}
      {node(314, 5, "Miete & Fixes")}
      {node(314, 68, "Sparkonto", "sav")}
      {node(314, 131, "Taschengeld")}
    </svg>
  );
}

/** Stagger index for a revealed element (see the scroll motion in globals.css). */
const stagger = (i: number) => ({ "--i": i }) as CSSProperties;

export default function LandingPage() {
  const { plan, r, scenarios, persons, yearly, growth } = example();
  const cap = plan.settings.allowanceCap;

  return (
    <div className="lp">
      <LandingMotion />
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-in">
          <Logo name={NAME} href="/" label={`${NAME} – Startseite`} />
          <nav className="lp-nav-links" aria-label="Abschnitte">
            <a href="#funktionen">Funktionen</a>
            <a href="#so-gehts">So geht&apos;s</a>
            <a href="#privat">Privatsphäre</a>
          </nav>
          <NavCta appUrl={APP_URL} />
        </div>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-wrap lp-hero-in">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">Haushaltsplaner · kostenlos · ohne Anmeldung</span>
              <h1>
                Wissen, was jeden Monat <span className="lp-grad">übrig bleibt.</span>
              </h1>
              <p className="lp-lead">
                Trag ein, was reinkommt und was regelmäßig rausgeht: Gehalt, Miete, Verträge, Versicherungen, Sparraten. {NAME} rechnet aus, was übrig
                bleibt, und zeigt dir, wie sich das ändert, wenn du umziehst, in Elternzeit gehst oder mehr verdienst.
              </p>
              <LandingCtas appUrl={APP_URL} position="hero" />
              <ul className="lp-checks">
                <li>
                  <Check size={16} /> Keine Bankanbindung
                </li>
                <li>
                  <Check size={16} /> Keine Anmeldung
                </li>
                <li>
                  <Check size={16} /> Läuft in deinem Browser
                </li>
              </ul>
            </div>
            <HeroDemo />
          </div>
        </section>

        <section id="funktionen" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head" data-reveal>
              <span className="lp-eyebrow">Funktionen</span>
              <h2>Einmal eintragen, dann planen.</h2>
              <p>
                Du erfasst keine Einkäufe und gleichst keine Kontoauszüge ab. Du trägst einmal ein, was jeden Monat passiert, und {NAME} rechnet damit: für
                dich allein, als Paar oder als Familie.
              </p>
            </div>

            <div className="lp-bento">
              <article className="lp-card wide" data-reveal style={stagger(0)}>
                <div className="lp-card-text">
                  <h3>Szenarien durchspielen</h3>
                  <p>
                    Elternzeit, Jobwechsel, größere Wohnung: In einem Szenario legst du fest, was sich dann ändert. Schalte es ein, und du siehst, wie viel mehr
                    oder weniger übrig bleibt.
                  </p>
                </div>
                <div className="lp-vis lp-chips">
                  {scenarios.map((s) => (
                    <span key={s.name} className="lp-chip">
                      <span className="sw on" aria-hidden />
                      {s.name}
                      <span className={`lp-delta n ${s.delta < 0 ? "down" : "up"}`}>{formatDelta(s.delta)}</span>
                    </span>
                  ))}
                </div>
              </article>

              <article className="lp-card" data-reveal style={stagger(2)}>
                <div className="lp-card-text">
                  <h3>Taschengeld aufteilen</h3>
                  <p>Was frei ist, kann als Taschengeld an jede Person gehen: zu gleichen Teilen oder nach Einkommen, auf Wunsch mit Obergrenze. Der Rest bleibt als Überschuss.</p>
                </div>
                <div className="lp-vis lp-split">
                  {persons.map((p) => (
                    <div key={p.id} className="lp-split-row">
                      <span className="lp-av" style={{ background: p.color }}>
                        {p.name[0]}
                      </span>
                      <span className="lp-split-name">{p.name}</span>
                      <span className="lp-meter">
                        <i style={{ width: `${Math.min(1, p.share / cap) * 100}%` }} />
                      </span>
                      <b className="n">{formatEur(p.amount)}</b>
                    </div>
                  ))}
                  <div className="lp-split-foot">
                    Überschuss <b className="n">{formatEur(r.surplus)}</b>
                  </div>
                </div>
              </article>
              <article className="lp-card" data-reveal style={stagger(0)}>
                <div className="lp-card-text">
                  <h3>Jährliche Kosten im Blick</h3>
                  <p>
                    Versicherung, Kfz-Steuer und Rundfunkbeitrag kommen nicht jeden Monat. {NAME} rechnet sie auf den Monat um und plant den Betrag als Rücklage ein.
                    So ist das Geld da, wenn die Rechnung kommt.
                  </p>
                </div>
                <div className="lp-vis lp-yearly">
                  {yearly.slice(0, 4).map((e) => (
                    <div key={e.name} className="lp-yearly-row">
                      <span className="lp-yearly-name">
                        {e.name}
                        <small>
                          {formatEur(e.amount)} {INTERVAL_LABEL[e.interval].toLowerCase()}
                        </small>
                      </span>
                      <b className="n">{formatEur(e.monthly)}</b>
                    </div>
                  ))}
                  <div className="lp-yearly-foot">pro Monat zurückgelegt</div>
                </div>
              </article>
              <article className="lp-card wide" data-reveal style={stagger(1)}>
                <div className="lp-card-text">
                  <h3>Geld zwischen Konten</h3>
                  <p>
                    Gemeinsames Konto, eigene Konten, Sparkonto: Auf einer Arbeitsfläche zeichnest du, wer wie viel wohin überweist. Die Beträge kommen direkt aus
                    deinem Plan.
                  </p>
                </div>
                <div className="lp-vis">
                  <FlowSketch />
                </div>
              </article>


              <article className="lp-card" data-reveal style={stagger(0)}>
                <div className="lp-card-text">
                  <h3>Sparkonten hochrechnen</h3>
                  <p>Trag Tagesgeld und Depot mit Zinssatz ein und sieh, wie viel nach zehn Jahren zusammenkommt, wenn die Sparraten so bleiben.</p>
                </div>
                <div className="lp-vis">
                  <div className="lp-growth-head">
                    <span>in 10 Jahren</span>
                    <b className="n">{formatEur(growth.at(-1)!)}</b>
                  </div>
                  <GrowthChart series={growth.filter((_, i) => i % 6 === 0)} />
                </div>
              </article>

              <article className="lp-card" data-reveal style={stagger(1)}>
                <div className="lp-card-text">
                  <h3>Jede Änderung gespeichert</h3>
                  <p>Du kannst alles rückgängig machen, ältere Stände wiederherstellen und wichtige Stände unter einem Namen sichern.</p>
                </div>
                <div className="lp-vis lp-history">
                  {[
                    ["gerade eben", "Szenario „Größere Wohnung“"],
                    ["vor 5 Min.", "Strom: 72,00 € → 78,00 €"],
                    ["gestern", "„Vor dem Umzug“ gespeichert", true],
                  ].map(([when, what, saved]) => (
                    <div key={String(what)} className={`lp-history-row ${saved ? "saved" : ""}`}>
                      <History size={14} />
                      <span>{what}</span>
                      <small>{when}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="lp-card" data-reveal style={stagger(2)}>
                <div className="lp-card-text">
                  <h3>Gemeinsam durchgehen</h3>
                  <p>Die Vorschau zeigt den Plan als einfache Rechnung ohne Eingabefelder. Praktisch, wenn ihr den Monat zusammen besprechen wollt.</p>
                </div>
                <div className="lp-vis lp-table">
                  {[
                    ["Einkommen", r.income.total, ""],
                    ["Fixkosten", r.fixed.total, "−"],
                    ["Variable Kosten", r.variable.total, "−"],
                    ["Rücklagen", r.savings.total, "−"],
                  ].map(([label, value, op]) => (
                    <div key={String(label)} className="lp-table-row">
                      <span>
                        <i>{op}</i>
                        {label}
                      </span>
                      <span className="n">{formatEur(Number(value))}</span>
                    </div>
                  ))}
                  <div className="lp-table-row total">
                    <span>
                      <i>=</i>Frei verfügbar
                    </span>
                    <span className="n">{formatEur(r.free)}</span>
                  </div>
                </div>
              </article>

            </div>
          </div>
        </section>

        <section id="so-gehts" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-section-head" data-reveal>
              <span className="lp-eyebrow">So geht&apos;s</span>
              <h2>So fängst du an.</h2>
              <p>Du kannst auch mit dem Beispielhaushalt von Alex und Sam starten und die Zahlen nach und nach durch deine ersetzen.</p>
            </div>
            <ol className="lp-steps">
              <li data-reveal style={stagger(0)}>
                <span className="lp-step-n">1</span>
                <h3>Eintragen</h3>
                <p>Einkommen, Fixkosten, variable Ausgaben und Sparraten. Was nur vierteljährlich oder jährlich fällig ist, rechnet {NAME} auf den Monat um.</p>
              </li>
              <li data-reveal style={stagger(1)}>
                <span className="lp-step-n">2</span>
                <h3>Durchspielen</h3>
                <p>Leg Szenarien für Veränderungen an, die anstehen oder möglich sind, und schalte sie ein und aus.</p>
              </li>
              <li data-reveal style={stagger(2)}>
                <span className="lp-step-n">3</span>
                <h3>Entscheiden</h3>
                <p>Du siehst, was frei bleibt, wie viel Taschengeld jede Person bekommt und was mit dem Überschuss passieren soll.</p>
              </li>
            </ol>
          </div>
        </section>

        <section id="privat" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-privacy" data-reveal>
              <div>
                <span className="lp-eyebrow">Privatsphäre</span>
                <h2>Deine Zahlen bleiben bei dir.</h2>
                <p>
                  {NAME} speichert deinen Plan nur in deinem Browser auf diesem Gerät. Du meldest dich nirgends an und verbindest kein Bankkonto. Der Server
                  liefert nur die App aus und bekommt deine Zahlen nie zu sehen.
                </p>
              </div>
              <ul className="lp-privacy-list">
                <li>
                  <HardDrive size={20} />
                  <b>Im Browser gespeichert</b>
                  <span>Dein Plan liegt auf deinem Gerät, nicht auf einem Server.</span>
                </li>
                <li>
                  <CloudOff size={20} />
                  <b>Offline nutzbar</b>
                  <span>Einmal geöffnet, funktioniert die App auch ohne Internet.</span>
                </li>
                <li>
                  <Download size={20} />
                  <b>Sicherung als Datei</b>
                  <span>Damit ziehst du auf ein anderes Gerät um. Und nichts geht verloren, wenn du die Browserdaten löschst.</span>
                </li>
                <li>
                  <Smartphone size={20} />
                  <b>Als App installierbar</b>
                  <span>Auf dem Handy legst du {NAME} wie eine App auf den Startbildschirm.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="lp-section lp-final">
          <div className="lp-wrap" data-reveal>
            <h2>Wie viel bleibt bei dir übrig?</h2>
            <p>Schau dir zuerst das Beispiel an oder fang direkt mit deinen eigenen Zahlen an.</p>
            <LandingCtas appUrl={APP_URL} position="final" />
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-in">
          <Logo name={NAME} href="/" label={`${NAME} – Startseite`} />
          <SourceLink />
          <Suspense fallback={null}>
            <LegalFooterLinks />
          </Suspense>
        </div>
      </footer>
    </div>
  );
}
