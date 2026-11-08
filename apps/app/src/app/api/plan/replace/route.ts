import { z } from "zod";
import { errorResponse, getStore } from "@/server/store";

const body = z.object({ plan: z.unknown(), summary: z.string().min(1).max(200) });

/** Replaces the whole plan (import, example plan, fresh start) as a new version. */
export async function POST(req: Request) {
  try {
    const { plan, summary } = body.parse(await req.json());
    return Response.json(getStore().replace(plan, summary));
  } catch (err) {
    return errorResponse(err);
  }
}
