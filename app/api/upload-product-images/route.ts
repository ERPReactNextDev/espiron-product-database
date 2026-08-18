import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json();

    const uploads = await Promise.all(
      images.map((img: string) =>
        cloudinary.uploader.upload(img, { folder: "products" })
      )
    );

    return NextResponse.json(uploads.map((u) => u.secure_url));
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
