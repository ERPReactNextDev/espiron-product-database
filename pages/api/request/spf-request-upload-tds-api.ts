import type { NextApiRequest, NextApiResponse } from "next";
import cloudinary from "@/lib/cloudinary";
import formidable, { File } from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false, // REQUIRED for formidable
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ================= METHOD GUARD =================
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ================= PARSE FORM =================
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    const { files } = await new Promise<{
      files: formidable.Files;
    }>((resolve, reject) => {
      form.parse(req, (err, _fields, files) => {
        if (err) reject(err);
        resolve({ files });
      });
    });

    // ================= GET FILE =================
    const uploadedFile = files.file as File | File[] | undefined;

    if (!uploadedFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = Array.isArray(uploadedFile)
      ? uploadedFile[0]
      : uploadedFile;

    // ================= CLOUDINARY UPLOAD =================
    // Upload to a dedicated TDS folder
    const uploadResult = await cloudinary.uploader.upload(file.filepath, {
      folder: "spf-tds",
      resource_type: "auto", // Let Cloudinary detect file type
      use_filename: true,
      unique_filename: true,
      overwrite: true,
    });

    // ================= CLEANUP =================
    fs.unlinkSync(file.filepath);

    // ================= URL =================
    const fixedUrl = uploadResult.secure_url;

    // ================= SUCCESS =================
    return res.status(200).json({
      secure_url: fixedUrl,
      public_id: uploadResult.public_id,
      resource_type: uploadResult.resource_type,
      original_filename: uploadResult.original_filename,
    });
  } catch (error: any) {
    console.error("TDS UPLOAD ERROR:", error);
    return res.status(500).json({ 
      error: "Upload failed",
      message: error.message || "Unknown error"
    });
  }
}
