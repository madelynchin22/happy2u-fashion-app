import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, url, country } = await req.json();
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (url !== undefined) data.url = url;
  if (country !== undefined) data.country = country;

  const competitor = await prisma.competitor.update({
    where: { id: (await params).id },
    data,
  });
  return NextResponse.json(competitor);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.competitorProduct.deleteMany({ where: { competitorId: (await params).id } });
  await prisma.competitor.delete({ where: { id: (await params).id } });
  return NextResponse.json({ ok: true });
}
