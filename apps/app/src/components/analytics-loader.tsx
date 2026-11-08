import { connection } from "next/server";
import { analyticsConfig, storageMode } from "@/server/config";
import { Analytics } from "./analytics";

/** Reads the analytics setting at request time (one build serves installs with and without it). */
export async function AnalyticsLoader() {
  await connection();
  const config = analyticsConfig();
  return config ? <Analytics token={config.key} mode={storageMode()} /> : null;
}
