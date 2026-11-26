import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getUserById } from "@/lib/supabase-admin";

type PresenceRow = {
  id: number;
  Firstname: string | null;
  Lastname: string | null;
  profilePicture: string | null;
  spf_logging_status: "SPF_ONLINE" | "SPF_IDLE";
};

export async function GET(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session || !/^\d+$/.test(session)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const viewer = await getUserById(session);
    if (!viewer) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("id, Firstname, Lastname, profilePicture, spf_logging_status")
      .in("spf_logging_status", ["SPF_ONLINE", "SPF_IDLE"])
      .order("Firstname", { ascending: true })
      .order("Lastname", { ascending: true });

    if (error) {
      console.error("Failed to fetch SPF presence:", error);
      return NextResponse.json({ message: "Failed to fetch active users" }, { status: 500 });
    }

    const users = ((data || []) as PresenceRow[]).map((user) => ({
      id: String(user.id),
      firstName: user.Firstname || "",
      lastName: user.Lastname || "",
      profilePicture: user.profilePicture || null,
      status: user.spf_logging_status,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("SPF presence API error:", error);
    return NextResponse.json({ message: "Failed to fetch active users" }, { status: 500 });
  }
}
