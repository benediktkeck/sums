import type { HistoryEntry, PlanState, VersionMeta } from "@/lib/api-types";
import type { CommitInput } from "@/lib/store/version-tree";

/**
 * Where the plan is stored.
 * - `server`: SQLite on the server (self-hosted, shared by every device that opens it).
 * - `local`: IndexedDB in this browser; nothing leaves the device.
 */
export type StorageMode = "server" | "local";

import type { LegalLinks } from "@sums/ui/legal-links";

export type { LegalLinks };

/** Runtime configuration the server hands to the client. */
export type AppConfig = {
  /** Display name of this installation (`SUMS_APP_NAME`). */
  name: string;
  mode: StorageMode;
  /** A password protects the app (server mode). */
  auth: boolean;
  /** Links to the operator's legal notice and privacy policy, if configured. */
  legal: LegalLinks;
  /** Product analytics is configured (SUMS_POSTHOG_KEY); visitors can still turn it off. */
  analytics: boolean;
};

/** Everything the client needs from storage. Both backends behave the same. */
export interface Backend {
  readonly mode: StorageMode;
  /** false when the browser refused storage: edits only live until the tab closes. */
  readonly persistent: boolean;
  getState(): Promise<PlanState>;
  /** Rejects with `{ status: 409 }` when `baseId` is no longer the head. */
  commit(input: CommitInput): Promise<PlanState>;
  undo(): Promise<PlanState>;
  redo(): Promise<PlanState>;
  /** Replaces the whole plan as a new version (import, demo, reset). */
  replace(plan: unknown, summary: string): Promise<PlanState>;
  history(opts?: { labeledOnly?: boolean }): Promise<HistoryEntry[]>;
  restore(id: number): Promise<PlanState>;
  setLabel(id: number, label: string | null): Promise<VersionMeta>;
  /** Called when another tab changed the data. Returns an unsubscribe function. */
  onExternalChange(listener: () => void): () => void;
}
