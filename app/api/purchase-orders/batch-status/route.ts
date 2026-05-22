import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { poNumbers, status } = await req.json();
  if (!poNumbers?.length || !status) {
    return NextResponse.json({ error: "poNumbers and status required" }, { status: 400 });
  }

  const result = await prisma.purchaseOrder.updateMany({
    where: { poNumber: { in: poNumbers } },
    data: { status },
  });

  return NextResponse.json({ updated: result.count });
}
