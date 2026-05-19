import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

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

  // Fill missing item photos from ProductLibrary by h2uSku
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

  // Per-item ship-out date update (colour-level granularity)
  if ("shipItems" in raw && Array.isArray(raw.shipItems)) {
    for (const si of raw.shipItems) {
      await prisma.purchaseOrderItem.update({
        where: { id: si.id },
        data: { itemShipDate: si.itemShipDate ? new Date(si.itemShipDate) : null },
      });
    }
    // Sync PO-level shipDate and status based on how many items now have dates
    const allItems = await prisma.purchaseOrderItem.findMany({
      where: { poId: id },
      select: { itemShipDate: true, outletAllocations: true },
    });
    const dates = allItems.map(i => i.itemShipDate).filter((d): d is Date => !!d);
    const earliest = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    data.shipDate = earliest;
    if (!earliest) {
      const cur = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
      if (cur?.status === "shipped") data.status = "submitted";
    } else if (dates.length === allItems.length) {
      data.status = "shipped";
    }

    // Sync OutletDelivery statuses: in_transit only for outlets receiving shipped items
    const shippedOutletIds = new Set<string>();
    for (const item of allItems) {
      if (!item.itemShipDate || !item.outletAllocations) continue;
      try {
        const allocs: { outletId: string }[] = JSON.parse(item.outletAllocations);
        for (const a of allocs) { if (a.outletId) shippedOutletIds.add(a.outletId); }
      } catch {}
    }
    // Create records for outlets receiving shipped items (if not yet created)
    for (const outletId of shippedOutletIds) {
      const exists = await prisma.outletDelivery.findUnique({ where: { poId_outletId: { poId: id, outletId } } });
      if (!exists) {
        await prisma.outletDelivery.create({ data: { poId: id, outletId, status: "in_transit" } });
      } else if (exists.status === "pending") {
        await prisma.outletDelivery.update({ where: { poId_outletId: { poId: id, outletId } }, data: { status: "in_transit" } });
      }
    }
    // Revert outlets that no longer have any shipped items back to pending
    const existingDeliveries = await prisma.outletDelivery.findMany({ where: { poId: id }, select: { outletId: true, status: true } });
    for (const d of existingDeliveries) {
      if (!shippedOutletIds.has(d.outletId) && d.status === "in_transit") {
        await prisma.outletDelivery.update({ where: { poId_outletId: { poId: id, outletId: d.outletId } }, data: { status: "pending" } });
      }
    }

    // ── Auto-batch shipments by date ──────────────────────────────────────────
    // Each unique itemShipDate = one shared BATCH-YYYY-MM-DD shipment (cross-PO)
    const itemsWithDates = await prisma.purchaseOrderItem.findMany({
      where: { poId: id },
      select: { itemShipDate: true, totalPairs: true },
    });
    // Sum pairs per date for this PO
    const dateToPairs = new Map<string, number>();
    for (const item of itemsWithDates) {
      if (!item.itemShipDate) continue;
      const dateKey = item.itemShipDate.toISOString().split("T")[0];
      dateToPairs.set(dateKey, (dateToPairs.get(dateKey) ?? 0) + (item.totalPairs ?? 0));
    }
    // Find-or-create BATCH shipment for each date, upsert ShipmentItem
    for (const [dateKey, pairs] of dateToPairs) {
      const batchNumber = `BATCH-${dateKey}`;
      let batch = await prisma.shipment.findFirst({ where: { shipmentNumber: batchNumber } });
      if (!batch) {
        batch = await prisma.shipment.create({
          data: {
            shipmentNumber: batchNumber,
            shipDate: new Date(`${dateKey}T00:00:00.000Z`),
            status: "in_transit",
            createdById: (session.user as any).id,
          },
        });
      }
      const existingSI = await prisma.shipmentItem.findFirst({ where: { shipmentId: batch.id, poId: id } });
      if (existingSI) {
        await prisma.shipmentItem.update({ where: { id: existingSI.id }, data: { totalPairs: pairs } });
      } else {
        await prisma.shipmentItem.create({ data: { shipmentId: batch.id, poId: id, totalPairs: pairs } });
      }
    }
    // Remove this PO from any BATCH shipments whose date is no longer active
    const activeDates = new Set(dateToPairs.keys());
    const linkedBatches = await prisma.shipmentItem.findMany({
      where: { poId: id },
      include: { shipment: { select: { id: true, shipmentNumber: true } } },
    });
    for (const si of linkedBatches) {
      if (!si.shipment.shipmentNumber.startsWith("BATCH-")) continue;
      const dateKey = si.shipment.shipmentNumber.replace("BATCH-", "");
      if (activeDates.has(dateKey)) continue;
      await prisma.shipmentItem.delete({ where: { id: si.id } });
      const remaining = await prisma.shipmentItem.count({ where: { shipmentId: si.shipment.id } });
      if (remaining === 0) await prisma.shipment.delete({ where: { id: si.shipment.id } });
    }
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

  // Auto-create/update Shipment + Delivery when PO reaches submitted or shipped
  // Skip when shipItems was processed — batch sync above already handled shipments
  if (!("shipItems" in raw) && (data.status === "submitted" || data.status === "shipped")) {
    const existingItem = await prisma.shipmentItem.findFirst({
      where: { poId: id },
      include: { shipment: true },
    });

    if (existingItem) {
      // PO was already submitted — now shipped: promote shipment to in_transit
      if (data.status === "shipped" && existingItem.shipment.status === "preparing") {
        await prisma.shipment.update({
          where: { id: existingItem.shipmentId },
          data: {
            status: "in_transit",
            shipDate: po.shipDate ?? undefined,
            estimatedArrival: po.deliveryDate ?? undefined,
          },
        });
      }
    } else {
      // First time hitting submitted or shipped — create Shipment + Delivery
      const count = await prisma.shipment.count();
      const shipmentNumber = generateOrderNumber("SH", count + 1);
      const newShipment = await prisma.shipment.create({
        data: {
          shipmentNumber,
          status: data.status === "shipped" ? "in_transit" : "preparing",
          shipDate: data.status === "shipped" ? (po.shipDate ?? null) : null,
          estimatedArrival: po.deliveryDate ?? null,
          createdById: (session.user as any).id,
          items: { create: [{ poId: id, totalPairs: po.totalPairs ?? 0 }] },
        },
      });

      // Auto-create one Delivery per outlet based on outletAllocations; fall back to HQ if none
      const allPoItems = await prisma.purchaseOrderItem.findMany({ where: { poId: id } });
      const outletDeliveryMap = new Map<string, { poItemId: string; supplierSku: string | null; h2uSku: string | null; colorName: string | null; expectedQty: number }[]>();
      for (const item of allPoItems) {
        if (item.outletAllocations) {
          try {
            const allocs: Record<string, any>[] = JSON.parse(item.outletAllocations);
            for (const alloc of allocs) {
              if (!alloc.outletId) continue;
              const qty = ["qty35","qty36","qty37","qty38","qty39","qty40","qty41","qty42"]
                .reduce((s, k) => s + (Number(alloc[k]) || 0), 0);
              if (qty === 0) continue;
              if (!outletDeliveryMap.has(alloc.outletId)) outletDeliveryMap.set(alloc.outletId, []);
              outletDeliveryMap.get(alloc.outletId)!.push({
                poItemId: item.id, supplierSku: item.supplierSku ?? null,
                h2uSku: item.h2uSku ?? null, colorName: item.colorName ?? null, expectedQty: qty,
              });
            }
          } catch {}
        }
      }
      // Fall back: if no allocations at all, create one delivery for HQ with all items
      if (outletDeliveryMap.size === 0) {
        const hqOutlet = await prisma.outlet.findFirst({ where: { isHQ: true } }) ?? await prisma.outlet.findFirst();
        if (hqOutlet) {
          outletDeliveryMap.set(hqOutlet.id, allPoItems.map(item => ({
            poItemId: item.id, supplierSku: item.supplierSku ?? null,
            h2uSku: item.h2uSku ?? null, colorName: item.colorName ?? null, expectedQty: item.totalPairs ?? 0,
          })));
        }
      }
      for (const [outletId, deliveryItems] of outletDeliveryMap) {
        if (deliveryItems.length === 0) continue;
        const alreadyExists = await prisma.delivery.findFirst({ where: { shipmentId: newShipment.id, outletId } });
        if (!alreadyExists) {
          await prisma.delivery.create({
            data: {
              shipmentId: newShipment.id, outletId,
              status: "pending",
              createdById: (session.user as any).id,
              items: { create: deliveryItems.map(di => ({ ...di, receivedQty: 0 })) },
            },
          });
        }
      }
    }
  }

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
  await prisma.shipmentItem.deleteMany({ where: { poId: id } });
  await prisma.packingList.deleteMany({ where: { poId: id } });
  await prisma.deliveryItem.deleteMany({ where: { poItem: { poId: id } } });

  await prisma.purchaseOrder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
