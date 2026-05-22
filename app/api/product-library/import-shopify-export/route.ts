import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const SIZE_RE    = /^(.*?)(3[5-9]|4[0-2])$/;
const INV_PREFIX = "Inventory Available: ";
const WAREHOUSE  = "H2U Warehouse (Melaka)";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows: any[] = await req.json();
  if (!rows.length) return NextResponse.json({ error: "No rows" }, { status: 400 });

  // Detect outlet columns (all columns starting with the prefix)
  const outletCols = Object.keys(rows[0]).filter(k => k.startsWith(INV_PREFIX));

  // Group rows by base h2uSku (strip size suffix from Variant SKU)
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const sku = String(row["Variant SKU"] ?? "").trim();
    if (!sku) continue;
    const m = sku.match(SIZE_RE);
    const baseSku = (m ? m[1] : sku).toUpperCase();
    if (!grouped.has(baseSku)) grouped.set(baseSku, []);
    grouped.get(baseSku)!.push(row);
  }

  let updated = 0;
  let notFound = 0;
  const missedSkus: string[] = [];

  for (const [baseSku, skuRows] of grouped.entries()) {
    // Cost in RM (same across all sizes — take first non-null value)
    const costRaw = skuRows.find(r => r["Variant Cost"] != null)?.["Variant Cost"];
    const costRm  = costRaw != null ? Number(costRaw) : undefined;

    // Total inventory across all sizes
    const inventoryTotal = skuRows.reduce(
      (s, r) => s + (Number(r["Variant Inventory Qty"]) || 0), 0
    );

    // Warehouse qty
    const warehouseQty = skuRows.reduce(
      (s, r) => s + (Number(r[INV_PREFIX + WAREHOUSE]) || 0), 0
    );

    // Per-size total inventory: { "36": qty, "37": qty, ... }
    const sizeInventory: Record<string, number> = {};
    for (const r of skuRows) {
      const sm = String(r["Variant SKU"] ?? "").match(SIZE_RE);
      if (sm) sizeInventory[sm[2]] = Number(r["Variant Inventory Qty"]) || 0;
    }

    // Per-outlet total (sum all sizes): { "AEON ABM (DEPT)": n, ... }
    const outletInventory: Record<string, number> = {};
    for (const col of outletCols) {
      const name  = col.slice(INV_PREFIX.length);
      const total = skuRows.reduce((s, r) => s + (Number(r[col]) || 0), 0);
      outletInventory[name] = total;
    }

    const lib = await prisma.productLibrary.findFirst({ where: { h2uSku: baseSku } });
    if (!lib) {
      notFound++;
      missedSkus.push(baseSku);
      continue;
    }

    // Recalculate status from actual inventory; preserve clearance/archived/draft
    const keepStatus = ["clearance", "archived", "draft"].includes(lib.status ?? "");
    const newStatus = keepStatus ? undefined
      : inventoryTotal === 0     ? "out_of_stock"
      : inventoryTotal <= 10     ? "low_stock"
      :                            "active";

    await prisma.productLibrary.update({
      where: { id: lib.id },
      data: {
        ...(costRm !== undefined ? { costRm } : {}),
        inventoryTotal,
        warehouseQty,
        sizeInventory:   JSON.stringify(sizeInventory),
        outletInventory: JSON.stringify(outletInventory),
        ...(newStatus ? { status: newStatus } : {}),
      },
    });
    updated++;
  }

  return NextResponse.json({
    updated,
    notFound,
    total: grouped.size,
    missedSkus,
  });
}
