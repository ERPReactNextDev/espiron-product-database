import { NextRequest, NextResponse } from "next/server";
import { serialize } from "cookie";

export async function POST(_req: NextRequest) {
  const cookie = serialize("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    expires: new Date(0),
    path: "/",
  });

  return NextResponse.json(
    { message: "Logged out" },
    { status: 200, headers: { "Set-Cookie": cookie } }
  );
}
