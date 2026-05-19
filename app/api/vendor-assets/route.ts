import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const token = await getToken({ req });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendor, assetType } = await req.json();
  if (!vendor || !assetType)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await prisma.vendorAsset.deleteMany({ where: { vendor, assetType } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assets = await prisma.vendorAsset.findMany({ orderBy: [{ vendor: "asc" }, { assetType: "asc" }] });
  return NextResponse.json(assets);
}

export async function POST(req: NextRequest) {
  const token = await getToken({ req });
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { vendor, assetType, imageUrl } = await req.json();
  if (!vendor || !assetType || !imageUrl)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    const asset = await prisma.vendorAsset.upsert({
      where: { vendor_assetType: { vendor, assetType } },
      update: { imageUrl },
      create: { vendor, assetType, imageUrl },
    });
    return NextResponse.json(asset);
  } catch (err: any) {
    console.error("[vendor-assets POST] prisma error:", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "DB error" }, { status: 500 });
  }
}
