import { errorResponse, getStore, parseId } from "@/server/store";

export async function POST(_req: Request, ctx: RouteContext<"/api/history/[id]/restore">) {
  const id = parseId((await ctx.params).id);
  if (!id) return Response.json({ error: "Ungültige Version" }, { status: 400 });
  try {
    return Response.json(getStore().restore(id));
  } catch (err) {
    return errorResponse(err);
  }
}
