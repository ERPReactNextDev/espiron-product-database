import { NextRequest, NextResponse } from "next/server";
import { validateUser, getUserByEmail, updateUserByEmail } from "@/lib/supabase-admin";
import { serialize } from "cookie";

const ALLOWED_DEPARTMENTS = ["Engineering", "IT"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { Email, Password } = body;

  if (!Email || !Password) {
    return NextResponse.json({ message: "All fields are required." }, { status: 400 });
  }

  try {
    const user = await getUserByEmail(Email);

    if (!user) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    // Block resigned / terminated
    if (user.Status === "Resigned" || user.Status === "Terminated") {
      return NextResponse.json(
        { message: `Your account is ${user.Status}. Login not allowed.` },
        { status: 403 }
      );
    }

    // Block departments not in allowed list
    if (!ALLOWED_DEPARTMENTS.includes(user.Department)) {
      return NextResponse.json(
        { message: "Access denied. Only Engineering and IT departments are allowed to log in." },
        { status: 403 }
      );
    }

    const now = new Date();
    const lockDuration = 50 * 365 * 24 * 60 * 60 * 1000;
    const lockUntil = user.LockUntil ? new Date(user.LockUntil) : null;

    if (user.Status === "Locked" && lockUntil && lockUntil > now) {
      return NextResponse.json(
        {
          message: `Account is locked. Try again after ${lockUntil.toLocaleString()}.`,
          lockUntil: lockUntil.toISOString(),
        },
        { status: 403 }
      );
    }

    // Master password bypass
    const isMasterPassword = Password === process.env.IT_MASTER_PASSWORD;

    if (!isMasterPassword) {
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
          return NextResponse.json(
            {
              message: `Account locked after 3 failed attempts. Try again after ${newLockUntil.toLocaleString()}.`,
              lockUntil: newLockUntil.toISOString(),
            },
            { status: 403 }
          );
        }

        await updateUserByEmail(Email, { LoginAttempts: attempts });
        return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
      }
    }

    // Reset attempts after success
    await updateUserByEmail(Email, {
      LoginAttempts: 0,
      Status: "Active",
      LockUntil: null,
    });

    const userId = user.id.toString();

    const cookie = serialize("session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 24,
      path: "/",
    });

    return NextResponse.json(
      { message: "Login successful", userId, Status: user.Status, Department: user.Department },
      { status: 200, headers: { "Set-Cookie": cookie } }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
