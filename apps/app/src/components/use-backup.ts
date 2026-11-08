"use client";

import { useCallback } from "react";
import { track } from "@/lib/analytics/client";
import { backupFileName, createBackup, parseBackup } from "@/lib/backup";
import { useAppConfig, useBackend } from "./backend-context";
import { usePlan } from "./plan-provider";

const dateFmt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Download and restore backup files, the same way in both storage modes. */
export function useBackup() {
  const backend = useBackend();
  const { name } = useAppConfig();
  const { plan, flush, adopt } = usePlan();

  const exportBackup = useCallback(async () => {
    await flush();
    download(backupFileName(name), JSON.stringify(createBackup(plan), null, 2));
    track("backup_exported");
  }, [flush, name, plan]);

  /** Replaces the plan (as a new, undoable version). */
  const importBackup = useCallback(
    async (file: File) => {
      let backup: ReturnType<typeof parseBackup>;
      try {
        backup = parseBackup(await file.text());
      } catch (e) {
        track("backup_import_failed");
        throw e;
      }
      await flush();
      const when = new Date(backup.exportedAt).getTime() > 0 ? ` vom ${dateFmt.format(new Date(backup.exportedAt))}` : "";
      const state = await backend.replace(backup.plan, `Sicherung${when} geladen`);
      adopt(state);
      track("backup_imported");
    },
    [adopt, backend, flush],
  );

  return { exportBackup, importBackup };
}
