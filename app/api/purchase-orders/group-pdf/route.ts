import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { GroupPurchaseOrderPDF } from "@/lib/pdf/purchase-order-group";
import { join } from "path";
import sharp from "sharp";
import React from "react";

// Convert a local path or external URL to a JPEG data URI for react-pdf
async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    let input: string | Buffer;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      input = Buffer.from(await res.arrayBuffer());
    } else {
      input = url.startsWith("/uploads/")
        ? join(process.cwd(), "public", url)
        : url;
    }
    const jpegBuf = await sharp(input).jpeg({ quality: 85 }).toBuffer();
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

  // Build a fallback h2uSku → photo/brand map from ProductLibrary
  const allH2uSkus = pos.flatMap(p => (p.items ?? []).map((i: any) => i.h2uSku).filter(Boolean));
  const libByH2u   = allH2uSkus.length
    ? await prisma.productLibrary.findMany({
        where: { h2uSku: { in: allH2uSkus } },
        select: { h2uSku: true, shoePhotoUrl: true, colorCode: true, brand: true },
      })
    : [];
  const h2uPhotoMap = new Map(libByH2u.map(l => [l.h2uSku, l.shoePhotoUrl]));
  const h2uCodeMap  = new Map(libByH2u.map(l => [l.h2uSku, l.colorCode]));
  const h2uBrandMap = new Map(libByH2u.map(l => [l.h2uSku, l.brand]));

  // Fetch vendor assets (shoe box + logo) for all brands found in items
  const allRawItems = pos.flatMap(p => p.items ?? []) as any[];
  const brandSet = new Set<string>();
  for (const item of allRawItems) {
    const brand = item.brand ?? (item.h2uSku ? h2uBrandMap.get(item.h2uSku) : null);
    if (brand) brandSet.add(brand);
  }
  const vendorAssets = brandSet.size
    ? await prisma.vendorAsset.findMany({ where: { vendor: { in: [...brandSet] } } })
    : [];
  const vendorUriMap = new Map<string, { boxUri: string | null; logoUri: string | null }>();
  await Promise.all(
    vendorAssets.map(async (va: any) => {
      if (!vendorUriMap.has(va.vendor)) vendorUriMap.set(va.vendor, { boxUri: null, logoUri: null });
      const uri = await toDataUri(va.imageUrl);
      const entry = vendorUriMap.get(va.vendor)!;
      if (va.assetType === "box")  entry.boxUri  = uri;
      if (va.assetType === "logo") entry.logoUri = uri;
    })
  );

  // Build POs with photos + vendor asset URIs
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
        const h2uRaw    = colourRaw
          ?? (item.h2uSku ? h2uPhotoMap.get(item.h2uSku) ?? null : null)
          ?? item.photoUrl ?? null;
        const itemUri   = await toDataUri(h2uRaw);
        const skuMap    = p.sampleOrderId ? mainSkuMap.get(p.sampleOrderId)   : null;
        const codeMap   = p.sampleOrderId ? colorCodeMap.get(p.sampleOrderId) : null;
        const mainSku   = (colorKey ? skuMap?.get(colorKey)  : null) ?? item.mainSku   ?? item.h2uSku ?? null;
        const colorCode = (colorKey ? codeMap?.get(colorKey) : null) ?? item.colorCode ?? h2uCodeMap.get(item.h2uSku ?? "") ?? null;
        const brand     = item.brand ?? (item.h2uSku ? h2uBrandMap.get(item.h2uSku) : null) ?? null;
        const assets    = brand ? vendorUriMap.get(brand) : null;
        return {
          ...item,
          photoUrl:      itemUri ?? mainUri,
          mainSku,
          colorCode,
          brand,
          boxDesignUri:  assets?.boxUri  ?? null,
          logoDesignUri: assets?.logoUri ?? null,
        };
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
