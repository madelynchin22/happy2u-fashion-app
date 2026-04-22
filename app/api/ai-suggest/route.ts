import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { suggestCollection } from "@/lib/ai/suggest-collection";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-replace")) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Please add your API key to the .env file." },
      { status: 400 }
    );
  }

  const { season, targetMarkets, additionalNotes, trendIds, limit } = await req.json();

  // Fetch data for the AI
  const [trends, bestSellers, manufacturers] = await Promise.all([
    prisma.trendItem.findMany({
      where: trendIds?.length ? { id: { in: trendIds } } : {},
      orderBy: [{ trendScore: "desc" }, { rankPosition: "asc" }],
      take: limit ?? 25,
    }),
    prisma.bestSeller.findMany({
      orderBy: [{ unitsSold: "desc" }],
      take: 20,
    }),
    prisma.manufacturer.findMany({ where: { isActive: true } }),
  ]);

  try {
    const result = await suggestCollection({
      season,
      targetMarkets: targetMarkets ?? ["MY", "TH"],
      trends,
      bestSellers,
      manufacturers,
      additionalNotes,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "AI generation failed" }, { status: 500 });
  }
}
