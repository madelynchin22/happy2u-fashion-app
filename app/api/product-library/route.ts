import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";

  const items = await prisma.productLibrary.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(search ? { OR: [
        { productName: { contains: search } },
        { h2uSku: { contains: search } },
        { supplierSku: { contains: search } },
      ]} : {}),
    },
    include: { manufacturer: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const count = await prisma.productLibrary.count();
  const libNumber = generateOrderNumber("PL", count + 1);

  const item = await prisma.productLibrary.create({
    data: { ...data, libNumber },
    include: { manufacturer: { select: { id: true, name: true } } },
  });
  return NextResponse.json(item, { status: 201 });
}
