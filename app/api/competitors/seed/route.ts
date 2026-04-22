import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULTS = [
  // Malaysia
  { name: "My Ballerine",    url: "https://www.myballerine.com",       country: "MY", fixOld: "myballerina" },
  { name: "Charles & Keith", url: "https://www.charleskeith.com",      country: "MY" },
  { name: "Bata Malaysia",   url: "https://www.bata.com/my",           country: "MY" },
  { name: "Vincci",          url: "https://www.padini.com/vincci",      country: "MY" },
  { name: "Nose",            url: "https://www.nose.com.my",           country: "MY" },
  // Singapore
  { name: "Pedro",           url: "https://www.pedro.com.sg",          country: "SG" },
  { name: "Schu",            url: "https://www.schu.sg",               country: "SG" },
  { name: "Steve Madden SG", url: "https://www.stevemadden.com.sg",    country: "SG" },
  { name: "Bysi",            url: "https://www.bysi.com",              country: "SG" },
  { name: "Pomelo Fashion",  url: "https://www.pomelofashion.com",     country: "SG" },
  // Philippines
  { name: "Primadonna",      url: "https://www.primadonna.com.ph",     country: "PH" },
  { name: "Parisian",        url: "https://www.parisian.com.ph",       country: "PH" },
  { name: "Mendrez",         url: "https://www.mendrez.com.ph",        country: "PH" },
  { name: "So.Fab!",         url: "https://www.sofab.com.ph",          country: "PH" },
  { name: "Shoebox PH",      url: "https://www.theshoebox.ph",         country: "PH" },
  // Indonesia
  { name: "Yongki Komaladi", url: "https://www.yongkikomaladi.com",    country: "ID" },
  { name: "Buccheri",        url: "https://www.buccheri.com",          country: "ID" },
  { name: "Colorbox",        url: "https://www.colorboxindonesia.com", country: "ID" },
  { name: "Carvil",          url: "https://www.carvil.co.id",          country: "ID" },
  { name: "Fladeo",          url: "https://www.fladeo.co.id",          country: "ID" },
  // Thailand
  { name: "Vinny",           url: "https://www.vinny.co.th",           country: "TH" },
  { name: "Monobo",          url: "https://www.monobo.co.th",          country: "TH" },
  { name: "Baoji",           url: "https://www.baoji.co.th",           country: "TH" },
  { name: "Keds Thailand",   url: "https://www.kedsthailand.com",      country: "TH" },
  { name: "Naturalizer TH",  url: "https://www.naturalizer.co.th",     country: "TH" },
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
