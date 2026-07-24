import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncPoShipmentState } from "@/lib/po-shipment-sync";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: (await params).id },
    include: {
      manufacturer: { select: { id: true, name: true, leadTimeDays: true, rating: true } },
      items: {
        orderBy: { id: "asc" },
        include: { shipmentBatches: { orderBy: { shipDate: "asc" } } },
      },
      collection: true,
      createdBy: { select: { name: true } },
      outletDeliveries: {
        include: { outlet: true, receiptItems: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!po) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fill missing item photos from ProductLibrary by h2uSku
  const MAIN_SKU_RE_PHOTO = /^(S\d{4})/i;
  const h2uSkusNeedingPhoto = (po.items ?? [])
    .filter((i: any) => !i.photoUrl && i.h2uSku)
    .map((i: any) => i.h2uSku as string);
  const libPhotos = h2uSkusNeedingPhoto.length
    ? await prisma.productLibrary.findMany({
        where: { h2uSku: { in: h2uSkusNeedingPhoto } },
        select: { h2uSku: true, shoePhotoUrl: true },
      })
    : [];
  const h2uPhotoMap = new Map(libPhotos.map(l => [l.h2uSku, l.shoePhotoUrl]));

  // Fallback: PO may store a truncated SKU (e.g. S1701P) while ProductLibrary has S1701PK.
  // For each still-missing SKU, try startsWith(itemSku) to find the matching color variant,
  // then fall back to startsWith(4-digit prefix) only as a last resort.
  const stillMissing = h2uSkusNeedingPhoto.filter(sku => !h2uPhotoMap.get(sku));
  for (const sku of stillMissing) {
    // Try: find a ProductLibrary entry whose h2uSku starts with this item's SKU (e.g. S1701P → S1701PK)
    const colorMatch = await prisma.productLibrary.findFirst({
      where: { h2uSku: { startsWith: sku }, shoePhotoUrl: { not: null } },
      select: { shoePhotoUrl: true },
    });
    if (colorMatch?.shoePhotoUrl) {
      h2uPhotoMap.set(sku, colorMatch.shoePhotoUrl);
      continue;
    }
    // Last resort: any variant from the same style family (S####)
    const stylePrefix = sku.match(MAIN_SKU_RE_PHOTO)?.[1];
    if (stylePrefix) {
      const styleMatch = await prisma.productLibrary.findFirst({
        where: { h2uSku: { startsWith: stylePrefix }, shoePhotoUrl: { not: null } },
        select: { shoePhotoUrl: true },
      });
      if (styleMatch?.shoePhotoUrl) h2uPhotoMap.set(sku, styleMatch.shoePhotoUrl);
    }
  }

  const enrichedItems = (po.items ?? []).map((item: any) => ({
    ...item,
    photoUrl: item.photoUrl ?? (item.h2uSku ? h2uPhotoMap.get(item.h2uSku) ?? null : null),
  }));

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
        select: { productName: true, mainSku: true },
      });
      libProductName = lib?.productName ?? null;

      let libColorVariants: string | null = null;
      if (lib?.mainSku) {
        const siblings = await prisma.productLibrary.findMany({
          where: { mainSku: lib.mainSku },
          select: { colorName: true, colorCode: true },
          orderBy: { createdAt: "asc" },
        });
        libColorVariants = JSON.stringify(
          siblings.map(s => ({ name: s.colorName ?? "", code: s.colorCode ?? "" }))
        );
      }
      return NextResponse.json({ ...po, items: enrichedItems, sampleColorVariants, libProductName, libColorVariants });
    }
  }

  return NextResponse.json({ ...po, items: enrichedItems, sampleColorVariants, libProductName, libColorVariants: null });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id  = (await params).id;
  const raw = await req.json();

  try {

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
  if ("shipToWarehouse" in raw) data.shipToWarehouse = !!raw.shipToWarehouse;

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
      id: item.id ?? null,
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

    // Update existing items in place (matched by id) and only create/delete what
    // actually changed, instead of delete-all-then-recreate. The old approach broke
    // as soon as a PO had any downstream Delivery/PackingList records — those tables
    // hold a real foreign key to a specific PurchaseOrderItem row, so deleting and
    // reinserting with a fresh id violated that constraint the moment a PO had
    // shipped far enough to have QC/delivery records.
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.purchaseOrderItem.findMany({ where: { poId: id }, select: { id: true } });
        const existingIds = new Set(existing.map(e => e.id));
        const incomingIds = new Set(cleanItems.filter((ci: any) => ci.id).map((ci: any) => ci.id));

        const removedIds = [...existingIds].filter(eid => !incomingIds.has(eid));
        if (removedIds.length > 0) {
          await tx.purchaseOrderItem.deleteMany({ where: { id: { in: removedIds } } });
        }

        for (const { id: itemId, ...fields } of cleanItems) {
          if (itemId && existingIds.has(itemId)) {
            await tx.purchaseOrderItem.update({ where: { id: itemId }, data: fields });
          } else {
            await tx.purchaseOrderItem.create({ data: fields });
          }
        }
      });
    } catch (err: any) {
      console.error("[PATCH /api/purchase-orders] items transaction failed:", err?.message ?? err);
      const isFkError = err?.code === "P2003" || /foreign key|violates|restrict/i.test(err?.message ?? "");
      return NextResponse.json({
        error: isFkError
          ? "Can't remove one of these colours — it already has linked delivery, QC, or packing-list records. Uncheck it instead of deleting the row, or ask an admin to remove those records first."
          : (err?.message ?? "Failed to save items"),
      }, { status: 500 });
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

  // Only update PO-level fields when there's something to change
  const po = Object.keys(data).length > 0
    ? await prisma.purchaseOrder.update({ where: { id }, data, include: { manufacturer: true, items: true } })
    : await prisma.purchaseOrder.findUniqueOrThrow({ where: { id }, include: { manufacturer: true, items: true } });

  // When the PO is routed via the CN warehouse for supplier QC, ensure a warehouse
  // OutletDelivery + one OutletReceiptItem per PO item exist, and best-effort stamp the
  // warehouse as each item's destination so the existing packing-list PDF (which reads
  // outletAllocations) shows the CN-H2UCNWH marking. Never overwrites an item that already
  // has an explicit retail-outlet split.
  if (po.shipToWarehouse && ["submitted", "shipped", "closed"].includes(po.status ?? "")) {
    const warehouseOutlet = await prisma.outlet.findFirst({ where: { isWarehouse: true, isActive: true } });
    if (warehouseOutlet) {
      for (const item of po.items) {
        if (item.outletAllocations) continue;
        const alloc = [{
          outletId: warehouseOutlet.id,
          qty36: item.qty36, qty37: item.qty37, qty38: item.qty38, qty39: item.qty39,
          qty40: item.qty40, qty41: item.qty41, qty42: item.qty42,
        }];
        await prisma.purchaseOrderItem.update({ where: { id: item.id }, data: { outletAllocations: JSON.stringify(alloc) } });
      }

      let warehouseDelivery = await prisma.outletDelivery.findUnique({
        where: { poId_outletId: { poId: id, outletId: warehouseOutlet.id } },
      });
      if (!warehouseDelivery) {
        warehouseDelivery = await prisma.outletDelivery.create({
          data: { poId: id, outletId: warehouseOutlet.id, status: po.status === "shipped" ? "in_transit" : "pending" },
        });
      } else if (po.status === "shipped" && warehouseDelivery.status === "pending") {
        warehouseDelivery = await prisma.outletDelivery.update({
          where: { id: warehouseDelivery.id }, data: { status: "in_transit" },
        });
      }

      const existingReceiptItems = await prisma.outletReceiptItem.findMany({
        where: { deliveryId: warehouseDelivery.id }, select: { poItemId: true },
      });
      const receiptedItemIds = new Set(existingReceiptItems.map(r => r.poItemId));
      for (const item of po.items) {
        if (receiptedItemIds.has(item.id)) continue;
        await prisma.outletReceiptItem.create({
          data: {
            deliveryId: warehouseDelivery.id,
            poItemId: item.id,
            colorName: item.colorName ?? null,
            orderedQty: item.totalPairs ?? 0,
          },
        });
      }
    }
  }

  // Keep this PO's Shipment record (pending_ship_out / pending_arrival / completed)
  // in sync with whatever changed above — status transitions, item quantities, etc.
  await syncPoShipmentState(id, (session.user as any).id);

  return NextResponse.json(po);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error("[PATCH /api/purchase-orders/:id] unhandled error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = (await params).id;

  // Delete non-cascading relations first, then let DB cascade the rest
  const shipmentItems = await prisma.shipmentItem.findMany({ where: { poId: id }, select: { shipmentId: true } });
  const shipmentIds = [...new Set(shipmentItems.map(si => si.shipmentId))];
  await prisma.shipmentItem.deleteMany({ where: { poId: id } });
  for (const shipmentId of shipmentIds) {
    const remaining = await prisma.shipmentItem.count({ where: { shipmentId } });
    if (remaining === 0) await prisma.shipment.delete({ where: { id: shipmentId } }).catch(() => {});
  }
  await prisma.packingList.deleteMany({ where: { poId: id } });
  await prisma.deliveryItem.deleteMany({ where: { poItem: { poId: id } } });

  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
