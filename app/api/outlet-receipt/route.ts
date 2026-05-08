import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    where: { status: "shipped" },
    include: {
      manufacturer: { select: { id: true, name: true } },
      items: { orderBy: { id: "asc" } },
      outletDeliveries: {
        include: { outlet: true, receiptItems: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { shipDate: "desc" },
  });

  return NextResponse.json(pos);
}
