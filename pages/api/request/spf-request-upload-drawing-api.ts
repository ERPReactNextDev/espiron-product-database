import type { NextApiRequest, NextApiResponse } from "next";
import cloudinary from "@/lib/cloudinary";
import formidable, { File } from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({
      multiples: false,
      keepExtensions: true,
    });

    const { files } = await new Promise<{ files: formidable.Files }>((resolve, reject) => {
      form.parse(req, (err, _fields, parsedFiles) => {
        if (err) reject(err);
        resolve({ files: parsedFiles });
      });
    });

    const uploadedFile = files.file as File | File[] | undefined;

    if (!uploadedFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = Array.isArray(uploadedFile) ? uploadedFile[0] : uploadedFile;

    const uploadResult = await cloudinary.uploader.upload(file.filepath, {
      folder: "spf-drawings",
      resource_type: "image",
      use_filename: true,
      unique_filename: true,
      overwrite: true,
    });

    fs.unlinkSync(file.filepath);

    return res.status(200).json({
      secure_url: uploadResult.secure_url,
      public_id: uploadResult.public_id,
      resource_type: uploadResult.resource_type,
      original_filename: uploadResult.original_filename,
    });
  } catch (error: any) {
    console.error("DRAWING UPLOAD ERROR:", error);
    return res.status(500).json({
      error: "Upload failed",
      message: error.message || "Unknown error",
    });
  }
}
