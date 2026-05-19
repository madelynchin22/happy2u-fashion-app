import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = (await params).id;
  const product = await prisma.productLibrary.findUnique({
    where: { id },
    select: { h2uSku: true, mainSku: true, sampleOrderId: true },
  });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orConditions: object[] = [];
  if (product.h2uSku) {
    orConditions.push({ h2uSku: product.h2uSku });
  }
  // Style-level match: always include mainSku prefix to catch all colours of this style
  if (product.mainSku) {
    orConditions.push({ h2uSku: { startsWith: product.mainSku } });
  }
  if (product.sampleOrderId) {
    orConditions.push({ sampleOrderId: product.sampleOrderId });
  }

  // Strategy: match via PO.sampleOrderId = SampleOrder.orderNumber
  // ProductLibrary.sampleOrderId is a UUID; PurchaseOrder.sampleOrderId stores the orderNumber string
  const extraPoIds: string[] = [];
  if (product.sampleOrderId) {
    const sampleOrder = await prisma.sampleOrder.findUnique({
      where: { id: product.sampleOrderId },
      select: { orderNumber: true },
    });
    if (sampleOrder?.orderNumber) {
      const linkedPOs = await prisma.purchaseOrder.findMany({
        where: { sampleOrderId: sampleOrder.orderNumber },
        select: { id: true },
      });
      for (const lpo of linkedPOs) extraPoIds.push(lpo.id);
    }
  }

  const itemWhereConditions: object[] = [];
  if (orConditions.length > 0) itemWhereConditions.push({ OR: orConditions });
  if (extraPoIds.length > 0)   itemWhereConditions.push({ poId: { in: extraPoIds } });

  if (itemWhereConditions.length === 0) return NextResponse.json([]);

  const poItemsBase = await prisma.purchaseOrderItem.findMany({
    where: itemWhereConditions.length === 1 ? itemWhereConditions[0] : { OR: itemWhereConditions },
    include: {
      po: { include: { manufacturer: { select: { id: true, name: true } } } },
    },
  });

  // For POs matched via sampleOrderId chain, include ALL their items so the full order is shown
  let extraItems: typeof poItemsBase = [];
  if (extraPoIds.length > 0) {
    extraItems = await prisma.purchaseOrderItem.findMany({
      where: { poId: { in: extraPoIds } },
      include: {
        po: { include: { manufacturer: { select: { id: true, name: true } } } },
      },
    });
  }
  const seenIds = new Set(poItemsBase.map(i => i.id));
  const poItems = [...poItemsBase, ...extraItems.filter(i => !seenIds.has(i.id))];

  // Deduplicate by PO id, aggregate matching-item totals per PO
  const poMap = new Map<string, {
    id: string; poNumber: string; date: string; status: string; poType: string | null;
    manufacturer: { id: string; name: string } | null;
    totalPairs: number; totalValue: number;
    items: { h2uSku: string | null; colorName: string | null; colorCode: string | null; totalPairs: number; discountPrice: number | null }[];
  }>();

  for (const item of poItems) {
    const po = item.po;
    if (!poMap.has(po.id)) {
      poMap.set(po.id, {
        id: po.id,
        poNumber: po.poNumber,
        date: po.date as unknown as string,
        status: po.status,
        poType: po.poType ?? null,
        manufacturer: po.manufacturer ?? null,
        totalPairs: 0,
        totalValue: 0,
        items: [],
      });
    }
    const entry = poMap.get(po.id)!;
    entry.totalPairs += item.totalPairs ?? 0;
    entry.totalValue += item.lineTotal ?? 0;
    entry.items.push({
      h2uSku: item.h2uSku ?? null,
      colorName: item.colorName ?? null,
      colorCode: item.colorCode ?? null,
      totalPairs: item.totalPairs ?? 0,
      discountPrice: item.discountPrice ?? null,
    });
  }

  const results = [...poMap.values()].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return NextResponse.json(results);
}
