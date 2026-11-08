import { connection } from "next/server";
import { storageMode } from "@/server/config";
import { getStore } from "@/server/store";

export async function GET() {
  await connection();
  if (storageMode() === "local") return Response.json({ status: "ok", storage: "local" });
  try {
    // Readiness includes validating the current plan's schema, not just SQLite.
    getStore().getState();
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
