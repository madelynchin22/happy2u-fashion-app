import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id  = (await params).id;
  const raw = await req.json();

  const data: Record<string, any> = {};
  if ("status"           in raw) data.status           = raw.status;
  if ("actualArrival"    in raw) data.actualArrival    = raw.actualArrival ? new Date(raw.actualArrival) : null;
  if ("estimatedArrival" in raw) data.estimatedArrival = raw.estimatedArrival ? new Date(raw.estimatedArrival) : null;
  if ("notes"            in raw) data.notes            = raw.notes ?? null;

  const delivery = await prisma.outletDelivery.update({ where: { id }, data });

  // Upsert receipt items when provided
  if ("receiptItems" in raw && Array.isArray(raw.receiptItems)) {
    const now = new Date();
    for (const ri of raw.receiptItems) {
      if (ri.id) {
        await prisma.outletReceiptItem.update({
          where: { id: ri.id },
          data: {
            receivedQty: ri.receivedQty != null ? Number(ri.receivedQty) : undefined,
            defectQty:   ri.defectQty   != null ? Number(ri.defectQty)   : undefined,
            notes:       ri.notes       ?? undefined,
            receiptDate: now,
          },
        });
      } else {
        await prisma.outletReceiptItem.create({
          data: {
            deliveryId:  id,
            poItemId:    ri.poItemId,
            colorName:   ri.colorName   ?? null,
            orderedQty:  ri.orderedQty  ?? 0,
            receivedQty: ri.receivedQty != null ? Number(ri.receivedQty) : null,
            defectQty:   ri.defectQty   != null ? Number(ri.defectQty)   : null,
            notes:       ri.notes       ?? null,
            receiptDate: now,
          },
        });
      }
    }
    // Mark as receipt_done when all items have received qty
    const allItems = await prisma.outletReceiptItem.findMany({ where: { deliveryId: id } });
    const allDone = allItems.length > 0 && allItems.every(i => i.receivedQty != null);
    if (allDone) {
      await prisma.outletDelivery.update({ where: { id }, data: { status: "receipt_done" } });
    }
  }

  const updated = await prisma.outletDelivery.findUnique({
    where: { id },
    include: { outlet: true, receiptItems: true },
  });
  return NextResponse.json(updated);
}
