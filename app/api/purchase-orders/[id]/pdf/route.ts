import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { PurchaseOrderPDF } from "@/lib/pdf/purchase-order";
import { join } from "path";
import sharp from "sharp";
import React from "react";

async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const absPath = url.startsWith("/uploads/")
      ? join(process.cwd(), "public", url)
      : url;
    const jpegBuf = await sharp(absPath).jpeg({ quality: 85 }).toBuffer();
    return `data:image/jpeg;base64,${jpegBuf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const poRaw = await prisma.purchaseOrder.findUnique({
    where: { id: (await params).id },
    include: { manufacturer: true, items: true },
  });
  if (!poRaw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch sample order + per-colour ProductLibrary photos + product name
  let mainPhotoUri: string | null = null;
  let libProductName: string | null = null;
  const colorPhotoMap = new Map<string, string>();   // colorNameLower -> dataUri
  const mainSkuMap    = new Map<string, string>();   // colorNameLower -> mainSku
  const colorCodeMap  = new Map<string, string>();   // colorNameLower -> colorCode

  if (poRaw.sampleOrderId) {
    const sr = await prisma.sampleOrder.findFirst({
      where: { orderNumber: poRaw.sampleOrderId },
      select: { id: true, photoSideUrl: true, photoFrontUrl: true },
    });
    if (sr) {
      mainPhotoUri = await toDataUri(sr.photoSideUrl ?? sr.photoFrontUrl ?? null);

      // Per-colour photos + product name + mainSku from ProductLibrary
      const libs = await prisma.productLibrary.findMany({
        where: { sampleOrderId: sr.id },
        select: { colorName: true, shoePhotoUrl: true, productName: true, mainSku: true, colorCode: true },
      });
      for (const lib of libs) {
        if (!libProductName && lib.productName) libProductName = lib.productName;
        if (lib.colorName && lib.mainSku)    mainSkuMap.set(lib.colorName.toLowerCase(), lib.mainSku);
        if (lib.colorName && lib.colorCode)  colorCodeMap.set(lib.colorName.toLowerCase(), lib.colorCode);
      }
      await Promise.all(libs.map(async lib => {
        if (!lib.colorName || !lib.shoePhotoUrl) return;
        const uri = await toDataUri(lib.shoePhotoUrl);
        if (uri) colorPhotoMap.set(lib.colorName.toLowerCase(), uri);
      }));
    }
  }

  const po = {
    ...poRaw,
    photoUrl: mainPhotoUri,
    libProductName,
    items: await Promise.all((poRaw.items ?? []).map(async (item: any) => {
      const colorKey  = item.colorName?.toLowerCase() ?? "";
      const colourUri = colorKey ? colorPhotoMap.get(colorKey) ?? null : null;
      const mainSku   = (colorKey ? mainSkuMap.get(colorKey)   : null) ?? item.mainSku   ?? null;
      const colorCode = (colorKey ? colorCodeMap.get(colorKey) : null) ?? item.colorCode ?? null;
      return { ...item, photoUrl: colourUri ?? mainPhotoUri, mainSku, colorCode };
    })),
  };

  const buffer = await renderToBuffer(React.createElement(PurchaseOrderPDF, { po }) as any);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${po.poNumber}.pdf"`,
    },
  });
}
