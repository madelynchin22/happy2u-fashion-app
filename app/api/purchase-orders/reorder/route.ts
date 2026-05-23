import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/purchase-orders/reorder — list all MAY 2026 POs (current state)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pos = await prisma.purchaseOrder.findMany({
      where: { poNumber: { startsWith: "PO-2026-MAY" } },
      include: { manufacturer: true },
      orderBy: { poNumber: "asc" },
    });
    const result = pos.map((p) => ({
      id: p.id,
      poNumber: p.poNumber,
      supplier: p.manufacturer?.name ?? "",
    }));
    return NextResponse.json({ pos: result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

// POST /api/purchase-orders/reorder
// Renames PO numbers via a transaction using temp placeholders to avoid unique-constraint conflicts.
// Body: { renames: [{ from: "PO-2026-MAY01", to: "PO-2026-MAY03" }, ...], dryRun?: boolean }
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { renames, dryRun } = await req.json() as {
      renames: { from: string; to: string }[];
      dryRun?: boolean;
    };

    if (!renames?.length) {
      return NextResponse.json({ error: "renames array required" }, { status: 400 });
    }

    // Fetch all MAY POs and match in memory — avoids exact-format sensitivity issues
    const fromNumbers = renames.map((r) => r.from);
    const allMay = await prisma.purchaseOrder.findMany({
      where: { poNumber: { startsWith: "PO-2026-MAY" } },
      include: { manufacturer: true },
      orderBy: { poNumber: "asc" },
    });

    const existing = allMay.filter((p) => fromNumbers.includes(p.poNumber));

    const missing = fromNumbers.filter((n) => !existing.find((e) => e.poNumber === n));
    if (missing.length) {
      return NextResponse.json({
        error: "Some POs not found",
        missing,
        allPoNumbers: allMay.map((p) => p.poNumber),
      }, { status: 404 });
    }

    const plan = renames.map((r) => {
      const po = existing.find((e) => e.poNumber === r.from)!;
      return { id: po.id, from: r.from, to: r.to, supplier: po.manufacturer?.name ?? "" };
    });

    if (dryRun) {
      return NextResponse.json({ dryRun: true, plan });
    }

    // Apply renames in a transaction using temp placeholders
    await prisma.$transaction(async (tx) => {
      for (const p of plan) {
        await tx.purchaseOrder.update({
          where: { id: p.id },
          data: { poNumber: `TEMP-REORDER-${p.id}` },
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
