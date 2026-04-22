import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sample = await prisma.sampleOrder.findUnique({
    where: { id: (await params).id },
    include: {
      manufacturer: true,
      collection: true,
      parent: { select: { id: true, orderNumber: true, version: true } },
      children: { select: { id: true, orderNumber: true, version: true, status: true } },
    },
  });
  if (!sample) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sample);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const sample = await prisma.sampleOrder.update({ where: { id: (await params).id }, data });
  return NextResponse.json(sample);
}

// POST to /:id/amend creates a v2 sample
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parent = await prisma.sampleOrder.findUnique({ where: { id: (await params).id } });
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = await req.json();
  const count = await prisma.sampleOrder.count();
  const orderNumber = generateOrderNumber("SO", count + 1);

  // Copy parent fields, apply amendments
  const { id, createdAt, updatedAt, orderNumber: _on, version, parentId, ...rest } = parent as any;
  const newSample = await prisma.sampleOrder.create({
    data: {
      ...rest,
      ...data,
      orderNumber,
      version: parent.version + 1,
      parentId: parent.id,
      status: "draft",
      createdById: (session.user as any).id,
    },
  });
  return NextResponse.json(newSample, { status: 201 });
}
