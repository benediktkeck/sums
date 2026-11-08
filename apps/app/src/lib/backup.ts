import { z } from "zod";
import { parsePlan } from "@sums/core/model/parse";
import type { Plan } from "@sums/core/model/schema";

/**
 * A backup file: the current plan. It moves data between browsers, devices
 * and installations (local ↔ self-hosted).
 * The version history stays where it is; importing adds one new version.
 */
export const BACKUP_FORMAT = "sums-backup";
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  plan: Plan;
};

export function createBackup(plan: Plan, now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), plan };
}

/** e.g. "sums-2026-11-04.json"; the prefix comes from the installation's name. */
export function backupFileName(appName: string, now = new Date()): string {
  const slug =
    appName
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "plan";
  return `${slug}-${now.toISOString().slice(0, 10)}.json`;
}

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  plan: z.unknown(),
  // Backups from earlier versions may also carry money-flow boards; they are ignored.
});

export class BackupError extends Error {}

/**
 * Reads a backup file's JSON. Also accepts a bare plan (the older
 * "Plan als JSON exportieren" download).
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("Die Datei ist kein gültiges JSON.");
  }
  if (raw && typeof raw === "object" && "schemaVersion" in raw) {
    return createBackup(readPlan(raw), new Date(0));
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new BackupError("Das ist keine gültige Sicherungsdatei.");
  const b = parsed.data;
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: b.exportedAt, plan: readPlan(b.plan) };
}

function readPlan(raw: unknown): Plan {
  try {
    return parsePlan(raw);
  } catch {
    throw new BackupError("Der Plan in der Sicherung ist beschädigt oder stammt aus einer neueren Version.");
  }
}

