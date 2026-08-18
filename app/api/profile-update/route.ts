import { NextRequest, NextResponse } from "next/server";
import { updateUser } from "@/lib/supabase-admin";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    id,
    Firstname,
    Lastname,
    Email,
    Role,
    Department,
    Status,
    ContactNumber,
    Password,
    profilePicture,
  } = body;

  if (!id) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const updatedUser: any = {
      Firstname,
      Lastname,
      Email,
      Role,
      Department,
      Status,
      ContactNumber,
    };

    if (profilePicture) {
      updatedUser.profilePicture = profilePicture;
    }

    if (Password && Password.trim() !== "") {
      updatedUser.Password = await bcrypt.hash(Password, 10);
    }

    const result = await updateUser(id, updatedUser);

    if (result) {
      return NextResponse.json({ message: "Profile updated successfully" });
    } else {
      return NextResponse.json(
        { error: "User not found or no changes made" },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
