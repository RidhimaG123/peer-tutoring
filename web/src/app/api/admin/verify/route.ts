import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/verifyAdmin";

export async function GET(req: NextRequest) {
  const result = await verifyAdmin(req);
  if (!result.ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: result.status });
  }

  return NextResponse.json({ isAdmin: true });
}
