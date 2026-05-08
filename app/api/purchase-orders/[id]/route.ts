import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: (await params).id },
    include: {
      manufacturer: { select: { id: true, name: true, leadTimeDays: true, rating: true } },
      items: { orderBy: { id: "asc" } },
      collection: true,
      createdBy: { select: { name: true } },
      outletDeliveries: {
        include: { outlet: true, receiptItems: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Attach linked sample's colorVariants + ProductLibrary product name
  let sampleColorVariants: string | null = null;
  let libProductName: string | null = null;
  if (po.sampleOrderId) {
    const sample = await prisma.sampleOrder.findFirst({
      where: { orderNumber: po.sampleOrderId },
      select: { id: true, colorVariants: true, colorName: true },
    });
    if (sample) {
      if (sample.colorVariants) {
        sampleColorVariants = sample.colorVariants;
      } else if (sample.colorName) {
        sampleColorVariants = JSON.stringify([{ name: sample.colorName, hex: "#888888" }]);
      }
      const lib = await prisma.productLibrary.findFirst({
        where: { sampleOrderId: sample.id },
        select: { productName: true },
      });
      libProductName = lib?.productName ?? null;
    }
  }

  return NextResponse.json({ ...po, sampleColorVariants, libProductName });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id  = (await params).id;
  const raw = await req.json();

  const strFields = [
    "status", "brand", "productName", "currency", "notes", "pdfUrl",
    "poType", "sampleOrderId", "parentPoNumber", "destination",
    "paymentTerms", "paymentIncoterm", "sizeCurveInsight", "allocations",
  ];
  const dateFields = ["date", "deliveryDate", "productionStartDate", "qcDate", "shipDate", "paymentPaidDate"];
  const numFields  = ["totalPairs", "totalPrice", "fxRate"];

  const data: Record<string, any> = {};
  for (const f of strFields)  if (f in raw) data[f] = raw[f] ?? null;
  for (const f of dateFields) if (f in raw) data[f] = raw[f] ? new Date(raw[f]) : null;
  for (const f of numFields)  if (f in raw) data[f] = raw[f] != null ? Number(raw[f]) : null;

  // Auto-promote to "shipped" when a ship-out date is set, unless a status change is already included
  if ("shipDate" in raw && raw.shipDate && !("status" in raw)) {
    const current = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
    if (current && !["shipped", "received", "closed"].includes(current.status ?? "")) {
      data.status = "shipped";
    }
  }

  // When status becomes "submitted" or "shipped", auto-create OutletDelivery records for each unique outlet
  if (["submitted", "shipped", "closed"].includes(data.status ?? "") || ["submitted", "shipped", "closed"].includes(raw.status ?? "")) {
    const items = await prisma.purchaseOrderItem.findMany({ where: { poId: id }, select: { id: true, outletAllocations: true } });
    const outletIds = new Set<string>();
    for (const item of items) {
      if (!item.outletAllocations) continue;
      try {
        const allocs: { outletId: string }[] = JSON.parse(item.outletAllocations);
        for (const a of allocs) { if (a.outletId) outletIds.add(a.outletId); }
      } catch {}
    }
    for (const outletId of outletIds) {
      const exists = await prisma.outletDelivery.findUnique({ where: { poId_outletId: { poId: id, outletId } } });
      if (!exists) {
        await prisma.outletDelivery.create({ data: { poId: id, outletId, status: "pending" } });
      }
    }
  }

  // When status becomes "shipped", flip all outlet deliveries to "in_transit"
  if (data.status === "shipped") {
    await prisma.outletDelivery.updateMany({
      where: { poId: id, status: "pending" },
      data: { status: "in_transit" },
    });
  }

  // Full items replacement when provided
  if ("items" in raw && Array.isArray(raw.items)) {
    const cleanItems = raw.items.map((item: any) => ({
      poId: id,
      sampleOrderId:   item.sampleOrderId   ?? null,
      supplierSku:     item.supplierSku      ?? null,
      h2uSku:          item.h2uSku           ?? null,
      colorName:       item.colorName        ?? null,
      colorCode:       item.colorCode        ?? null,
      brand:           item.brand            ?? null,
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
      outletAllocations: item.outletAllocations ?? null,
    }));

    // Delete and recreate inside a transaction so a failed insert rolls back the delete.
    // Uses $executeRaw to bypass Prisma ORM-level validation quirks on SQLite interactive
    // transactions while still enforcing real DB-level FK constraints.
    try {
      await prisma.$transaction(async (tx) => {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
        for (const ci of cleanItems) {
          const itemId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO "PurchaseOrderItem" (
              "id","poId","sampleOrderId","supplierSku","h2uSku","colorName","colorCode","brand",
              "materialUpper","materialLining","materialMidsole","materialOutsole","hardware","logoSpec",
              "remark","photoUrl","deliveryDate","qty35","qty36","qty37","qty38","qty39","qty40","qty41","qty42",
              "totalPairs","discountPrice","lineTotal","outletAllocations"
            ) VALUES (
              ${itemId},${ci.poId},${ci.sampleOrderId},${ci.supplierSku},${ci.h2uSku},
              ${ci.colorName},${ci.colorCode},${ci.brand},${ci.materialUpper},${ci.materialLining},
              ${ci.materialMidsole},${ci.materialOutsole},${ci.hardware},${ci.logoSpec},
              ${ci.remark},${ci.photoUrl},${ci.deliveryDate},${ci.qty35},${ci.qty36},${ci.qty37},${ci.qty38},
              ${ci.qty39},${ci.qty40},${ci.qty41},${ci.qty42},
              ${ci.totalPairs},${ci.discountPrice},${ci.lineTotal},${ci.outletAllocations}
            )
          `;
        }
      });
    } catch (err: any) {
      console.error("[PATCH /api/purchase-orders] items transaction failed:", err?.message ?? err);
      return NextResponse.json({ error: err?.message ?? "Failed to save items" }, { status: 500 });
    }

    data.totalPairs = cleanItems.reduce((s: number, i: any) => s + i.totalPairs, 0);
    data.totalPrice = cleanItems.reduce((s: number, i: any) => s + i.lineTotal,  0);
  }

  // Receipt update: patch individual items' receivedQty / defectQty without replacing all items
  if ("receiptItems" in raw && Array.isArray(raw.receiptItems)) {
    const now = new Date();
    for (const ri of raw.receiptItems) {
      await prisma.purchaseOrderItem.update({
        where: { id: ri.id },
        data: {
          receivedQty:  ri.receivedQty  != null ? Number(ri.receivedQty)  : undefined,
          defectQty:    ri.defectQty    != null ? Number(ri.defectQty)    : undefined,
          receiptNotes: ri.receiptNotes ?? undefined,
          receiptDate:  now,
        },
      });
    }
    // Auto-close the PO if requested
    if (raw.closeOnReceipt) data.status = "closed";
    // Arrival date = the day goods receipt is recorded (always overwrite)
    data.deliveryDate = now;
  }

  const po = await prisma.purchaseOrder.update({
    where: { id }, data,
    include: { manufacturer: true, items: true },
  });
  return NextResponse.json(po);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = (await params).id;
  await prisma.purchaseOrderItem.deleteMany({ where: { poId: id } });
  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
