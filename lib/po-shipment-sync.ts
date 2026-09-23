import { prisma } from "@/lib/db";

function itemOutletIds(item: { outletAllocations: string | null }): string[] {
  if (!item.outletAllocations) return [];
  try {
    const allocs: { outletId?: string }[] = JSON.parse(item.outletAllocations);
    return allocs.map(a => a.outletId).filter((x): x is string => !!x);
  } catch { return []; }
}

// An item is "dispatched" once every outlet it's allocated to has a batch —
// either one tagged with that specific outlet, or (for batches recorded
// before per-outlet tracking existed) a legacy batch with no outletId, which
// covered the whole colour in one go and so counts for all its outlets.
function itemFullyDispatched(item: { outletAllocations: string | null; shipmentBatches: { outletId: string | null }[] }): boolean {
  const outletIds = itemOutletIds(item);
  if (outletIds.length === 0) return item.shipmentBatches.length > 0;
  if (item.shipmentBatches.some(b => !b.outletId)) return true;
  return outletIds.every(oid => item.shipmentBatches.some(b => b.outletId === oid));
}

// Recomputes everything downstream of a PO's shipment batches: each item's
// itemShipDate (earliest batch ship date — the cheap "has this colour started
// shipping" gate used by payment-tracking/outlet-receipt), the PO's own
// shipDate/status, OutletDelivery statuses, and this PO's Shipment record
// (shown on the Shipments page). Call after any batch create/update/delete,
// and after any PATCH that could change the PO's status or item quantities.
export async function syncPoShipmentState(poId: string, createdById?: string | null) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, select: { status: true, poNumber: true } });
  if (!po) return;

  const items = await prisma.purchaseOrderItem.findMany({
    where: { poId },
    select: {
      id: true,
      totalPairs: true,
      outletAllocations: true,
      shipmentBatches: { select: { pairs: true, shipDate: true, arrivalDate: true, outletId: true } },
    },
  });

  // Keep each item's itemShipDate in sync with its earliest batch ship date.
  for (const item of items) {
    const dates = item.shipmentBatches.map(b => b.shipDate).filter((d): d is Date => !!d);
    const earliest = dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    await prisma.purchaseOrderItem.update({ where: { id: item.id }, data: { itemShipDate: earliest } });
  }

  const allDates = items.flatMap(i => i.shipmentBatches.map(b => b.shipDate)).filter((d): d is Date => !!d);
  const earliestOverall = allDates.length > 0 ? allDates.reduce((a, b) => (a < b ? a : b)) : null;
  const everyItemHasBatch = items.length > 0 && items.every(itemFullyDispatched);

  const poData: Record<string, any> = { shipDate: earliestOverall };
  if (!earliestOverall) {
    if (po.status === "shipped") poData.status = "submitted";
  } else if (everyItemHasBatch) {
    poData.status = "shipped";
  }
  await prisma.purchaseOrder.update({ where: { id: poId }, data: poData });

  // Sync OutletDelivery statuses: in_transit only for outlets that actually
  // have a batch shipping to them (or a legacy whole-colour batch, which
  // covers every one of that colour's outlets).
  const shippedOutletIds = new Set<string>();
  for (const item of items) {
    const outletIds = itemOutletIds(item);
    if (outletIds.length === 0) continue;
    const hasLegacyBatch = item.shipmentBatches.some(b => !b.outletId);
    for (const oid of outletIds) {
      if (hasLegacyBatch || item.shipmentBatches.some(b => b.outletId === oid)) shippedOutletIds.add(oid);
    }
  }
  for (const outletId of shippedOutletIds) {
    const exists = await prisma.outletDelivery.findUnique({ where: { poId_outletId: { poId, outletId } } });
    if (!exists) {
      await prisma.outletDelivery.create({ data: { poId, outletId, status: "in_transit" } });
    } else if (exists.status === "pending") {
      await prisma.outletDelivery.update({ where: { poId_outletId: { poId, outletId } }, data: { status: "in_transit" } });
    }
  }
  const existingDeliveries = await prisma.outletDelivery.findMany({ where: { poId }, select: { outletId: true, status: true } });
  for (const d of existingDeliveries) {
    if (!shippedOutletIds.has(d.outletId) && d.status === "in_transit") {
      await prisma.outletDelivery.update({ where: { poId_outletId: { poId, outletId: d.outletId } }, data: { status: "pending" } });
    }
  }

  // ── Sync this PO's own Shipment record ─────────────────────────────────────
  // A Shipment tracks the whole submitted-PO lifecycle now, not just the part
  // after shipping starts, so it can carry one of three statuses:
  //  - pending_ship_out: submitted, but no colour has a recorded ship date yet
  //  - pending_arrival:  at least one batch has shipped, but not every ordered
  //                      pair (across every colour) has an arrival date yet
  //  - completed:        every colour's full ordered quantity has arrived
  // Drafts never get a Shipment — one is removed if a PO is reverted to draft.
  const existingShipmentItem = await prisma.shipmentItem.findFirst({ where: { poId } });

  if (po.status === "draft") {
    if (existingShipmentItem) {
      await prisma.shipmentItem.delete({ where: { id: existingShipmentItem.id } });
      const remaining = await prisma.shipmentItem.count({ where: { shipmentId: existingShipmentItem.shipmentId } });
      if (remaining === 0) await prisma.shipment.delete({ where: { id: existingShipmentItem.shipmentId } });
    }
    return;
  }

  // shippedPairs reflects pairs actually recorded across all batches — not the
  // PO's full ordered total — since a supplier can ship a colour partially.
  const shippedPairs = items.reduce((s, i) => s + i.shipmentBatches.reduce((bs, b) => bs + b.pairs, 0), 0);
  const allItemsFullyArrived = items.length > 0 && items.every(item => {
    const arrivedPairs = item.shipmentBatches.filter(b => b.arrivalDate).reduce((s, b) => s + b.pairs, 0);
    return arrivedPairs >= item.totalPairs;
  });
  const derivedStatus = allDates.length === 0
    ? "pending_ship_out"
    : allItemsFullyArrived
      ? "completed"
      : "pending_arrival";

  if (existingShipmentItem) {
    await prisma.shipmentItem.update({ where: { id: existingShipmentItem.id }, data: { totalPairs: shippedPairs } });
    await prisma.shipment.update({ where: { id: existingShipmentItem.shipmentId }, data: { shipDate: earliestOverall, status: derivedStatus } });
  } else {
    await prisma.shipment.create({
      data: {
        shipmentNumber: po.poNumber,
        shipDate: earliestOverall,
        status: derivedStatus,
        createdById: createdById ?? null,
        items: { create: [{ poId, totalPairs: shippedPairs }] },
      },
    });
  }
}
