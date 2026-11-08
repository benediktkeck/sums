import { describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup, BackupError } from "./backup";
import { referencePlan } from "@sums/core/fixtures/reference-plan";
import { SCHEMA_VERSION } from "@sums/core/model/schema";

describe("backup", () => {
  it("round-trips the plan", () => {
    const b = createBackup(referencePlan(), new Date("2026-01-02T03:04:05Z"));
    const back = parseBackup(JSON.stringify(b));
    expect(back.plan).toEqual(referencePlan());
    expect(back.exportedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("reads backups from earlier versions that also carry boards", () => {
    const old = { ...createBackup(referencePlan()), simulations: [{ name: "Konten", data: { nodes: [] } }] };
    const back = parseBackup(JSON.stringify(old));
    expect(back.plan).toEqual(referencePlan());
    expect(back).not.toHaveProperty("simulations");
  });

  it("accepts a bare plan export and migrates old plans", () => {
    const old = JSON.parse(JSON.stringify(referencePlan()));
    old.schemaVersion = 4;
    delete old.settings.splitMode;
    delete old.settings.commute;
    const back = parseBackup(JSON.stringify(old));
    expect(back.plan.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("rejects other files with a readable message", () => {
    expect(() => parseBackup("nope")).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(/keine gültige Sicherungsdatei/);
    const broken = createBackup(referencePlan()) as unknown as { plan: { expenses: unknown } };
    broken.plan.expenses = "x";
    expect(() => parseBackup(JSON.stringify(broken))).toThrow(/Plan in der Sicherung/);
  });

  it("names the file after the installation", () => {
    const day = new Date("2026-03-01T12:00:00Z");
    expect(backupFileName("Sums", day)).toBe("sums-2026-03-01.json");
    expect(backupFileName("Bärs Budget", day)).toBe("bars-budget-2026-03-01.json");
    expect(backupFileName("€€", day)).toBe("plan-2026-03-01.json");
  });
});
