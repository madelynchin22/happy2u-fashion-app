import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST body: [{ sku: "S1491", manufacturerName: "Anna" }, ...]
// sku can be mainSku (e.g. S1491) or h2uSku (e.g. S1491W)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows: { sku: string; manufacturerName: string }[] = await req.json();
  if (!Array.isArray(rows)) return NextResponse.json({ error: "Expected array" }, { status: 400 });

  const manufacturers = await prisma.manufacturer.findMany({
    where: { isActive: true },
    select: { id: true, name: true, nameEn: true },
  });

  function findMfr(name: string) {
    const n = name.trim().toLowerCase();
    return manufacturers.find(m =>
      m.name.toLowerCase() === n ||
      (m.nameEn ?? "").toLowerCase() === n ||
      m.name.toLowerCase().includes(n) ||
      n.includes(m.name.toLowerCase())
    ) ?? null;
  }

  const results = { updated: 0, skipped: 0, notFound: [] as string[], unknownMfr: [] as string[] };

  for (const row of rows) {
    const sku = (row.sku ?? "").trim().toUpperCase();
    const mfrName = (row.manufacturerName ?? "").trim();
    if (!sku || !mfrName) { results.skipped++; continue; }

    const mfr = findMfr(mfrName);
    if (!mfr) { results.unknownMfr.push(`${mfrName} (SKU: ${sku})`); results.skipped++; continue; }

    // Try as mainSku first (updates all colour variants), then as h2uSku
    const byMain = await prisma.productLibrary.updateMany({
      where: { mainSku: { equals: sku, mode: "insensitive" } },
      data: { manufacturerId: mfr.id },
    });

    if (byMain.count > 0) {
      results.updated += byMain.count;
    } else {
      const byH2u = await prisma.productLibrary.updateMany({
        where: { h2uSku: { equals: sku, mode: "insensitive" } },
        data: { manufacturerId: mfr.id },
      });
      if (byH2u.count > 0) {
        results.updated += byH2u.count;
      } else {
        results.notFound.push(sku);
        results.skipped++;
      }
    }
  }

  return NextResponse.json(results);
}
