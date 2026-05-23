import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET — list all MAY 2026 POs
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pos = await prisma.purchaseOrder.findMany({
      where: { poNumber: { startsWith: "PO-2026-MAY" } },
      select: { id: true, poNumber: true },
      orderBy: { poNumber: "asc" },
    });
    return NextResponse.json({ pos });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

// POST — swap PO numbers by ID
// Body: { swaps: [{ id: "...", newPoNumber: "..." }, ...] }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { swaps } = await req.json() as {
      swaps: { id: string; newPoNumber: string }[];
    };

    if (!swaps?.length) {
      return NextResponse.json({ error: "swaps array required" }, { status: 400 });
    }

    // Verify all IDs exist
    const ids = swaps.map((s) => s.id);
    const found = await prisma.purchaseOrder.findMany({
      where: { id: { in: ids } },
      select: { id: true, poNumber: true },
    });

    const missingIds = ids.filter((id) => !found.find((f) => f.id === id));
    if (missingIds.length) {
      return NextResponse.json({ error: "IDs not found", missingIds }, { status: 404 });
    }

    const plan = swaps.map((s) => {
      const po = found.find((f) => f.id === s.id)!;
      return { id: po.id, from: po.poNumber, to: s.newPoNumber };
    });

    // Apply in transaction with temp names to avoid unique constraint conflicts
    await prisma.$transaction(async (tx) => {
      for (const p of plan) {
        await tx.purchaseOrder.update({
          where: { id: p.id },
          data: { poNumber: `TEMP-${p.id}` },
        });
      }
      for (const p of plan) {
        await tx.purchaseOrder.update({
          where: { id: p.id },
          data: { poNumber: p.to },
        });
      }
    });

    return NextResponse.json({ success: true, renamed: plan });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
