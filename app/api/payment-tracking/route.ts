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
        select: {
          h2uSku: true,
          colorName: true,
          lineTotal: true,
          totalPairs: true,
          shipmentBatches: {
            where: { shipDate: { not: null } },
            select: { pairs: true, shipDate: true },
            orderBy: { shipDate: "asc" },
          },
        },
      },
    },
    orderBy: { poNumber: "asc" },
  });

  const result = pos.map(({ items, ...po }) => {
    // Group shipment batches by date — each unique ship date is a separate payment
    // batch, priced by the actual pairs shipped that day (not the item's full order
    // qty), since a supplier can ship a colour across several partial shipments.
    const batchMap = new Map<string, {
      pairs: number;
      price: number;
      skus: { h2uSku: string | null; colorName: string | null; pairs: number }[];
    }>();

    for (const item of items) {
      for (const batch of item.shipmentBatches) {
        if (!batch.shipDate) continue;
        const key = batch.shipDate.toISOString();
        if (!batchMap.has(key)) batchMap.set(key, { pairs: 0, price: 0, skus: [] });
        const b = batchMap.get(key)!;
        const priceShare = item.totalPairs > 0 ? (item.lineTotal ?? 0) * (batch.pairs / item.totalPairs) : 0;
        b.pairs += batch.pairs;
        b.price += priceShare;
        b.skus.push({ h2uSku: item.h2uSku, colorName: item.colorName, pairs: batch.pairs });
      }
    }

    const batches = Array.from(batchMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([shipDate, data]) => ({ shipDate, ...data }));

    return { ...po, batches };
  }).filter(po => po.batches.length > 0);

  return NextResponse.json(result);
}
