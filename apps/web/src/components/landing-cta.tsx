"use client";

import { ArrowRight } from "lucide-react";
import { DEMO_PARAM } from "@sums/core/links";
import { track } from "@/lib/analytics";

/**
 * Main calls to action; they lead to the app. The app keeps each plan in the
 * visitor's browser on its own address, so returning visitors land in their
 * plan from either button.
 */
export function LandingCtas({ appUrl, size = "lg", position }: { appUrl: string; size?: "lg" | "md"; position: "hero" | "final" }) {
  return (
    <div className={`lp-ctas ${size}`}>
      <a href={`${appUrl}/uebersicht?${DEMO_PARAM}=1`} className="lp-btn primary" onClick={() => track("landing_cta_clicked", { cta: "demo", position })}>
        Beispiel ansehen <ArrowRight size={18} />
      </a>
      <a href={`${appUrl}/uebersicht`} className="lp-btn" onClick={() => track("landing_cta_clicked", { cta: "own", position })}>
        Eigenen Plan starten
      </a>
    </div>
  );
}

/** Compact button for the landing nav. */
export function NavCta({ appUrl }: { appUrl: string }) {
  return (
    <a href={`${appUrl}/uebersicht`} className="lp-btn primary sm" onClick={() => track("landing_cta_clicked", { cta: "own", position: "nav" })}>
      App öffnen
    </a>
  );
}
