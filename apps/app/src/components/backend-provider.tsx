"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlanState } from "@/lib/api-types";
import { httpBackend } from "@/lib/backend/http";
import { indexedDbPersistence } from "@/lib/backend/idb";
import { LocalBackend } from "@/lib/backend/local";
import type { AppConfig, Backend } from "@/lib/backend/types";
import { BackendContext } from "./backend-context";
import { PlanProvider } from "./plan-provider";
import { ShellSkeleton } from "./shell-skeleton";

/** Server mode: the plan was read on the server; edits go through the API. */
export function ServerBackend({ config, initial, children }: { config: AppConfig; initial: PlanState; children: React.ReactNode }) {
  const value = useMemo(() => ({ backend: httpBackend(), config }), [config]);
  return (
    <BackendContext.Provider value={value}>
      <PlanProvider initial={initial}>{children}</PlanProvider>
    </BackendContext.Provider>
  );
}

type LocalState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; backend: Backend; initial: PlanState };

/** Local mode: open the browser database, then hand the stored plan to the app. */
export function LocalBackendLoader({ config, children }: { config: AppConfig; children: React.ReactNode }) {
  const [state, setState] = useState<LocalState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const backend = await LocalBackend.open(await indexedDbPersistence());
      const initial = await backend.getState();
      if (!cancelled) setState({ status: "ready", backend, initial });
    })().catch((err: unknown) => {
      if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => (state.status === "ready" ? { backend: state.backend, config } : null), [state, config]);

  if (state.status === "error") {
    return (
      <main className="wrap">
        <div className="card max-w-xl">
          <h2>Daten konnten nicht geladen werden</h2>
          <p className="note">Der Browser hat den Zugriff auf den lokalen Speicher verweigert ({state.message}). Lade die Seite neu oder öffne {config.name} in einem normalen (nicht privaten) Fenster.</p>
        </div>
      </main>
    );
  }
  if (!value || state.status !== "ready") return <ShellSkeleton name={config.name} />;
  return (
    <BackendContext.Provider value={value}>
      <PlanProvider initial={state.initial}>{children}</PlanProvider>
    </BackendContext.Provider>
  );
}
