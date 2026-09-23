import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncPoShipmentState } from "@/lib/po-shipment-sync";

// Records one shipment event covering every given colour (PO item) at once —
// the supplier ships the whole SKU together, so this creates one
// ItemShipmentBatch per colour (each still attributed to its own item, since
// PO status / outlet delivery sync / payment tracking all key off per-item
// batches), tagged with a shared batchGroup id so the UI can present and edit
// them as a single row.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const poId = (await params).id;
  const raw = await req.json();
  const itemIds: string[] = Array.isArray(raw.itemIds) ? raw.itemIds.filter((x: any) => typeof x === "string") : [];
  if (itemIds.length === 0) return NextResponse.json({ error: "No item IDs provided" }, { status: 400 });

  const items = await prisma.purchaseOrderItem.findMany({
    where: { id: { in: itemIds }, poId },
    select: { id: true, totalPairs: true, shipmentBatches: { select: { pairs: true } } },
  });
  if (items.length === 0) return NextResponse.json({ error: "No matching items on this PO" }, { status: 404 });

  const groupId = randomUUID();
  const toCreate = items
    .map(item => ({
      poItemId: item.id,
      pairs: Math.max(0, item.totalPairs - item.shipmentBatches.reduce((s, b) => s + b.pairs, 0)),
      batchGroup: groupId,
    }))
    .filter(d => d.pairs > 0);

  if (toCreate.length === 0) {
    return NextResponse.json({ error: "Every selected colour has already been fully shipped" }, { status: 400 });
  }

  await prisma.itemShipmentBatch.createMany({ data: toCreate });
  await syncPoShipmentState(poId, (session.user as any).id);

  return NextResponse.json({ groupId }, { status: 201 });
}
