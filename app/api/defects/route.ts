import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.outletReceiptItem.findMany({
    where: { defectQty: { gt: 0 } },
    include: {
      delivery: {
        include: {
          outlet: { select: { id: true, name: true, marking: true } },
          po: { select: { id: true, poNumber: true, productName: true, brand: true } },
        },
      },
    },
    orderBy: { receiptDate: "desc" },
  });

  return NextResponse.json(items);
}
