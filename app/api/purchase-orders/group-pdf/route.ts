import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { GroupPurchaseOrderPDF } from "@/lib/pdf/purchase-order-group";
import { join } from "path";
import sharp from "sharp";
import React from "react";

// Convert any /uploads/... relative path to a JPEG data URI for react-pdf
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const idsParam  = searchParams.get("ids") ?? "";
  const groupCode = searchParams.get("group") ?? "PO-GROUP";
  const supplier  = searchParams.get("supplier") ?? "";

  const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ error: "No PO IDs provided" }, { status: 400 });

  const pos = await prisma.purchaseOrder.findMany({
    where: { id: { in: ids } },
    include: { manufacturer: true, items: true },
    orderBy: { date: "asc" },
  });

  // Fetch sample orders (need id+orderNumber+photos)
  const orderNumbers = [...new Set(pos.map(p => p.sampleOrderId).filter(Boolean))] as string[];
  const samples = orderNumbers.length
    ? await prisma.sampleOrder.findMany({
        where: { orderNumber: { in: orderNumbers } },
        select: { id: true, orderNumber: true, photoSideUrl: true, photoFrontUrl: true },
      })
    : [];
  const sampleMap = new Map(samples.map(s => [s.orderNumber, s]));

  // Fetch per-colour photos + product name + mainSku from ProductLibrary
  const sampleUuids = samples.map(s => s.id);
  const libEntries = sampleUuids.length
    ? await prisma.productLibrary.findMany({
        where: { sampleOrderId: { in: sampleUuids } },
        select: { sampleOrderId: true, colorName: true, shoePhotoUrl: true, productName: true,
                  mainSku: true, colorCode: true, sampleOrder: { select: { orderNumber: true } } },
      })
    : [];

  // colorPhotoMap: orderNumber -> Map<colorNameLower, shoePhotoUrl>
  const colorPhotoMap = new Map<string, Map<string, string>>();
  // mainSkuMap: orderNumber -> Map<colorNameLower, mainSku>
  const mainSkuMap    = new Map<string, Map<string, string>>();
  // colorCodeMap: orderNumber -> Map<colorNameLower, colorCode>
  const colorCodeMap  = new Map<string, Map<string, string>>();
  // libProductNameMap: orderNumber -> productName (first found)
  const libProductNameMap = new Map<string, string>();
  for (const lib of libEntries) {
    const on = (lib.sampleOrder as any)?.orderNumber;
    if (!on) continue;
    if (!libProductNameMap.has(on) && lib.productName) libProductNameMap.set(on, lib.productName);
    if (lib.colorName && lib.shoePhotoUrl) {
      if (!colorPhotoMap.has(on)) colorPhotoMap.set(on, new Map());
      colorPhotoMap.get(on)!.set(lib.colorName.toLowerCase(), lib.shoePhotoUrl);
    }
    if (lib.colorName && lib.mainSku) {
      if (!mainSkuMap.has(on)) mainSkuMap.set(on, new Map());
      mainSkuMap.get(on)!.set(lib.colorName.toLowerCase(), lib.mainSku);
    }
    if (lib.colorName && lib.colorCode) {
      if (!colorCodeMap.has(on)) colorCodeMap.set(on, new Map());
      colorCodeMap.get(on)!.set(lib.colorName.toLowerCase(), lib.colorCode);
    }
  }

  // Build POs with photos (all conversions run in parallel)
  const posWithPhotos = await Promise.all(pos.map(async p => {
    const sr = p.sampleOrderId ? sampleMap.get(p.sampleOrderId) : null;
    const mainRaw  = sr?.photoSideUrl ?? sr?.photoFrontUrl ?? null;
    const mainUri  = await toDataUri(mainRaw);
    const colorMap = p.sampleOrderId ? colorPhotoMap.get(p.sampleOrderId) : null;

    return {
      ...p,
      photoUrl: mainUri,
      libProductName: p.sampleOrderId ? (libProductNameMap.get(p.sampleOrderId) ?? null) : null,
      items: await Promise.all((p.items ?? []).map(async (item: any) => {
        const colorKey  = item.colorName?.toLowerCase() ?? "";
        const colourRaw = colorKey ? colorMap?.get(colorKey) ?? null : null;
        const itemUri   = await toDataUri(colourRaw);
        const skuMap    = p.sampleOrderId ? mainSkuMap.get(p.sampleOrderId)   : null;
        const codeMap   = p.sampleOrderId ? colorCodeMap.get(p.sampleOrderId) : null;
        const mainSku   = (colorKey ? skuMap?.get(colorKey)  : null) ?? item.mainSku   ?? null;
        const colorCode = (colorKey ? codeMap?.get(colorKey) : null) ?? item.colorCode ?? null;
        return { ...item, photoUrl: itemUri ?? mainUri, mainSku, colorCode };
      })),
    };
  }));

  const buffer = await renderToBuffer(
    React.createElement(GroupPurchaseOrderPDF, { pos: posWithPhotos, groupCode, supplier }) as any
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${groupCode}.pdf"`,
    },
  });
}
