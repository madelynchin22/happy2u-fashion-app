import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tab           = searchParams.get("tab") ?? "new";        // new | restock | all
  const competitorId  = searchParams.get("competitorId") ?? undefined;
  const search        = searchParams.get("search") ?? "";

  const where: any = {};
  if (competitorId) where.competitorId = competitorId;
  if (tab === "new")     where.isNew = true;
  if (tab === "restock") where.wasRestocked = true;
  if (search) where.name = { contains: search };

  const products = await prisma.competitorProduct.findMany({
    where,
    orderBy: tab === "restock" ? { restockedAt: "desc" } : { firstSeenAt: "desc" },
    take: 200,
    include: { competitor: { select: { name: true, url: true } } },
  });

  return NextResponse.json(products);
}
