import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deliveries = await prisma.delivery.findMany({
    include: {
      outlet: { select: { id: true, name: true, marking: true } },
      shipment: { select: { shipmentNumber: true, containerNumber: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(deliveries);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const delivery = await prisma.delivery.create({
    data: { ...data, createdById: (session.user as any).id },
    include: { outlet: true, shipment: true, items: true },
  });
  return NextResponse.json(delivery, { status: 201 });
}
