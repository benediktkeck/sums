import { errorResponse, getStore } from "@/server/store";

export async function POST() {
  try {
    return Response.json(getStore().redo());
  } catch (err) {
    return errorResponse(err);
  }
}
