import { z } from "zod";
import { errorResponse, getStore } from "@/server/store";

const body = z.object({
  baseId: z.number().int(),
  data: z.unknown(),
  summary: z.string().max(500).nullish(),
  coalesceKey: z.string().max(200).nullish(),
});

export async function POST(req: Request) {
  try {
    const input = body.parse(await req.json());
    return Response.json(getStore().commit(input));
  } catch (err) {
    return errorResponse(err);
  }
}
