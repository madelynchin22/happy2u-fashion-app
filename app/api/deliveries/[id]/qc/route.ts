import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items } = await req.json();

  // Update each delivery item
  for (const item of items) {
    await prisma.deliveryItem.update({
      where: { id: item.id },
      data: {
        receivedQty:       item.receivedQty,
        discrepancyType:   item.discrepancyType ?? null,
        damageDescription: item.damageDescription ?? null,
        isFlagged:         item.isFlagged,
      },
    });
  }

  // Update delivery status
  const flaggedCount = items.filter((i: any) => i.isFlagged).length;
  const allOk = items.every((i: any) => i.expectedQty === i.receivedQty && !i.isFlagged);
  const status = allOk ? "complete" : flaggedCount > 0 ? "disputed" : "partial";

  await prisma.delivery.update({
    where: { id: (await params).id },
    data: { status, receivedAt: new Date() },
  });

  return NextResponse.json({ ok: true, status });
}
