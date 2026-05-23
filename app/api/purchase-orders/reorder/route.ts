import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/purchase-orders/reorder — list all MAY 2026 POs (current state)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pos = await prisma.purchaseOrder.findMany({
    where: { poNumber: { startsWith: "PO-2026-MAY" } },
    select: { id: true, poNumber: true, supplierName: true },
    orderBy: { poNumber: "asc" },
  });
  return NextResponse.json({ pos });
}

// POST /api/purchase-orders/reorder
// Renames PO numbers via a transaction using temp placeholders to avoid unique-constraint conflicts.
// Body: { renames: [{ from: "PO-2026-MAY-01", to: "PO-2026-MAY-03" }, ...], dryRun?: boolean }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { renames, dryRun } = await req.json() as {
    renames: { from: string; to: string }[];
    dryRun?: boolean;
  };

  if (!renames?.length) {
    return NextResponse.json({ error: "renames array required" }, { status: 400 });
  }

  // Verify all "from" POs exist and collect current state
  const fromNumbers = renames.map((r) => r.from);
  const existing = await prisma.purchaseOrder.findMany({
    where: { poNumber: { in: fromNumbers } },
    select: { id: true, poNumber: true, supplierName: true },
  });

  const missing = fromNumbers.filter((n) => !existing.find((e) => e.poNumber === n));
  if (missing.length) {
    const all = await prisma.purchaseOrder.findMany({
      select: { poNumber: true, supplierName: true },
      orderBy: { poNumber: "asc" },
    });
    return NextResponse.json({ error: "Some POs not found", missing, allPoNumbers: all }, { status: 404 });
  }

  const plan = renames.map((r) => {
    const po = existing.find((e) => e.poNumber === r.from)!;
    return { id: po.id, from: r.from, to: r.to, supplierName: po.supplierName };
  });

  if (dryRun) {
    return NextResponse.json({ dryRun: true, plan });
  }

  // Apply renames in a transaction using temp placeholders
  await prisma.$transaction(async (tx) => {
    // Step 1: rename all to temp names
    for (const p of plan) {
      await tx.purchaseOrder.update({
        where: { id: p.id },
        data: { poNumber: `TEMP-REORDER-${p.id}` },
      });
    }
    // Step 2: rename each to its final target
    for (const p of plan) {
      await tx.purchaseOrder.update({
        where: { id: p.id },
        data: { poNumber: p.to },
      });
    }
  });

  return NextResponse.json({ success: true, renamed: plan });
}
