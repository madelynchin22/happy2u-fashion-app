import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    include: {
      manufacturer: { select: { id: true, name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(pos);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, ...poData } = await req.json();

  const po = await prisma.purchaseOrder.create({
    data: {
      ...poData,
      createdById: (session.user as any).id,
      items: items ? { create: items } : undefined,
    },
    include: { items: true, manufacturer: true },
  });

  // Re-calculate totals
  const totalPairs = po.items.reduce((s: number, i: any) => s + (i.totalPairs ?? 0), 0);
  const totalPrice = po.items.reduce((s: number, i: any) => s + (i.lineTotal ?? 0), 0);
  await prisma.purchaseOrder.update({ where: { id: po.id }, data: { totalPairs, totalPrice } });

  return NextResponse.json({ ...po, totalPairs, totalPrice }, { status: 201 });
}
