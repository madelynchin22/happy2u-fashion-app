import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    where: { shipToWarehouse: true },
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

  // Only POs that actually have a warehouse delivery yet (created once status leaves draft)
  const result = pos.filter(po => po.outletDeliveries.length > 0);
  return NextResponse.json(result);
}
