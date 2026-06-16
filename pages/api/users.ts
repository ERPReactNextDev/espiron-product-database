import { NextApiRequest, NextApiResponse } from "next";
import { getUserById, getUserByReferenceID, getEngineeringITUsers, verifyITAccess } from "@/lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const userId      = req.query.id          as string | undefined;
    const referenceID = req.query.referenceID as string | undefined;
    const listType    = req.query.list        as string | undefined;

    /* ── Query by UserId (Supabase) ── */
    if (userId) {
      try {
        const user = await getUserById(userId);
        if (user) {
          const { Password, password, ...userData } = user;
          return res.status(200).json({
            ...userData,
            _id: user.id.toString(),
          });
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        return res.status(500).json({ error: "Invalid user ID format or server error" });
      }
    }

    /* ── Query by ReferenceID (used by audit trail name resolution) ── */
    if (referenceID) {
      try {
        const user = await getUserByReferenceID(referenceID);
        if (user) {
          const { Password, password, ...userData } = user;
          return res.status(200).json({
            ...userData,
            _id: user.id.toString(),
          });
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      } catch (error) {
        console.error("Error fetching user by referenceID:", error);
        return res.status(500).json({ error: "Server error" });
      }
    }

    /* ── Query for Engineering and IT users list ── */
    if (listType === "engineering-it") {
      try {
        // Get the viewer's user data from the session to check if they're IT
        const viewerId = req.headers["x-user-id"] || req.query.viewerId;
        const isITViewer = await verifyITAccess(viewerId as string);

        // Fetch users based on viewer department
        const users = await getEngineeringITUsers(isITViewer ? "IT" : undefined);

        // Remove password fields
        const usersWithoutPassword = users.map((user:any) => {
          const { Password, password, ...userData } = user;
          return {
            ...userData,
            _id: user.id.toString(),
          };
        });

        return res.status(200).json(usersWithoutPassword);
      } catch (error) {
        console.error("Error fetching engineering-it users:", error);
        return res.status(500).json({ error: "Server error" });
      }
    }

    return res.status(400).json({ error: "User ID, ReferenceID, or list parameter is required" });

  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
}
