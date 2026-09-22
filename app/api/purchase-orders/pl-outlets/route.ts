import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { makeOutletResolver } from "@/lib/outlet-resolve";

// Given a set of PO ids, returns only the outlets actually referenced by those
// POs' item-level outlet allocations — so the PL outlet picker doesn't offer
// locations that have nothing to do with this order. Falls back to every
// outlet when none of the items carry allocation data (e.g. older POs that
// ship as a single, unsplit delivery).
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ error: "No PO IDs provided" }, { status: 400 });

  const [pos, allOutlets] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { id: { in: ids } },
      select: { items: { select: { outletAllocations: true } } },
    }),
    prisma.outlet.findMany({
      select: { id: true, name: true, marking: true, country: true, isHQ: true },
    }),
  ]);

  const resolveOutlet = makeOutletResolver(allOutlets);

  const involvedIds = new Set<string>();
  for (const po of pos) {
    for (const item of po.items) {
      if (!item.outletAllocations) continue;
      try {
        const allocs: { outletId: string }[] = JSON.parse(item.outletAllocations);
        for (const a of allocs) {
          const resolved = resolveOutlet(a.outletId);
          if (resolved && "isHQ" in resolved) involvedIds.add(resolved.id);
        }
      } catch {}
    }
  }

  const outlets = involvedIds.size > 0
    ? allOutlets.filter(o => involvedIds.has(o.id))
    : allOutlets; // no allocation data at all → don't over-restrict, show everything

  return NextResponse.json(outlets);
}
