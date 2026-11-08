"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { calculate, type CalcResult } from "@sums/core/engine/calculate";
import type { PlanState, VersionMeta } from "@/lib/api-types";
import type { Plan } from "@sums/core/model/schema";
import { send, setAnalyticsProps, track } from "@/lib/analytics/client";
import { planChangeEvents, planProperties } from "@/lib/analytics/events";
import { useBackend } from "./backend-context";
import { guideState } from "./onboarding/guide-store";

export type SaveStatus = "saved" | "pending" | "error";
export type Period = "month" | "year";

export type EditOptions = {
  /** Human-readable description stored with the version. */
  summary: string;
  /** Edits with the same key in quick succession become one version (e.g. typing). */
  coalesceKey?: string;
};

type LastChange = { summary: string; key: string | null; baseFree: number | null };

type PlanContextValue = {
  plan: Plan;
  result: CalcResult;
  head: VersionMeta;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
  busy: boolean;
  lastChange: { summary: string; delta: number | null } | null;
  /** Applies a change locally right away and persists it in the background. */
  update: (mutate: (draft: Plan) => void, opts: EditOptions) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  /** Waits until all pending edits are stored. */
  flush: () => Promise<void>;
  /** Replaces local state with a server state (after restore, import, …). */
  adopt: (state: PlanState) => void;
  reload: () => Promise<void>;
  period: Period;
  setPeriod: (p: Period) => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}

type QueuedEdit = { plan: Plan; summary: string; key: string | null; at: number };

/** Typing in one field waits this long before it is sent. */
const DEBOUNCE_MS = 450;

export function PlanProvider({ initial, children }: { initial: PlanState; children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>(initial.plan);
  const [head, setHead] = useState<VersionMeta>(initial.head);
  const [canUndo, setCanUndo] = useState(initial.canUndo);
  const [canRedo, setCanRedo] = useState(initial.canRedo);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [busy, setBusy] = useState(false);
  const [lastChange, setLastChange] = useState<LastChange | null>(
    initial.head.summary ? { summary: initial.head.summary, key: null, baseFree: null } : null,
  );
  const [period, setPeriodState] = useState<Period>("month");
  const backend = useBackend();

  const planRef = useRef(plan);
  const headIdRef = useRef(initial.head.id);
  const queue = useRef<QueuedEdit[]>([]);
  const sending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiters = useRef<(() => void)[]>([]);
  /** Indirection so the send loop can re-schedule itself. */
  const pumpRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  /** Coalesce key of the last edit: keystrokes in one field count as one analytics event. */
  const trackedKey = useRef<string | null>(null);

  const result = useMemo(() => calculate(plan), [plan]);
  const resultRef = useRef(result);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);
  useEffect(() => setAnalyticsProps(planProperties(plan)), [plan]);

  useEffect(() => {
    const p = localStorage.getItem("sums:period");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore a client-only preference after hydration
    if (p === "year" || p === "month") setPeriodState(p);
  }, []);
  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p);
    track("period_changed", { period: p });
    localStorage.setItem("sums:period", p);
  }, []);

  const applyState = useCallback((s: PlanState, opts: { keepLocalPlan?: boolean } = {}) => {
    headIdRef.current = s.head.id;
    setHead(s.head);
    setCanUndo(s.canUndo);
    setCanRedo(s.canRedo);
    if (!opts.keepLocalPlan) {
      planRef.current = s.plan;
      setPlan(s.plan);
    }
  }, []);

  const settle = useCallback(() => {
    if (queue.current.length === 0 && !sending.current) {
      setSaveStatus((st) => (st === "error" ? st : "saved"));
      const w = waiters.current;
      waiters.current = [];
      w.forEach((fn) => fn());
    }
  }, []);

  const reload = useCallback(async () => {
    const s = await backend.getState();
    queue.current = [];
    applyState(s);
    setLastChange(s.head.summary ? { summary: s.head.summary, key: null, baseFree: null } : null);
    setSaveStatus("saved");
  }, [applyState, backend]);

  const pump = useCallback(
    async (force = false) => {
      if (sending.current) return;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      const next = queue.current[0];
      if (!next) return settle();
      // The newest keyed edit waits for typing to pause.
      const isLast = queue.current.length === 1;
      const wait = next.at + DEBOUNCE_MS - Date.now();
      if (!force && isLast && next.key && wait > 0) {
        timer.current = setTimeout(() => void pumpRef.current(), wait);
        return;
      }
      queue.current.shift();
      sending.current = true;
      try {
        const s = await backend.commit({
          baseId: headIdRef.current,
          data: next.plan,
          summary: next.summary,
          coalesceKey: next.key,
        });
        applyState(s, { keepLocalPlan: true });
        setSaveStatus(queue.current.length ? "pending" : "saved");
      } catch (err) {
        const e = err as Error & { status?: number };
        if (e.status === 409) {
          toast.error("Der Plan wurde an anderer Stelle geändert und neu geladen.");
          await reload().catch(() => setSaveStatus("error"));
        } else {
          setSaveStatus("error");
          queue.current.unshift(next);
          toast.error(`Speichern fehlgeschlagen: ${e.message}`, {
            action: { label: "Erneut versuchen", onClick: () => void pumpRef.current(true) },
          });
          sending.current = false;
          return;
        }
      }
      sending.current = false;
      if (queue.current.length) void pumpRef.current(force);
      else settle();
    },
    [applyState, backend, reload, settle],
  );
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const update = useCallback(
    (mutate: (draft: Plan) => void, opts: EditOptions) => {
      const before = planRef.current;
      const draft = structuredClone(before);
      mutate(draft);
      planRef.current = draft;
      setPlan(draft);
      const key = opts.coalesceKey ?? null;
      if (!key || key !== trackedKey.current) planChangeEvents(before, draft, guideState().skipped).forEach(send);
      trackedKey.current = key;
      const q = queue.current;
      const last = q[q.length - 1];
      const edit: QueuedEdit = { plan: draft, summary: opts.summary, key, at: Date.now() };
      if (last && key && last.key === key) q[q.length - 1] = edit;
      else q.push(edit);
      setLastChange((prev) =>
        prev && key && prev.key === key
          ? { ...prev, summary: opts.summary }
          : { summary: opts.summary, key, baseFree: resultRef.current.free },
      );
      setSaveStatus("pending");
      void pump();
    },
    [pump],
  );

  const flush = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (queue.current.length === 0 && !sending.current) return resolve();
      waiters.current.push(resolve);
      void pump(true);
    });
  }, [pump]);

  const move = useCallback(
    async (dir: "undo" | "redo") => {
      setBusy(true);
      try {
        await flush();
        const before = resultRef.current.free;
        const s = await (dir === "undo" ? backend.undo() : backend.redo());
        if (s.head.id === headIdRef.current) return;
        applyState(s);
        track(dir === "undo" ? "plan_undo" : "plan_redo");
        setLastChange({
          summary: dir === "undo" ? "Rückgängig gemacht" : "Wiederhergestellt",
          key: null,
          baseFree: before,
        });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [applyState, backend, flush],
  );
  const undo = useCallback(() => move("undo"), [move]);
  const redo = useCallback(() => move("redo"), [move]);

  const adopt = useCallback(
    (s: PlanState) => {
      queue.current = [];
      applyState(s);
      setLastChange(s.head.summary ? { summary: s.head.summary, key: null, baseFree: null } : null);
      setSaveStatus("saved");
    },
    [applyState],
  );

  // Another tab changed the data (local mode): show it unless edits are still on their way.
  useEffect(
    () =>
      backend.onExternalChange(() => {
        if (queue.current.length || sending.current) return;
        void reload().catch(() => {});
      }),
    [backend, reload],
  );

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (queue.current.length || sending.current) {
        void pump(true);
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pump]);

  const value = useMemo<PlanContextValue>(
    () => ({
      plan,
      result,
      head,
      canUndo: canUndo || saveStatus === "pending",
      canRedo: canRedo && saveStatus !== "pending",
      saveStatus,
      busy,
      lastChange: lastChange
        ? {
            summary: lastChange.summary,
            delta: lastChange.baseFree == null ? null : result.free - lastChange.baseFree,
          }
        : null,
      update,
      undo,
      redo,
      flush,
      adopt,
      reload,
      period,
      setPeriod,
    }),
    [plan, result, head, canUndo, canRedo, saveStatus, busy, lastChange, update, undo, redo, flush, adopt, reload, period, setPeriod],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

