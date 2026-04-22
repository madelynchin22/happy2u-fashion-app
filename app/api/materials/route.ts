import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const type   = searchParams.get("type") ?? "";

  const items = await prisma.material.findMany({
    where: {
      ...(type ? { materialType: type } : {}),
      ...(search ? { OR: [
        { name: { contains: search } },
        { colorName: { contains: search } },
        { supplier: { contains: search } },
      ]} : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await req.json();
  const item = await prisma.material.create({ data });
  return NextResponse.json(item, { status: 201 });
}
