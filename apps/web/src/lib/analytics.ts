import { send } from "@sums/ui/analytics";

/** The website's events. Same privacy rule as the app: what was clicked, never content. */
export type WebEvents = {
  landing_cta_clicked: { cta: "demo" | "own"; position: "nav" | "hero" | "final" };
  landing_scenario_toggled: { on: boolean };
};

export function track<E extends keyof WebEvents>(event: E, props: WebEvents[E]): void {
  send(event, props);
}
