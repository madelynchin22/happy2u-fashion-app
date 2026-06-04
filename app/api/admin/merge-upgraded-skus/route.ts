import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Pattern: S1491W36UP → mainSku=S1491, colorLetters=W, size=36, suffix=UP
const UPGRADED_RE = /^(S\d+)([A-Z]+)(\d{2})(UP)$/i;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.productLibrary.findMany({
    where: { mainSku: "S1491", h2uSku: { contains: "UP" } },
    orderBy: { h2uSku: "asc" },
  });

  // Group by colour code (strip size digits)
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const m = item.h2uSku?.match(UPGRADED_RE);
    if (!m) continue;
    const colorCode = m[2] + m[4]; // e.g. "WUP", "PKUP"
    if (!groups.has(colorCode)) groups.set(colorCode, []);
    groups.get(colorCode)!.push(item);
  }

  const results: { colorCode: string; newH2uSku: string; merged: number; totalQty: number }[] = [];

  for (const [colorCode, members] of groups) {
    const newH2uSku = `S1491${colorCode}`;
    const totalQty = members.reduce((s, i) => s + (i.inventoryTotal ?? 0), 0);
    const keeper = members[0];
    const toDelete = members.slice(1);

    for (const dup of toDelete) {
      await prisma.productLibrary.delete({ where: { id: dup.id } });
    }

    await prisma.productLibrary.update({
      where: { id: keeper.id },
      data: { h2uSku: newH2uSku, colorCode, inventoryTotal: totalQty },
    });

    results.push({ colorCode, newH2uSku, merged: members.length, totalQty });
  }

  return NextResponse.json({ ok: true, results });
}
