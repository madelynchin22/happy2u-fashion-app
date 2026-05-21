import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      shipDate: { not: null },
      status: { notIn: ["draft"] },
    },
    select: {
      id: true,
      poNumber: true,
      productName: true,
      brand: true,
      status: true,
      paymentPaidDate: true,
      totalPrice: true,
      totalPairs: true,
      currency: true,
      fxRate: true,
      paymentTerms: true,
      paymentIncoterm: true,
      manufacturer: { select: { id: true, name: true } },
      items: {
        where: { itemShipDate: { not: null } },
        select: {
          h2uSku: true,
          colorName: true,
          itemShipDate: true,
          lineTotal: true,
          totalPairs: true,
        },
        orderBy: { itemShipDate: "asc" },
      },
    },
    orderBy: { poNumber: "asc" },
  });

  const result = pos.map(({ items, ...po }) => {
    // Group items by itemShipDate — each unique date is a separate payment batch
    const batchMap = new Map<string, {
      pairs: number;
      price: number;
      skus: { h2uSku: string | null; colorName: string | null; pairs: number }[];
    }>();

    for (const item of items) {
      if (!item.itemShipDate) continue;
      const key = item.itemShipDate.toISOString();
      if (!batchMap.has(key)) batchMap.set(key, { pairs: 0, price: 0, skus: [] });
      const b = batchMap.get(key)!;
      b.pairs += item.totalPairs ?? 0;
      b.price += item.lineTotal ?? 0;
      b.skus.push({ h2uSku: item.h2uSku, colorName: item.colorName, pairs: item.totalPairs ?? 0 });
    }

    const batches = Array.from(batchMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([shipDate, data]) => ({ shipDate, ...data }));

    return { ...po, batches };
  }).filter(po => po.batches.length > 0);

  return NextResponse.json(result);
}
