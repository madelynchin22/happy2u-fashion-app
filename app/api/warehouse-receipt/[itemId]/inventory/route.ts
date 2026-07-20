import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SIZES = [35, 36, 37, 38, 39, 40, 41, 42] as const;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const itemId = (await params).itemId;

  const receiptItem = await prisma.outletReceiptItem.findUnique({
    where: { id: itemId },
    include: { delivery: { include: { outlet: true } } },
  });
  if (!receiptItem) return NextResponse.json({ error: "Receipt item not found" }, { status: 404 });
  if (!receiptItem.delivery.outlet.isWarehouse) {
    return NextResponse.json({ error: "This is not a warehouse delivery" }, { status: 400 });
  }
  if (receiptItem.postedToInventory) {
    return NextResponse.json({ error: "Already added to inventory" }, { status: 400 });
  }
  if ((receiptItem.defectQty ?? 0) > 0 && !receiptItem.defectResolution) {
    return NextResponse.json({ error: "Resolve the defect before adding to inventory" }, { status: 400 });
  }

  const hasSizeData = SIZES.some(sz => (receiptItem as any)[`receivedQty${sz}`] != null);
  if (!hasSizeData) {
    return NextResponse.json({ error: "Enter received quantities per size before adding to inventory" }, { status: 400 });
  }

  const poItem = await prisma.purchaseOrderItem.findUnique({ where: { id: receiptItem.poItemId } });
  if (!poItem?.h2uSku) {
    return NextResponse.json({ error: "This PO item has no SKU to match against Product Library" }, { status: 400 });
  }

  const lib = await prisma.productLibrary.findFirst({ where: { h2uSku: poItem.h2uSku } });
  if (!lib) {
    return NextResponse.json(
      { error: `No matching Product Library entry for SKU ${poItem.h2uSku} — add it to Product Library first.` },
      { status: 400 }
    );
  }

  const good: Record<number, number> = {};
  let totalGood = 0;
  for (const sz of SIZES) {
    const received = (receiptItem as any)[`receivedQty${sz}`] ?? 0;
    const defect    = (receiptItem as any)[`defectQty${sz}`]   ?? 0;
    const g = Math.max(0, received - defect);
    good[sz] = g;
    totalGood += g;
  }

  const outletId = receiptItem.delivery.outletId;
  const createData: Record<string, any> = { productLibraryId: lib.id, outletId, totalQty: totalGood };
  const updateData: Record<string, any> = { totalQty: { increment: totalGood } };
  for (const sz of SIZES) {
    createData[`qty${sz}`] = good[sz];
    updateData[`qty${sz}`] = { increment: good[sz] };
  }

  await prisma.locationInventory.upsert({
    where: { productLibraryId_outletId: { productLibraryId: lib.id, outletId } },
    create: createData,
    update: updateData,
  });

  const updated = await prisma.outletReceiptItem.update({
    where: { id: itemId },
    data: { postedToInventory: true, postedAt: new Date() },
  });

  return NextResponse.json({ ok: true, postedQty: totalGood, receiptItem: updated });
}
