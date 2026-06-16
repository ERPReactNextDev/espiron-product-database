import { NextApiRequest, NextApiResponse } from "next";
import { getUsersByIds } from "@/lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { userIds } = req.body;

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ message: "Invalid userIds array" });
  }

  try {
    const users = await getUsersByIds(userIds);

    // Create a map of userId -> user data
    const userMap: Record<string, { firstName: string; lastName: string; userName: string; profilePicture?: string; department?: string }> = {};
    
    users.forEach((user: any) => {
      // Use the id field as string to match Firebase seenBy IDs
      const userId = user.id?.toString() || user.UserId?.toString();
      if (userId) {
        userMap[userId] = {
          firstName: user.Firstname || "",
          lastName: user.Lastname || "",
          userName: user.userName || "",
          profilePicture: user.profilePicture || "",
          department: user.Department || ""
        };
      }
    });

    return res.status(200).json({ users: userMap });
  } catch (err) {
    console.error("Error fetching users:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
