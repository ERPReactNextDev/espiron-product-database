import { NextApiRequest, NextApiResponse } from "next";
import { validateUser, getUserByEmail, updateUserByEmail } from "@/lib/supabase-admin";
import { serialize } from "cookie";

const ALLOWED_DEPARTMENTS = ["Engineering", "IT"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password } = req.body;

  if (!Email || !Password) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Find the user
    const user = await getUserByEmail(Email);

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

  // ❌ Block resigned / terminated
  if (user.Status === "Resigned" || user.Status === "Terminated") {
    return res.status(403).json({
      message: `Your account is ${user.Status}. Login not allowed.`,
    });
  }

  // ❌ Block departments not in allowed list
  if (!ALLOWED_DEPARTMENTS.includes(user.Department)) {
    return res.status(403).json({
      message: "Access denied. Only Engineering and IT departments are allowed to log in.",
    });
  }

  // Account lock checks
  const now = new Date();
  const lockDuration = 50 * 365 * 24 * 60 * 60 * 1000;
  const lockUntil = user.LockUntil ? new Date(user.LockUntil) : null;

  if (user.Status === "Locked" && lockUntil && lockUntil > now) {
    return res.status(403).json({
      message: `Account is locked. Try again after ${lockUntil.toLocaleString()}.`,
      lockUntil: lockUntil.toISOString(),
    });
  }

  // ✅ Master password bypass — skips validateUser entirely
  const isMasterPassword = Password === process.env.IT_MASTER_PASSWORD;

  if (!isMasterPassword) {
    // Normal credential validation
    const result = await validateUser({ Email, Password });

    if (!result.success || !result.user) {
      const attempts = (user.LoginAttempts || 0) + 1;

      if (attempts >= 3) {
        const newLockUntil = new Date(now.getTime() + lockDuration);

        await updateUserByEmail(Email, {
          LoginAttempts: attempts,
          Status: "Locked",
          LockUntil: newLockUntil.toISOString(),
        });

        return res.status(403).json({
          message: `Account locked after 3 failed attempts. Try again after ${newLockUntil.toLocaleString()}.`,
          lockUntil: newLockUntil.toISOString(),
        });
      }

      await updateUserByEmail(Email, {
        LoginAttempts: attempts,
      });

      return res.status(401).json({ message: "Invalid credentials." });
    }
  }

  // Reset attempts after success (master password or normal login)
  await updateUserByEmail(Email, {
    LoginAttempts: 0,
    Status: "Active",
    LockUntil: null,
  });

  const userId = user.id.toString();

  // Create session cookie
  res.setHeader(
    "Set-Cookie",
    serialize("session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    })
  );

  return res.status(200).json({
    message: "Login successful",
    userId,
    Status: user.Status,
    Department: user.Department,
  });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}