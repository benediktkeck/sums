import { z } from "zod";
import { errorResponse, getStore, parseId } from "@/server/store";

export async function GET(_req: Request, ctx: RouteContext<"/api/history/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Ungültige Version" }, { status: 400 });
  try {
    return Response.json(getStore().getVersion(id));
  } catch (err) {
    return errorResponse(err);
  }
}

const patch = z.object({ label: z.string().max(120).nullable() });

export async function PATCH(req: Request, ctx: RouteContext<"/api/history/[id]">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Ungültige Version" }, { status: 400 });
  try {
    const { label } = patch.parse(await req.json());
    return Response.json(getStore().setLabel(id, label));
  } catch (err) {
    return errorResponse(err);
  }
}
