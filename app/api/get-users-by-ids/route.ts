import { NextRequest, NextResponse } from "next/server";
import { getUsersByIds } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userIds } = body;

  if (!userIds || !Array.isArray(userIds)) {
    return NextResponse.json({ message: "Invalid userIds array" }, { status: 400 });
  }

  try {
    const users = await getUsersByIds(userIds);

    const userMap: Record<
      string,
      {
        firstName: string;
        lastName: string;
        userName: string;
        profilePicture?: string;
        department?: string;
      }
    > = {};

    users.forEach((user: any) => {
      const userId = user.id?.toString() || user.UserId?.toString();
      if (userId) {
        userMap[userId] = {
          firstName: user.Firstname || "",
          lastName: user.Lastname || "",
          userName: user.userName || "",
          profilePicture: user.profilePicture || "",
          department: user.Department || "",
        };
      }
    });

    return NextResponse.json({ users: userMap });
  } catch (err) {
    console.error("Error fetching users:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
