import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const item = await prisma.productLibrary.findUnique({
    where: { id: (await params).id },
    include: { manufacturer: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();

  // Auto-promote to "active" when a Main SKU is assigned and status is still "draft"
  if (data.mainSku && !data.status) {
    const current = await prisma.productLibrary.findUnique({
      where: { id: (await params).id },
      select: { status: true },
    });
    if (current?.status === "draft") {
      data.status = "active";
    }
  }

  const item = await prisma.productLibrary.update({
    where: { id: (await params).id }, data,
    include: { manufacturer: { select: { id: true, name: true } } },
  });

  // When a Main SKU is assigned, propagate it to any linked Purchase Orders.
  // POs store the sample order NUMBER string (e.g. "SR-2026-002"), not the UUID,
  // so we look up the orderNumber first then match.
  if (data.mainSku && item.sampleOrderId) {
    const sr = await prisma.sampleOrder.findUnique({
      where: { id: item.sampleOrderId },
      select: { orderNumber: true },
    });
    if (sr) {
      await prisma.purchaseOrder.updateMany({
        where: { sampleOrderId: sr.orderNumber },
        data:  { productName: data.mainSku },
      });
    }
  }

  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.productLibrary.delete({ where: { id: (await params).id } });
  return NextResponse.json({ ok: true });
}
