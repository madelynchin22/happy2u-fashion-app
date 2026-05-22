import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all items that are not clearance / archived / draft
  const items = await prisma.productLibrary.findMany({
    where: { status: { notIn: ["clearance", "archived", "draft"] } },
    select: { id: true, inventoryTotal: true, status: true },
  });

  let updated = 0;
  const updates: { id: string; status: string }[] = [];

  for (const item of items) {
    const inv = item.inventoryTotal ?? 0;
    const newStatus =
      inv === 0      ? "out_of_stock"
      : inv <= 10    ? "low_stock"
      :                "active";

    if (newStatus !== item.status) {
      updates.push({ id: item.id, status: newStatus });
    }
  }

  // Batch update in parallel
  await Promise.all(
    updates.map(u => prisma.productLibrary.update({ where: { id: u.id }, data: { status: u.status } }))
  );
  updated = updates.length;

  return NextResponse.json({ updated, total: items.length });
}
