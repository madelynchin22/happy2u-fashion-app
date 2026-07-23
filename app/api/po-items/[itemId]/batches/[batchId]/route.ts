import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncPoShipmentState } from "@/lib/po-shipment-sync";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string; batchId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, batchId } = await params;
  const raw = await req.json();

  const item = await prisma.purchaseOrderItem.findUnique({ where: { id: itemId }, select: { poId: true } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const data: Record<string, any> = {};
  if ("pairs" in raw) data.pairs = Number(raw.pairs) || 0;
  if ("shipDate" in raw) data.shipDate = raw.shipDate ? new Date(raw.shipDate) : null;
  if ("arrivalDate" in raw) data.arrivalDate = raw.arrivalDate ? new Date(raw.arrivalDate) : null;

  await prisma.itemShipmentBatch.update({ where: { id: batchId }, data });
  await syncPoShipmentState(item.poId, (session.user as any).id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string; batchId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, batchId } = await params;

  const item = await prisma.purchaseOrderItem.findUnique({ where: { id: itemId }, select: { poId: true } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.itemShipmentBatch.delete({ where: { id: batchId } });
  await syncPoShipmentState(item.poId, (session.user as any).id);

  return NextResponse.json({ ok: true });
}
