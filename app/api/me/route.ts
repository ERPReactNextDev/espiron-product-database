import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/supabase-admin";
import { serialize } from "cookie";

const ALLOWED_DEPARTMENTS = ["Engineering", "IT"];

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
      return NextResponse.json(
        { forceLogout: true, message: "Your role no longer has access. You have been logged out." },
        { status: 403, headers: { "Set-Cookie": clearCookie } }
      );
    }

    // Force logout if resigned
    if (user.Status === "Resigned") {
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
