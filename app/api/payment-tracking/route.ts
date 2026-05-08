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
      status: { in: ["shipped", "closed"] },
    },
    select: {
      id: true,
      poNumber: true,
      productName: true,
      brand: true,
      status: true,
      shipDate: true,
      paymentPaidDate: true,
      totalPrice: true,
      totalPairs: true,
      currency: true,
      fxRate: true,
      paymentTerms: true,
      paymentIncoterm: true,
      manufacturer: { select: { id: true, name: true } },
    },
    orderBy: { shipDate: "asc" },
  });

  return NextResponse.json(pos);
}
