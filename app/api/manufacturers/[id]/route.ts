import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mfr = await prisma.manufacturer.findUnique({ where: { id: (await params).id } });
  if (!mfr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mfr);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const mfr = await prisma.manufacturer.update({ where: { id: (await params).id }, data });
  return NextResponse.json(mfr);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.manufacturer.update({ where: { id: (await params).id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
