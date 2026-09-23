import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncPoShipmentState } from "@/lib/po-shipment-sync";

const SIZE_KEYS = [36, 37, 38, 39, 40, 41, 42];

// Records one shipment event covering every given colour (PO item) for ONE
// destination outlet at once — the supplier ships the whole SKU together, but
// different outlets (e.g. a nearby China warehouse vs. Malaysia HQ) can have
// very different receiving timelines, so shipments are tracked per outlet.
// Creates one ItemShipmentBatch per colour, each carrying that outlet's slice
// of the colour's pairs (from its outletAllocations) and a shared batchGroup
// id so the UI can present and edit them as a single row.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const poId = (await params).id;
  const raw = await req.json();
  const itemIds: string[] = Array.isArray(raw.itemIds) ? raw.itemIds.filter((x: any) => typeof x === "string") : [];
  const outletId: string | undefined = typeof raw.outletId === "string" ? raw.outletId : undefined;
  if (itemIds.length === 0) return NextResponse.json({ error: "No item IDs provided" }, { status: 400 });
  if (!outletId) return NextResponse.json({ error: "No outlet specified" }, { status: 400 });

  const items = await prisma.purchaseOrderItem.findMany({
    where: { id: { in: itemIds }, poId },
    select: { id: true, outletAllocations: true, shipmentBatches: { select: { pairs: true, outletId: true } } },
  });
  if (items.length === 0) return NextResponse.json({ error: "No matching items on this PO" }, { status: 404 });

  const groupId = randomUUID();
  const toCreate: { poItemId: string; pairs: number; outletId: string; batchGroup: string }[] = [];

  for (const item of items) {
    if (!item.outletAllocations) continue;
    let allocs: Record<string, any>[] = [];
    try { allocs = JSON.parse(item.outletAllocations); } catch { continue; }
    const alloc = allocs.find(a => a.outletId === outletId);
    if (!alloc) continue;
    const allocatedForOutlet = SIZE_KEYS.reduce((s, sz) => s + (Number(alloc[`qty${sz}`]) || 0), 0);

    const alreadyShipped = item.shipmentBatches
      .filter(b => b.outletId === outletId)
      .reduce((s, b) => s + b.pairs, 0);

    const remaining = Math.max(0, allocatedForOutlet - alreadyShipped);
    if (remaining > 0) toCreate.push({ poItemId: item.id, pairs: remaining, outletId, batchGroup: groupId });
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ error: "This outlet has already been fully shipped for the selected colours" }, { status: 400 });
  }

  await prisma.itemShipmentBatch.createMany({ data: toCreate });
  await syncPoShipmentState(poId, (session.user as any).id);

  return NextResponse.json({ groupId }, { status: 201 });
}
