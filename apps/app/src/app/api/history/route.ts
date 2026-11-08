import { connection } from "next/server";
import { errorResponse, getStore } from "@/server/store";

export async function GET(req: Request) {
  await connection();
  try {
    const url = new URL(req.url);
    const labeledOnly = url.searchParams.get("labeled") === "1";
    return Response.json(getStore().history({ labeledOnly }));
  } catch (err) {
    return errorResponse(err);
  }
}
