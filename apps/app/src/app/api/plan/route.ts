import { connection } from "next/server";
import { errorResponse, getStore } from "@/server/store";

export async function GET() {
  await connection();
  try {
    return Response.json(getStore().getState());
  } catch (err) {
    return errorResponse(err);
  }
}
