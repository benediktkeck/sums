import type { HistoryEntry, PlanState, VersionMeta } from "@/lib/api-types";
import type { Backend } from "./types";

export type HttpError = Error & { status?: number };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: HttpError = new Error(body.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return body as T;
}

const post = (body?: unknown): RequestInit => ({ method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/** Server mode: the API routes in `src/app/api`, backed by SQLite. */
export function httpBackend(): Backend {
  return {
    mode: "server",
    persistent: true,
    getState: () => api<PlanState>("/api/plan", { cache: "no-store" }),
    commit: (input) => api<PlanState>("/api/plan/commit", post(input)),
    undo: () => api<PlanState>("/api/plan/undo", post()),
    redo: () => api<PlanState>("/api/plan/redo", post()),
    replace: (plan, summary) => api<PlanState>("/api/plan/replace", post({ plan, summary })),
    history: (opts) => api<HistoryEntry[]>(`/api/history${opts?.labeledOnly ? "?labeled=1" : ""}`, { cache: "no-store" }),
    restore: (id) => api<PlanState>(`/api/history/${id}/restore`, post()),
    setLabel: (id, label) => api<VersionMeta>(`/api/history/${id}`, { method: "PATCH", body: JSON.stringify({ label }) }),
    // Other devices aren't pushed; a stale commit gets a 409 and the client reloads.
    onExternalChange: () => () => {},
  };
}
