import type { Plan } from "@sums/core/model/schema";

/** Shapes shared by the API route handlers and the client. */

export type VersionMeta = {
  id: number;
  createdAt: number;
  updatedAt: number;
  label: string | null;
  summary: string | null;
  parentId: number | null;
};

export type PlanState = {
  head: VersionMeta;
  plan: Plan;
  canUndo: boolean;
  canRedo: boolean;
};

export type HistoryEntry = VersionMeta & {
  isHead: boolean;
  /** Free amount (Differenz) of that version; null if it could not be computed. */
  free: number | null;
};
