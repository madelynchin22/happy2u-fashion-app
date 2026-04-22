import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    include: {
      manufacturer: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(pos);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { items, date, deliveryDate, ...poData } = await req.json();

    // Auto-generate PO number: APR-01, APR-02, etc.
    const monthAbbr = new Date().toLocaleString("en", { month: "short" }).toUpperCase();
    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const countThisMonth = await prisma.purchaseOrder.count({
      where: { createdAt: { gte: startOfMonth } },
    });
    const poNumber = `${monthAbbr}-${String(countThisMonth + 1).padStart(2, "0")}`;

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
    }));

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        brand:          poData.brand          ?? "Happy2U",
        manufacturerId: poData.manufacturerId,
        notes:          poData.notes          ?? null,
        date:           date ? new Date(date) : new Date(),
        deliveryDate:   deliveryDate ? new Date(deliveryDate) : null,
        createdById:    (session.user as any).id,
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
    return NextResponse.json({ error: err?.message ?? "Failed to create PO" }, { status: 500 });
  }
}
