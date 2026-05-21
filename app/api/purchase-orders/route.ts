import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    include: {
      manufacturer: { select: { id: true, name: true, leadTimeDays: true, rating: true } },
      _count: { select: { items: true } },
      items: {
        select: { photoUrl: true, h2uSku: true, colorName: true },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { date: "desc" },
  });

  // Attach shoe photo and product name from the linked sample order (sampleOrderId stores the order number)
  const orderNumbers = [...new Set(pos.map(p => p.sampleOrderId).filter(Boolean))] as string[];
  const samples = orderNumbers.length
    ? await prisma.sampleOrder.findMany({
        where: { orderNumber: { in: orderNumbers } },
        select: { id: true, orderNumber: true, photoSideUrl: true },
      })
    : [];
  const samplePhotoMap = new Map(samples.map(s => [s.orderNumber, s.photoSideUrl]));

  // Look up ProductLibrary product name per sample order
  const sampleUuids = samples.map(s => s.id);
  const libEntries = sampleUuids.length
    ? await prisma.productLibrary.findMany({
        where: { sampleOrderId: { in: sampleUuids } },
        select: { sampleOrderId: true, productName: true },
      })
    : [];
  const libNameByUuid = new Map<string, string>();
  for (const l of libEntries) {
    if (l.sampleOrderId && !libNameByUuid.has(l.sampleOrderId)) {
      libNameByUuid.set(l.sampleOrderId, l.productName);
    }
  }
  const libProductMap = new Map(samples.map(s => [s.orderNumber, libNameByUuid.get(s.id) ?? null]));

  // Fallback: look up shoe photos from ProductLibrary by h2uSku for items without photoUrl
  const allH2uSkus = pos.flatMap(p => (p.items ?? []).map(i => i.h2uSku).filter(Boolean)) as string[];
  const libByH2u = allH2uSkus.length
    ? await prisma.productLibrary.findMany({
        where: { h2uSku: { in: allH2uSkus } },
        select: { h2uSku: true, shoePhotoUrl: true },
      })
    : [];
  const h2uPhotoMap = new Map(libByH2u.map(l => [l.h2uSku, l.shoePhotoUrl]));

  const MAIN_SKU_RE = /^(S\d{4})/i;

  const result = pos.map(p => {
    // Deduplicate items by main SKU prefix (S####), pick first photo per unique model
    const seen = new Set<string>();
    const dedupedItems: { photoUrl: string | null; h2uSku: string | null; colorName: string | null }[] = [];
    for (const item of p.items ?? []) {
      const key = item.h2uSku?.match(MAIN_SKU_RE)?.[1]?.toUpperCase() ?? item.h2uSku ?? "";
      if (!seen.has(key)) {
        seen.add(key);
        if (dedupedItems.length < 4) {
          const photo = item.photoUrl ?? (item.h2uSku ? (h2uPhotoMap.get(item.h2uSku) ?? null) : null);
          dedupedItems.push({ ...item, photoUrl: photo });
        }
      }
    }
    return {
      ...p,
      items: dedupedItems,
      photoUrl: p.sampleOrderId ? (samplePhotoMap.get(p.sampleOrderId) ?? null) : null,
      libProductName: p.sampleOrderId ? (libProductMap.get(p.sampleOrderId) ?? null) : null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { items, date, deliveryDate, ...poData } = await req.json();

    // Resolve user ID by email to avoid stale JWT issues after DB resets
    const dbUser = await prisma.user.findUnique({ where: { email: session.user!.email! } });
    const createdById = dbUser?.id ?? null;

    // Auto-generate PO number: PO-2026-MAY01 (sequential within the month)
    const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    const refDate = date ? new Date(date) : new Date();
    const year = refDate.getFullYear();
    const monthAbbr = MONTHS[refDate.getMonth()];
    const prefix = `PO-${year}-${monthAbbr}`;
    const monthCount = await prisma.purchaseOrder.count({ where: { poNumber: { startsWith: prefix } } });
    const poNumber = `${prefix}${String(monthCount + 1).padStart(2, "0")}`;

    // Sanitize items — only keep known fields
    const cleanItems = (items ?? []).map((item: any) => ({
      sampleOrderId:   item.sampleOrderId   ?? null,
      supplierSku:     item.supplierSku      ?? null,
      h2uSku:          item.h2uSku           ?? null,
      brand:           item.brand            ?? null,
      colorName:       item.colorName        ?? null,
      colorCode:       item.colorCode        ?? null,
      materialUpper:   item.materialUpper    ?? null,
      materialLining:  item.materialLining   ?? null,
      materialMidsole: item.materialMidsole  ?? null,
      materialOutsole: item.materialOutsole  ?? null,
      hardware:        item.hardware         ?? null,
      logoSpec:        item.logoSpec         ?? null,
      remark:          item.remark           ?? null,
      photoUrl:        item.photoUrl         ?? null,
      deliveryDate:    item.deliveryDate ? new Date(item.deliveryDate) : null,
      qty35:  Number(item.qty35)  || 0,
      qty36:  Number(item.qty36)  || 0,
      qty37:  Number(item.qty37)  || 0,
      qty38:  Number(item.qty38)  || 0,
      qty39:  Number(item.qty39)  || 0,
      qty40:  Number(item.qty40)  || 0,
      qty41:  Number(item.qty41)  || 0,
      qty42:  Number(item.qty42)  || 0,
      totalPairs:    Number(item.totalPairs)    || 0,
      discountPrice: item.discountPrice != null ? Number(item.discountPrice) : null,
      lineTotal:     Number(item.lineTotal)     || 0,
      outletAllocations: item.outletAllocations   ?? null,
    }));

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        brand:           poData.brand           ?? "Happy2U",
        productName:     poData.productName      ?? null,
        manufacturerId:  poData.manufacturerId,
        notes:           poData.notes            ?? null,
        poType:          poData.poType           ?? null,
        sampleOrderId:   poData.sampleOrderId    ?? null,
        parentPoNumber:  poData.parentPoNumber   ?? null,
        destination:     poData.destination      ?? null,
        paymentTerms:    poData.paymentTerms     ?? null,
        paymentIncoterm: poData.paymentIncoterm  ?? null,
        fxRate:          poData.fxRate != null ? Number(poData.fxRate) : null,
        sizeCurveInsight: poData.sizeCurveInsight ?? null,
        allocations:     poData.allocations      ?? null,
        date:            date ? new Date(date) : new Date(),
        deliveryDate:    deliveryDate ? new Date(deliveryDate) : null,
        productionStartDate: poData.productionStartDate ? new Date(poData.productionStartDate) : null,
        qcDate:          poData.qcDate  ? new Date(poData.qcDate)  : null,
        shipDate:        poData.shipDate ? new Date(poData.shipDate) : null,
        createdById,
        items: cleanItems.length > 0 ? { create: cleanItems } : undefined,
      },
      include: { items: true, manufacturer: true },
    });

    // Recalculate totals
    const totalPairs = po.items.reduce((s: number, i: any) => s + (i.totalPairs ?? 0), 0);
    const totalPrice = po.items.reduce((s: number, i: any) => s + (i.lineTotal  ?? 0), 0);
    await prisma.purchaseOrder.update({ where: { id: po.id }, data: { totalPairs, totalPrice } });

    // Auto-add to Product Library for any line item with a sampleOrderId
    for (const item of po.items as any[]) {
      if (!item.sampleOrderId) continue;
      const existing = await prisma.productLibrary.findFirst({
        where: { sampleOrderId: item.sampleOrderId },
      });
      if (existing) continue;

      const sr = await prisma.sampleOrder.findUnique({ where: { id: item.sampleOrderId } });
      if (!sr) continue;

      const libCount = await prisma.productLibrary.count();
      const libNumber = `PL-${new Date().getFullYear()}-${String(libCount + 1).padStart(3, "0")}`;
      await prisma.productLibrary.create({
        data: {
          libNumber,
          productName:     sr.productName || "Product",
          brand:           sr.brand       || null,
          colorName:       sr.colorName   || null,
          colorCode:       sr.colorCode   || null,
          materialUpper:   sr.materialUpper   || null,
          materialLining:  sr.materialLining  || null,
          materialMidsole: sr.materialMidsole || null,
          materialOutsole: sr.materialOutsole || null,
          hardware:        sr.hardware    || null,
          logoSpec:        sr.logoSpec    || null,
          heelSpec:        sr.heelSpec    || null,
          platformSpec:    sr.platformSpec || null,
          supplierSku:     sr.supplierSku  || item.supplierSku || null,
          h2uSku:          sr.h2uSku       || item.h2uSku       || null,
          manufacturerId:  sr.manufacturerId || null,
          sampleOrderId:   sr.id,
          costRmb:         sr.productCostRmb || null,
          costRm:          sr.productCostRm  || null,
        },
      });
    }

    return NextResponse.json({ ...po, totalPairs, totalPrice }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/purchase-orders error:", err);
    // Extract the last few lines of Prisma error (after the data dump) for a readable message
    const fullMsg: string = err?.message ?? "Failed to create PO";
    const lines = fullMsg.split("\n").map((l: string) => l.trim()).filter(Boolean);
    const lastLines = lines.slice(-5).join(" | ");
    return NextResponse.json({ error: lastLines || fullMsg }, { status: 500 });
  }
}
