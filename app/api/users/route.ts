import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  getUserByReferenceID,
  getEngineeringITUsers,
} from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId      = searchParams.get("id")          ?? undefined;
  const referenceID = searchParams.get("referenceID") ?? searchParams.get("ReferenceID") ?? undefined;
  const listType    = searchParams.get("list")        ?? undefined;

  /* ── Query by UserId ── */
  if (userId) {
    try {
      const user = await getUserById(userId);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const { Password, password, ...userData } = user;
      return NextResponse.json({ ...userData, _id: user.id.toString() });
    } catch (error) {
      console.error("Error fetching user data:", error);
      return NextResponse.json(
        { error: "Invalid user ID format or server error" },
        { status: 500 }
      );
    }
  }

  /* ── Query by ReferenceID ── */
  if (referenceID) {
    try {
      const user = await getUserByReferenceID(referenceID);
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      const { Password, password, ...userData } = user;
      return NextResponse.json({ ...userData, _id: user.id.toString() });
    } catch (error) {
      console.error("Error fetching user by referenceID:", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  /* ── Query for Engineering and IT users list ── */
  if (listType === "engineering-it") {
    try {
      const viewerId = req.headers.get("x-user-id") ?? searchParams.get("viewerId") ?? undefined;
      const viewer   = viewerId ? await getUserById(viewerId) : null;

      const users = await getEngineeringITUsers(
        viewer?.Department,
        viewer?.Role
      );

      const usersWithoutPassword = users.map((user: any) => {
        const { Password, password, ...userData } = user;
        return { ...userData, _id: user.id.toString() };
      });

      return NextResponse.json(usersWithoutPassword);
    } catch (error) {
      console.error("Error fetching engineering-it users:", error);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
  }

  return NextResponse.json(
    { error: "User ID, ReferenceID, or list parameter is required" },
    { status: 400 }
  );
}
