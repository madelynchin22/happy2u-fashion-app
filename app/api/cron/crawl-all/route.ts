import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Called by the instrumentation.ts daily cron (or manually with the secret)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const competitors = await prisma.competitor.findMany({ where: { isActive: true } });
  const baseUrl = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const results: any[] = [];

  for (const c of competitors) {
    try {
      const r = await fetch(`${baseUrl}/api/competitors/${c.id}/crawl`, {
        method: "POST",
        headers: { "x-cron-secret": process.env.CRON_SECRET! },
      });
      const data = await r.json().catch(() => ({}));
      results.push({ competitor: c.name, ...data });
      console.log(`[cron] crawled ${c.name}:`, data);
    } catch (err: any) {
      results.push({ competitor: c.name, error: err.message });
      console.error(`[cron] failed ${c.name}:`, err.message);
    }
    // Brief pause between crawls to avoid hammering servers
    await new Promise(r => setTimeout(r, 3000));
  }

  return NextResponse.json({ crawledAt: new Date().toISOString(), results });
}
