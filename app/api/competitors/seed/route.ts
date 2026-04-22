import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULTS = [
  { name: "My Ballerine",     url: "https://www.myballerine.com", country: "MY", fixOld: "myballerina" },
  { name: "Charles & Keith",  url: "https://www.charleskeith.com", country: "MY" },
  { name: "Bata Malaysia",    url: "https://www.bata.com/my",     country: "MY" },
  { name: "Vincci",           url: "https://www.padini.com/vincci", country: "MY" },
];

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results: string[] = [];

  for (const d of DEFAULTS) {
    // If there's an old wrong-URL entry, fix it
    if (d.fixOld) {
      const wrong = await prisma.competitor.findFirst({ where: { url: { contains: d.fixOld } } });
      if (wrong) {
        await prisma.competitor.update({ where: { id: wrong.id }, data: { name: d.name, url: d.url } });
        results.push(`Fixed: ${wrong.url} → ${d.url}`);
        continue;
      }
    }
    // Skip if already exists (by URL domain match)
    const domain = new URL(d.url).hostname.replace("www.", "");
    const existing = await prisma.competitor.findFirst({ where: { url: { contains: domain } } });
    if (existing) {
      results.push(`Already exists: ${d.name}`);
      continue;
    }
    await prisma.competitor.create({ data: { name: d.name, url: d.url, country: d.country, platform: "custom" } });
    results.push(`Added: ${d.name}`);
  }

  return NextResponse.json({ results });
}
