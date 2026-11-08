import { errorResponse, getStore } from "@/server/store";

export async function POST() {
  try {
    return Response.json(getStore().undo());
  } catch (err) {
    return errorResponse(err);
  }
}
