import { NextRequest, NextResponse } from "next/server";
import { serialize } from "cookie";
import { updateUser } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  let statusUpdateFailed = false;
  const session = req.cookies.get("session")?.value;

  if (session && /^\d+$/.test(session)) {
    try {
      const user = await updateUser(session, { spf_logging_status: "SPF_OFFLINE" });
      if (!user) {
        console.error("Failed to set SPF logging status to offline for logout session.");
        statusUpdateFailed = true;
      }
    } catch (error) {
      console.error("Failed to update SPF logging status during logout:", error);
      statusUpdateFailed = true;
    }
  }

  const cookie = serialize("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    expires: new Date(0),
    path: "/",
  });

  return NextResponse.json(
    statusUpdateFailed
      ? { message: "Logged out, but failed to update SPF logging status." }
      : { message: "Logged out" },
    { status: statusUpdateFailed ? 500 : 200, headers: { "Set-Cookie": cookie } }
  );
}
