import { send as sendEvent } from "@sums/ui/analytics";
import type { AnalyticsEvents, AnyEvent, EventName } from "./events";

/** The app's typed analytics on top of the shared client (`@sums/ui/analytics`). */
export { analyticsOptedOut, browserRefusesTracking, initAnalytics, setAnalyticsOptOut, setAnalyticsProps } from "@sums/ui/analytics";

export function track<E extends EventName>(event: E, ...args: AnalyticsEvents[E] extends Record<string, never> ? [] : [AnalyticsEvents[E]]): void {
  sendEvent(event, args[0] ?? {});
}

export function send(e: AnyEvent): void {
  sendEvent(e.event, e.props);
}
