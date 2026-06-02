import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import OSS from "ali-oss";
import { randomUUID } from "crypto";

const client = new OSS({
  region: process.env.OSS_REGION!,
  bucket: process.env.OSS_BUCKET!,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
  secure: true,
});

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const mime = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const key = `products/${yyyy}/${mm}/${randomUUID()}.${extFromMime(mime)}`;

  const result = await client.put(key, buffer, { mime });

  const url = process.env.OSS_PUBLIC_BASE_URL
    ? `${process.env.OSS_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
    : result.url;

  return NextResponse.json({ url });
}
