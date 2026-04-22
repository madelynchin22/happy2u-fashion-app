import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role     = (session.user as any).role;
  const outletId = (session.user as any).outletId;

  // Thailand users can only see their outlet's shipments
  const where = role === "warehouse" && outletId ? { destinationId: outletId } : {};

  const shipments = await prisma.shipment.findMany({
    where,
    include: {
      destination: { select: { id: true, name: true, marking: true, country: true } },
      items: { include: { po: { select: { poNumber: true } } } },
      _count: { select: { events: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(shipments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { poIds, ...data } = await req.json();
  const count = await prisma.shipment.count();
  const shipmentNumber = generateOrderNumber("SH", count + 1);

  const shipment = await prisma.shipment.create({
    data: {
      ...data,
      shipmentNumber,
      createdById: (session.user as any).id,
      items: poIds ? { create: (poIds as string[]).map((id: string) => ({ poId: id })) } : undefined,
    },
    include: { destination: true, items: true },
  });
  return NextResponse.json(shipment, { status: 201 });
}
