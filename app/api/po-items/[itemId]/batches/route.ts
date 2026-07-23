import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { syncPoShipmentState } from "@/lib/po-shipment-sync";

export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const itemId = (await params).itemId;
  const raw = await req.json();

  const item = await prisma.purchaseOrderItem.findUnique({ where: { id: itemId }, select: { poId: true } });
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  await prisma.itemShipmentBatch.create({
    data: {
      poItemId: itemId,
      pairs: raw.pairs != null ? Number(raw.pairs) : 0,
      shipDate: raw.shipDate ? new Date(raw.shipDate) : null,
      arrivalDate: raw.arrivalDate ? new Date(raw.arrivalDate) : null,
    },
  });

  await syncPoShipmentState(item.poId, (session.user as any).id);

  return NextResponse.json({ ok: true }, { status: 201 });
}
