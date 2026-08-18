import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const isRaw =
      file.type?.includes("pdf") ||
      file.type?.includes("word") ||
      file.type?.includes("officedocument");

    // Upload via base64 data URI to Cloudinary
    const dataUri = `data:${file.type};base64,${buffer.toString("base64")}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "products",
      resource_type: isRaw ? "raw" : "auto",
      use_filename: true,
      unique_filename: false,
    });

    // Fix URL for raw uploads
    const fixedUrl =
      uploadResult.resource_type === "raw"
        ? uploadResult.secure_url.replace("/image/upload/", "/raw/upload/")
        : uploadResult.secure_url;

    return NextResponse.json({
      secure_url: fixedUrl,
      public_id: uploadResult.public_id,
      resource_type: uploadResult.resource_type,
      original_filename: uploadResult.original_filename,
    });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
