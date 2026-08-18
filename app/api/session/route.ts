import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const userId = req.cookies.get("userId")?.value ?? null;
  return NextResponse.json({ userId });
}
