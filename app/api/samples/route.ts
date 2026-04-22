import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const samples = await prisma.sampleOrder.findMany({
    where: { ...(status ? { status } : {}), parentId: null },
    include: {
      manufacturer: { select: { id: true, name: true } },
      children: { select: { id: true, version: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(samples);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();

  // Auto-generate order number
  const count = await prisma.sampleOrder.count();
  const orderNumber = generateOrderNumber("SO", count + 1);

  const sample = await prisma.sampleOrder.create({
    data: { ...data, orderNumber, createdById: (session.user as any).id },
  });
  return NextResponse.json(sample, { status: 201 });
}
