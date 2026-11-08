"use client";

import { createContext, useContext } from "react";
import type { AppConfig, Backend } from "@/lib/backend/types";

export type BackendContextValue = { backend: Backend; config: AppConfig };

export const BackendContext = createContext<BackendContextValue | null>(null);

function useBackendContext(): BackendContextValue {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error("useBackend must be used within a backend provider");
  return ctx;
}

/** Storage for the plan and boards (server API or this browser). */
export const useBackend = () => useBackendContext().backend;
/** Runtime configuration from the server (storage mode, password, legal pages). */
export const useAppConfig = () => useBackendContext().config;
