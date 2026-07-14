import { NextApiRequest, NextApiResponse } from "next";
import { getUserById } from "@/lib/supabase-admin";

import { serialize } from "cookie";

const ALLOWED_DEPARTMENTS = ["Engineering", "IT"];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = req.cookies.session;

  if (!session) {
    return res.status(401).json(null);
  }

  try {
    const user = await getUserById(session);


    if (!user) {
      return res.status(401).json(null);
    }

    // ❌ If the user's department is no longer allowed, force logout
    if (!ALLOWED_DEPARTMENTS.includes(user.Department)) {
      // Clear the session cookie
      res.setHeader(
        "Set-Cookie",
        serialize("session", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV !== "development",
          sameSite: "strict",
          expires: new Date(0),
          path: "/",
        })
      );

      return res.status(403).json({
        forceLogout: true,
        message: "Your role no longer has access. You have been logged out.",
      });
    }

    // ❌ If the user's status is Resigned, force logout
    if (user.Status === "Resigned") {
      // Clear the session cookie
      res.setHeader(
        "Set-Cookie",
        serialize("session", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV !== "development",
          sameSite: "strict",
          expires: new Date(0),
          path: "/",
        })
      );

      return res.status(403).json({
        forceLogout: true,
        message: "Your account has been resigned. You have been logged out.",
      });
    }

    return res.status(200).json({
      userId: user.id.toString(),
    });
  } catch (err) {
    console.error("ME API ERROR:", err);
    return res.status(500).json(null);
  }
}
