import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncPoShipmentState } from "@/lib/po-shipment-sync";

// Every batch sharing a batchGroup was created together as one whole-SKU
// shipment event, so editing or removing the group updates every one of its
// per-colour rows at once (scoped to this PO so a groupId can't touch batches
// on another order).
async function groupBatchIds(poId: string, groupId: string): Promise<string[]> {
  const batches = await prisma.itemShipmentBatch.findMany({
    where: { batchGroup: groupId, poItem: { poId } },
    select: { id: true },
  });
  return batches.map(b => b.id);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: poId, groupId } = await params;
  const raw = await req.json();

  const data: Record<string, any> = {};
  if ("shipDate" in raw) data.shipDate = raw.shipDate ? new Date(raw.shipDate) : null;
  if ("arrivalDate" in raw) data.arrivalDate = raw.arrivalDate ? new Date(raw.arrivalDate) : null;

  const ids = await groupBatchIds(poId, groupId);
  if (ids.length === 0) return NextResponse.json({ error: "Shipment group not found" }, { status: 404 });

  await prisma.itemShipmentBatch.updateMany({ where: { id: { in: ids } }, data });
  await syncPoShipmentState(poId, (session.user as any).id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; groupId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: poId, groupId } = await params;

  const ids = await groupBatchIds(poId, groupId);
  if (ids.length === 0) return NextResponse.json({ error: "Shipment group not found" }, { status: 404 });

  await prisma.itemShipmentBatch.deleteMany({ where: { id: { in: ids } } });
  await syncPoShipmentState(poId, (session.user as any).id);

  return NextResponse.json({ ok: true });
}
