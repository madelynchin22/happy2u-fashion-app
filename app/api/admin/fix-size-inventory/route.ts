import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST body: { h2uSku: "S1491WUP", sizeInventory: {"36":1,"37":0,...} }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { h2uSku, sizeInventory } = await req.json();
  if (!h2uSku || !sizeInventory) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const sizes = Object.keys(sizeInventory).filter(s => (sizeInventory[s] ?? 0) >= 0);
  const total = Object.values(sizeInventory as Record<string,number>).reduce((s, v) => s + v, 0);

  const item = await prisma.productLibrary.findFirst({ where: { h2uSku } });
  if (!item) return NextResponse.json({ error: `Not found: ${h2uSku}` }, { status: 404 });

  const updated = await prisma.productLibrary.update({
    where: { id: item.id },
    data: {
      sizeInventory: JSON.stringify(sizeInventory),
      availableSizes: JSON.stringify(sizes),
      inventoryTotal: total,
    },
  });

  return NextResponse.json({ ok: true, h2uSku, total, sizes });
}
