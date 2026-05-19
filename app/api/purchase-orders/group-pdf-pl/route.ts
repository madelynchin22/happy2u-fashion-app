import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { GroupPackingListPDF } from "@/lib/pdf/packing-list-group";
import { join } from "path";
import sharp from "sharp";
import React from "react";

async function toDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    let input: string | Buffer;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      input = Buffer.from(await res.arrayBuffer());
    } else {
      input = url.startsWith("/uploads/") ? join(process.cwd(), "public", url) : url;
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

  const [pos, allOutlets] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { id: { in: ids } },
      include: { manufacturer: true, items: true },
      orderBy: { date: "asc" },
    }),
    prisma.outlet.findMany({ select: { id: true, marking: true, name: true } }),
  ]);

  const outletMap = new Map(allOutlets.map(o => [o.id, o]));

  // Fetch photos via sample orders + product library
  const orderNumbers = [...new Set(pos.map(p => p.sampleOrderId).filter(Boolean))] as string[];
  const samples = orderNumbers.length
    ? await prisma.sampleOrder.findMany({
        where: { orderNumber: { in: orderNumbers } },
        select: { id: true, orderNumber: true, photoSideUrl: true, photoFrontUrl: true },
      })
    : [];
  const sampleMap = new Map(samples.map(s => [s.orderNumber, s]));

  const sampleUuids = samples.map(s => s.id);
  const libEntries = sampleUuids.length
    ? await prisma.productLibrary.findMany({
        where: { sampleOrderId: { in: sampleUuids } },
        select: { sampleOrderId: true, colorName: true, shoePhotoUrl: true,
                  mainSku: true, colorCode: true,
                  sampleOrder: { select: { orderNumber: true } } },
      })
    : [];

  const colorPhotoMap = new Map<string, Map<string, string>>();  // orderNumber -> colorLower -> uri
  const mainSkuMap    = new Map<string, Map<string, string>>();  // orderNumber -> colorLower -> mainSku
  const colorCodeMap  = new Map<string, Map<string, string>>();  // orderNumber -> colorLower -> colorCode
  for (const lib of libEntries) {
    const on = (lib.sampleOrder as any)?.orderNumber;
    if (!on) continue;
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

  // Fallback: h2uSku → photo from ProductLibrary (for POs without sampleOrderId)
  const allH2uSkus = pos.flatMap(p => (p.items ?? []).map((i: any) => i.h2uSku).filter(Boolean));
  const libByH2u = allH2uSkus.length
    ? await prisma.productLibrary.findMany({
        where: { h2uSku: { in: allH2uSkus } },
        select: { h2uSku: true, shoePhotoUrl: true },
      })
    : [];
  const h2uPhotoMap = new Map(libByH2u.map(l => [l.h2uSku, l.shoePhotoUrl]));

  const posEnriched = await Promise.all(pos.map(async p => {
    const sr = p.sampleOrderId ? sampleMap.get(p.sampleOrderId) : null;
    const mainRaw  = sr?.photoSideUrl ?? sr?.photoFrontUrl ?? null;
    const mainUri  = await toDataUri(mainRaw);
    const colorMap = p.sampleOrderId ? colorPhotoMap.get(p.sampleOrderId) : null;

    return {
      ...p,
      items: await Promise.all((p.items ?? []).map(async (item: any) => {
        const colorKey  = item.colorName?.toLowerCase() ?? "";
        const colourRaw = colorKey ? colorMap?.get(colorKey) ?? null : null;
        const h2uRaw    = colourRaw
          ?? (item.h2uSku ? h2uPhotoMap.get(item.h2uSku) ?? null : null)
          ?? item.photoUrl ?? null;
        const itemUri   = await toDataUri(h2uRaw);
        const skuMap    = p.sampleOrderId ? mainSkuMap.get(p.sampleOrderId)   : null;
        const codeMap   = p.sampleOrderId ? colorCodeMap.get(p.sampleOrderId) : null;
        const mainSku   = (colorKey ? skuMap?.get(colorKey)  : null) ?? item.mainSku   ?? null;
        const colorCode = (colorKey ? codeMap?.get(colorKey) : null) ?? item.colorCode ?? null;

        let outletAllocations: any[] = [];
        if (item.outletAllocations) {
          try {
            outletAllocations = (JSON.parse(item.outletAllocations) as any[]).map(a => ({
              ...a,
              outlet: outletMap.get(a.outletId) ?? { marking: a.outletId, name: a.outletId },
            }));
          } catch {}
        }

        return { ...item, photoUrl: itemUri ?? mainUri, outletAllocations, mainSku, colorCode };
      })),
    };
  }));

  const buffer = await renderToBuffer(
    React.createElement(GroupPackingListPDF, { pos: posEnriched, groupCode, supplier, allOutlets }) as any
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${groupCode}-PL.pdf"`,
    },
  });
}
