import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { analyticsConfig, appName, hostingProvider, legalLinks, storageMode } from "@/server/config";
import { authPassword } from "@/server/auth";

export const metadata: Metadata = { title: "Datenschutz" };

/** Date of the last change to this text. Update it whenever the text changes. */
const REVISED = "November 2026";

/** Where PostHog stores the data, from the configured host. */
function analyticsRegion(host: string): string {
  const name = new URL(host).hostname;
  if (/^eu(\.i)?\.posthog\.com$/.test(name)) return "auf Servern in der EU (Frankfurt am Main)";
  if (/^us(\.i)?\.posthog\.com$/.test(name)) return "auf Servern in den USA";
  return `auf der PostHog-Installation unter ${name}`;
}

/**
 * Privacy policy that matches what this installation does: storage mode,
 * password cookie, offline cache and (if configured) cookieless analytics.
 * Who the operator is comes from their Impressum, the hosting provider from
 * SUMS_HOSTING_PROVIDER; neither belongs in the code.
 */
async function PrivacyText() {
  await connection();
  const name = appName();
  const local = storageMode() === "local";
  const analytics = analyticsConfig();
  const hosting = hostingProvider();
  const imprint = legalLinks().imprintUrl;
  const password = !!authPassword();

  return (
    <article className="legal">
      <h1>Datenschutz</h1>
      <p className="legal-lead">
        Kurz gesagt: {local ? "Deine Planzahlen verlassen deinen Browser nicht." : `Dein Plan liegt auf dem Server dieser ${name}-Installation.`} Es gibt keine
        Konten, keine Werbung und keine Tracking-Cookies.
        {analytics && " Für eine anonyme Nutzungsstatistik zählen wir, welche Funktionen genutzt werden, aber nie deine Beträge oder Namen."}
      </p>

      <h2>Verantwortlich</h2>
      {imprint ? (
        <p>
          Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist der im{" "}
          <a href={imprint} target="_blank" rel="noopener">
            Impressum
          </a>{" "}
          genannte Betreiber. Dort findest du auch die Kontaktdaten.
        </p>
      ) : (
        <p>Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist der Betreiber dieser {name}-Installation.</p>
      )}

      <h2>Deine Planungsdaten</h2>
      {local ? (
        <>
          <p>
            {name} speichert deinen Plan und seinen Verlauf ausschließlich im Speicher deines Browsers (IndexedDB) auf diesem Gerät. Diese
            Daten werden weder an unseren Server noch an Dritte übertragen. Wir können sie nicht einsehen und nicht wiederherstellen. Du löschst sie, indem du
            die Websitedaten dieser Seite in deinem Browser löschst. Sicherungsdateien, die du herunterlädst, liegen nur dort, wo du sie speicherst.
          </p>
          <p>
            Außerdem merkt sich der Browser ein paar Einstellungen im lokalen Speicher, etwa die Monats- oder Jahresansicht und ob die ersten Schritte
            ausgeblendet sind. Sie sind für die von dir gewünschte Funktion nötig und werden nicht übertragen (§ 25 Abs. 2 Nr. 2 TDDDG).
          </p>
        </>
      ) : (
        <>
          <p>
            Dein Plan und sein Verlauf werden in einer Datenbank auf dem Server dieser Installation gespeichert, damit du von jedem Gerät
            darauf zugreifen kannst. Rechtsgrundlage ist die Bereitstellung des Dienstes, den du nutzt (Art. 6 Abs. 1 lit. b DSGVO). Die Daten bleiben
            gespeichert, bis der Betreiber sie löscht.
          </p>
          {password && (
            <p>
              Diese Installation ist mit einem Passwort geschützt. Nach der Anmeldung setzt {name} ein technisch notwendiges Cookie, das deine Sitzung
              kennzeichnet (§ 25 Abs. 2 Nr. 2 TDDDG). Es enthält nicht das Passwort selbst und läuft nach sechs Monaten ab.
            </p>
          )}
        </>
      )}

      <h2>Aufruf der Website</h2>
      <p>
        Wenn du {name} aufrufst, verarbeitet der Server technisch notwendige Daten: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, übertragene
        Datenmenge sowie Browser und Betriebssystem. Das ist nötig, um die Seiten auszuliefern und den Betrieb abzusichern (Art. 6 Abs. 1 lit. f DSGVO).
        Protokolldateien werden nur so lange aufbewahrt, wie es dafür nötig ist.
      </p>
      {hosting && (
        <p>
          Hosting-Anbieter: {hosting}. Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Sitzt er außerhalb der EU, stützt sich
          die Übermittlung auf einen Angemessenheitsbeschluss der EU-Kommission (etwa das EU-US Data Privacy Framework) oder auf
          EU-Standardvertragsklauseln.
        </p>
      )}

      {local && (
        <>
          <h2>Offline-Nutzung</h2>
          <p>
            Damit {name} auch ohne Internet startet, legt ein Service Worker die Seiten und Programmdateien im Cache deines Browsers ab. Der Cache enthält
            keine Planungsdaten und keine personenbezogenen Daten.
          </p>
        </>
      )}

      {analytics && (
        <>
          <h2>Anonyme Nutzungsstatistik</h2>
          <p>Um zu verstehen, welche Funktionen genutzt werden und wo der Einstieg hakt, erfassen wir eine anonyme Nutzungsstatistik mit PostHog.</p>
          <ul>
            <li>
              <b>Was erfasst wird:</b> aufgerufene Seiten und die Seite, von der du kommst (Referrer), Bedienschritte wie „Fixkosten angelegt“, „Szenario
              umgeschaltet“ oder „Sicherung heruntergeladen“ mit der Art des Eintrags, Klickpositionen auf der Seite (für Heatmaps), technische
              Fehlermeldungen sowie Browser, Betriebssystem, Bildschirmgröße und Sprache.
            </li>
            <li>
              <b>Was nicht erfasst wird:</b> Beträge, Namen, Bezeichnungen, Notizen und alle anderen Inhalte deines Plans. Es gibt keine
              Sitzungsaufzeichnung und keine Protokolle deiner Eingaben.
            </li>
            <li>
              <b>Ohne Cookies:</b> Es werden keine Cookies gesetzt und nichts auf deinem Gerät gespeichert oder ausgelesen. Die Daten gehen zuerst an unseren
              Server, der sie an PostHog weiterleitet, einschließlich deiner IP-Adresse. PostHog bildet aus IP-Adresse, Browserkennung und Datum einen
              anonymen Tageswert, um die Schritte eines Besuchs zusammenzufassen, und speichert die IP-Adresse selbst nicht. Am nächsten Tag ergibt sich ein
              neuer Wert, du wirst also nicht über Tage hinweg wiedererkannt.
            </li>
            <li>
              <b>Anbieter:</b> PostHog Inc., USA. Die Daten werden {analyticsRegion(analytics.host)} gespeichert. Mit PostHog besteht ein Vertrag zur
              Auftragsverarbeitung (Art. 28 DSGVO) mit EU-Standardvertragsklauseln. Mehr dazu in der{" "}
              <a href="https://posthog.com/privacy" target="_blank" rel="noopener">
                Datenschutzerklärung von PostHog
              </a>
              .
            </li>
            <li>
              <b>Rechtsgrundlage:</b> unser berechtigtes Interesse, {name} anhand anonymer Nutzungsdaten zu verbessern (Art. 6 Abs. 1 lit. f DSGVO). Die
              Rohdaten werden gelöscht, sobald sie für die Auswertung nicht mehr nötig sind.
            </li>
            <li>
              <b>Widerspruch:</b> Unter <i>Einstellungen → Daten &amp; Sicherung</i> schaltest du die Statistik für deinen Browser aus; die Wahl merkt sich
              der Browser im lokalen Speicher. Sendet dein Browser „Do Not Track“ oder „Global Privacy Control“, wird ohnehin keine Statistik erfasst. Du
              kannst außerdem jederzeit formlos beim Betreiber widersprechen.
            </li>
          </ul>
        </>
      )}

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
        Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen, die auf berechtigten Interessen beruhen (Art. 21). Wende dich dafür an den
        Betreiber. Weil {name} keine Konten kennt{analytics ? " und die Statistik anonym ist" : ""}, können wir dir gespeicherte Daten meist nicht zuordnen.
        Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), zum Beispiel bei der deines Bundeslands.
      </p>

      <p className="legal-rev">Stand: {REVISED}</p>
    </article>
  );
}

export default function PrivacyPage() {
  return (
    <main className="wrap max-w-[760px]">
      <Suspense fallback={<div className="card h-96 animate-pulse" />}>
        <PrivacyText />
      </Suspense>
    </main>
  );
}
