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
      status: { notIn: ["draft", "closed"] },
    },
    include: {
      manufacturer: { select: { id: true, name: true } },
      items: {
        where: { itemShipDate: { not: null } }, // only shipped items
        orderBy: { id: "asc" },
      },
      outletDeliveries: {
        include: { outlet: true, receiptItems: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { shipDate: "desc" },
  });

  // Filter each PO's outletDeliveries to only outlets that are receiving the shipped items
  const result = pos.map(po => {
    const shippedOutletIds = new Set<string>();
    for (const item of po.items) {
      if (!item.outletAllocations) continue;
      try {
        const allocs: { outletId: string }[] = JSON.parse(item.outletAllocations);
        for (const a of allocs) { if (a.outletId) shippedOutletIds.add(a.outletId); }
      } catch {}
    }
    return {
      ...po,
      outletDeliveries: po.outletDeliveries.filter(d => shippedOutletIds.has(d.outletId)),
    };
  }).filter(po => po.outletDeliveries.length > 0); // hide POs with no relevant outlets

  return NextResponse.json(result);
}
