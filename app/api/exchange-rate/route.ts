import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rate = await prisma.exchangeRate.findFirst({ orderBy: { setAt: "desc" } });
  return NextResponse.json(rate ?? { rate: 0.62, fromCcy: "RMB", toCcy: "RM" });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await req.json();
  const rate = await prisma.exchangeRate.create({
    data: { ...data, setBy: (session.user as any).id },
  });
  return NextResponse.json(rate);
}
