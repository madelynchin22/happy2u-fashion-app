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

  // First find them so we can confirm what matched
  const found = await prisma.purchaseOrder.findMany({
    where: { poNumber: { in: poNumbers } },
    select: { id: true, poNumber: true, status: true },
  });

  if (!found.length) {
    // Return all PO numbers so user can see what actually exists
    const all = await prisma.purchaseOrder.findMany({
      select: { poNumber: true, status: true },
      orderBy: { poNumber: "asc" },
    });
    return NextResponse.json({ updated: 0, found: [], allPoNumbers: all });
  }

  await prisma.purchaseOrder.updateMany({
    where: { id: { in: found.map(p => p.id) } },
    data: { status, date: new Date() },
  });

  return NextResponse.json({ updated: found.length, updatedPos: found.map(p => p.poNumber) });
}
