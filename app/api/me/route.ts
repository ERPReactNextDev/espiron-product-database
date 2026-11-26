import { NextRequest, NextResponse } from "next/server";
import { getUserById, updateUser } from "@/lib/supabase-admin";
import { serialize } from "cookie";

const ALLOWED_DEPARTMENTS = ["Engineering", "IT"];

async function markUserOffline(userId: string) {
  try {
    const updatedUser = await updateUser(userId, { spf_logging_status: "SPF_OFFLINE" });
    if (!updatedUser) {
      console.error("Failed to set SPF logging status to offline for forced logout.");
    }
  } catch (error) {
    console.error("Failed to update SPF logging status during forced logout:", error);
  }
}

export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;

  if (!session) {
    return NextResponse.json(null, { status: 401 });
  }

  try {
    const user = await getUserById(session);

    if (!user) {
      return NextResponse.json(null, { status: 401 });
    }

    const clearCookie = serialize("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      expires: new Date(0),
      path: "/",
    });

    // Force logout if department is no longer allowed
    if (!ALLOWED_DEPARTMENTS.includes(user.Department) && !ALLOWED_DEPARTMENTS.map(d => d.toLowerCase()).includes(user.Department?.toLowerCase())) {
      await markUserOffline(user.id.toString());
      return NextResponse.json(
        { forceLogout: true, message: "Your role no longer has access. You have been logged out." },
        { status: 403, headers: { "Set-Cookie": clearCookie } }
      );
    }

    // Force logout if resigned
    if (user.Status === "Resigned") {
      await markUserOffline(user.id.toString());
      return NextResponse.json(
        { forceLogout: true, message: "Your account has been resigned. You have been logged out." },
        { status: 403, headers: { "Set-Cookie": clearCookie } }
      );
    }

    return NextResponse.json({ 
      userId: user.id.toString(),
      department: user.Department 
    });
  } catch (err) {
    console.error("ME API ERROR:", err);
    return NextResponse.json(null, { status: 500 });
  }
}
