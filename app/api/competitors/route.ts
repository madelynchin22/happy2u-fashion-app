import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competitors = await prisma.competitor.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  });
  return NextResponse.json(competitors);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, url, platform, country } = await req.json();
  const competitor = await prisma.competitor.create({
    data: { name, url, platform: platform ?? "shopify", country: country ?? "MY" },
  });
  return NextResponse.json(competitor, { status: 201 });
}
