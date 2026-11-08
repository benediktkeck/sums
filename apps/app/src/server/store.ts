import { getDb } from "./db/client";
import { ConflictError, NotFoundError, PlanStore } from "./plan-store";
import { ZodError } from "zod";

export function getStore(): PlanStore {
  return new PlanStore(getDb());
}

/** Maps store errors to JSON responses with German messages. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ConflictError) {
    return Response.json({ error: err.message, headId: err.headId }, { status: 409 });
  }
  if (err instanceof NotFoundError) return Response.json({ error: err.message }, { status: 404 });
  if (err instanceof ZodError || err instanceof SyntaxError) {
    return Response.json({ error: "Ungültige Daten", details: String(err) }, { status: 400 });
  }
  console.error(err);
  return Response.json({ error: "Interner Fehler" }, { status: 500 });
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
