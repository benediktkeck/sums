"use client";

import { NO_AUTOFILL } from "@/lib/no-autofill";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, BookmarkPlus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { HistoryEntry } from "@/lib/api-types";
import { track } from "@/lib/analytics/client";
import { formatEur } from "@sums/core/format";
import { PageHeader, Wrap } from "../page";
import { useBackend } from "../backend-context";
import { usePlan } from "../plan-provider";
import { Field, FormDialog } from "../ui-bits";

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

function when(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "gerade eben";
  if (diff < 3_600_000) return `vor ${Math.round(diff / 60_000)} Min.`;
  return dateFmt.format(ts);
}

export function HistoryView() {
  const { head, adopt, flush, result } = usePlan();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [labeledOnly, setLabeledOnly] = useState(false);
  const [naming, setNaming] = useState<HistoryEntry | null>(null);
  const backend = useBackend();

  const load = useCallback(async () => {
    await flush();
    setEntries(await backend.history({ labeledOnly }));
  }, [backend, flush, labeledOnly]);

  useEffect(() => track("history_opened"), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and when the head moves
    load().catch((e) => toast.error((e as Error).message));
  }, [load, head.id, head.updatedAt]);

  const restore = async (e: HistoryEntry) => {
    try {
      await flush();
      const s = await backend.restore(e.id);
      adopt(s);
      track("version_restored");
      toast.success(`${e.label ? `„${e.label}“` : `Version ${e.id}`} wiederhergestellt – als neue Version gespeichert.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const currentEntry = entries?.find((e) => e.isHead);

  return (
    <Wrap>
      <PageHeader
        title="Verlauf & Speicherstände"
        lead="Jede Änderung wird automatisch als Version gespeichert. Speicherstände sind Versionen mit Namen. Wiederherstellen legt eine neue Version an – nichts geht verloren."
        action={
          <button
            className="btn p"
            onClick={() =>
              setNaming(currentEntry ?? { ...head, isHead: true, free: result.free })
            }
          >
            <BookmarkPlus />
            <span className="hide-m">Aktuellen Stand speichern</span>
          </button>
        }
      />
      <section className="panel">
        <div className="tools">
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={!labeledOnly} className={!labeledOnly ? "a" : ""} onClick={() => setLabeledOnly(false)}>
              Alle Änderungen
            </button>
            <button role="tab" aria-selected={labeledOnly} className={labeledOnly ? "a" : ""} onClick={() => setLabeledOnly(true)}>
              Speicherstände
            </button>
          </div>
        </div>
        {!!entries?.length && (
          <div className="cols r-hist">
            <span>Version</span>
            <span>Änderung</span>
            <span>Zeitpunkt</span>
            <span className="rt">Frei verfügbar</span>
            <span></span>
            <span></span>
          </div>
        )}
        {entries == null && <div className="empty">Lädt …</div>}
        {entries?.length === 0 && (
          <div className="empty">{labeledOnly ? "Noch keine Speicherstände. Speichere den aktuellen Stand mit einem Namen." : "Noch keine Versionen."}</div>
        )}
        {entries?.map((e) => (
          <div className={`r r-hist ${e.isHead ? "bg-[color-mix(in_srgb,var(--brand)_7%,transparent)]" : ""}`} key={e.id}>
            <span className="n text-[13px] text-fg-3">#{e.id}</span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-nowrap">
                {e.label && (
                  <span className="tag brand">
                    <Bookmark size={12} className="mr-1" />
                    {e.label}
                  </span>
                )}
                <span className="truncate max-md:line-clamp-2 max-md:whitespace-normal" title={e.summary ?? undefined}>
                  {e.summary ?? "Änderung"}
                </span>
                {e.isHead && <span className="tag flex-none">Aktuell</span>}
              </span>
              <small className="pvs m-sub">{when(e.updatedAt)}</small>
            </span>
            <span className="hide-m text-[13.5px] text-fg-2">{when(e.updatedAt)}</span>
            <span className={`n hide-m text-right font-medium ${e.free != null && e.free < 0 ? "text-neg" : ""}`}>
              {e.free == null ? "–" : formatEur(e.free)}
            </span>
            <button className="btn ghost justify-self-end" onClick={() => setNaming(e)} title={e.label ? "Umbenennen" : "Als Speicherstand benennen"}>
              <Bookmark />
              <span className="hide-m">{e.label ? "Umbenennen" : "Benennen"}</span>
            </button>
            <button className="btn justify-self-end" disabled={e.isHead} onClick={() => void restore(e)} title="Diesen Stand wiederherstellen">
              <RotateCcw />
              <span className="hide-m">Wiederherstellen</span>
            </button>
          </div>
        ))}
      </section>
      {naming && (
        <NameDialog
          entry={naming}
          onClose={() => setNaming(null)}
          onSaved={() => {
            setNaming(null);
            void load();
          }}
        />
      )}
    </Wrap>
  );
}

function NameDialog({ entry, onClose, onSaved }: { entry: HistoryEntry; onClose: () => void; onSaved: () => void }) {
  const { flush } = usePlan();
  const backend = useBackend();
  const [label, setLabel] = useState(entry.label ?? "");
  const save = async (value: string | null) => {
    try {
      await flush();
      await backend.setLabel(entry.id, value);
      if (value) track("version_labeled");
      toast.success(value ? `Gespeichert als „${value}“` : "Name entfernt");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <FormDialog
      title={entry.label ? "Speicherstand umbenennen" : "Als Speicherstand speichern"}
      description={`Version #${entry.id}${entry.summary ? ` · ${entry.summary}` : ""}`}
      onClose={onClose}
      onSave={() => void save(label.trim())}
      canSave={label.trim().length > 0}
      onDelete={entry.label ? () => void save(null) : undefined}
    >
      <Field label="Name" htmlFor="label">
        <input {...NO_AUTOFILL} id="label" className="field" autoFocus value={label} maxLength={120} placeholder="z. B. Vor dem Umzug" onChange={(e) => setLabel(e.target.value)} />
      </Field>
    </FormDialog>
  );
}
