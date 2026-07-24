import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Show any PO with real quantity routed to a warehouse outlet — whether the whole
  // PO was routed there via the "Ship to CN Warehouse" toggle, or only part of it was
  // sent there through a normal multi-outlet allocation split.
  const pos = await prisma.purchaseOrder.findMany({
    where: { outletDeliveries: { some: { outlet: { isWarehouse: true } } } },
    include: {
      manufacturer: { select: { id: true, name: true } },
      items: { orderBy: { id: "asc" } },
      outletDeliveries: {
        where: { outlet: { isWarehouse: true } },
        include: { outlet: true, receiptItems: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pos);
}
