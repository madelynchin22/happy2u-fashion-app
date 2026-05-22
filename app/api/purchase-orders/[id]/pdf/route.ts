import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { PurchaseOrderPDF } from "@/lib/pdf/purchase-order-v2";
import { join } from "path";
import sharp from "sharp";
import React from "react";

async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  // Already a data URL — return as-is (base64-encoded uploads)
  if (url.startsWith("data:")) return url;
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

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const poRaw = await prisma.purchaseOrder.findUnique({
    where: { id: (await params).id },
    include: { manufacturer: true, items: { orderBy: { id: "asc" } } },
  });
  if (!poRaw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Sample order photos + per-colour ProductLibrary data ──
  let mainPhotoUri: string | null = null;
  let libProductName: string | null = null;
  const colorPhotoMap = new Map<string, string>();
  const mainSkuMap    = new Map<string, string>();
  const colorCodeMap  = new Map<string, string>();

  if (poRaw.sampleOrderId) {
    const sr = await prisma.sampleOrder.findFirst({
      where: { orderNumber: poRaw.sampleOrderId },
      select: { id: true, photoSideUrl: true, photoFrontUrl: true },
    });
    if (sr) {
      mainPhotoUri = await toDataUri(sr.photoSideUrl ?? sr.photoFrontUrl ?? null);

      const libs = await prisma.productLibrary.findMany({
        where: { sampleOrderId: sr.id },
        select: { colorName: true, shoePhotoUrl: true, productName: true, mainSku: true, colorCode: true },
      });
      for (const lib of libs) {
        if (!libProductName && lib.productName) libProductName = lib.productName;
        if (lib.colorName && lib.mainSku)   mainSkuMap.set(lib.colorName.toLowerCase(), lib.mainSku);
        if (lib.colorName && lib.colorCode) colorCodeMap.set(lib.colorName.toLowerCase(), lib.colorCode);
      }
      await Promise.all(libs.map(async lib => {
        if (!lib.colorName || !lib.shoePhotoUrl) return;
        const uri = await toDataUri(lib.shoePhotoUrl);
        if (uri) colorPhotoMap.set(lib.colorName.toLowerCase(), uri);
      }));
    }
  }

  // ── Vendor assets (shoe box + logo) by Shopify brand ──
  // Brand comes from ProductLibrary.brand (synced from Shopify product.vendor field)
  const rawItems: any[] = poRaw.items ?? [];

  // For items without a brand, look it up from ProductLibrary via h2uSku
  const skusNeedingBrand = rawItems.filter(i => !i.brand && i.h2uSku).map(i => i.h2uSku as string);
  const libBrands = skusNeedingBrand.length
    ? await prisma.productLibrary.findMany({
        where: { h2uSku: { in: skusNeedingBrand } },
        select: { h2uSku: true, brand: true },
      })
    : [];
  const h2uToBrand = new Map(libBrands.map((l: any) => [l.h2uSku, l.brand]));

  const brandSet = new Set<string>();
  for (const item of rawItems) {
    const brand = item.brand ?? (item.h2uSku ? h2uToBrand.get(item.h2uSku) : null);
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

  // ── Build enriched PO ──
  const po = {
    ...poRaw,
    photoUrl: mainPhotoUri,
    libProductName,
    items: await Promise.all(rawItems.map(async (item: any) => {
      const colorKey  = item.colorName?.toLowerCase() ?? "";
      const colourUri = colorKey ? colorPhotoMap.get(colorKey) ?? null : null;
      const mainSku   = (colorKey ? mainSkuMap.get(colorKey)   : null) ?? item.mainSku   ?? null;
      const colorCode = (colorKey ? colorCodeMap.get(colorKey) : null) ?? item.colorCode ?? null;
      const brand     = item.brand ?? (item.h2uSku ? h2uToBrand.get(item.h2uSku) : null) ?? null;
      const assets    = brand ? vendorUriMap.get(brand) : null;
      return {
        ...item,
        photoUrl:      colourUri ?? mainPhotoUri,
        mainSku,
        colorCode,
        brand,
        boxDesignUri:  assets?.boxUri  ?? null,
        logoDesignUri: assets?.logoUri ?? null,
      };
    })),
  };

  // Sort items so same-model colours are always adjacent (fixes grouping for any DB order)
  (po.items as any[]).sort((a: any, b: any) => {
    const ka = (a.h2uSku ?? "").replace(/[A-Z]+$/, "");
    const kb = (b.h2uSku ?? "").replace(/[A-Z]+$/, "");
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const buffer = await renderToBuffer(React.createElement(PurchaseOrderPDF, { po }) as any);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${po.poNumber}.pdf"`,
    },
  });
}
