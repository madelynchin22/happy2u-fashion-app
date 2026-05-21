import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const SIZES = [35, 36, 37, 38, 39, 40, 41, 42] as const;

function normalize(s: string) {
  return s?.toString().trim().toLowerCase();
}

function colKey(size: number) {
  return `qty${size}` as `qty${35 | 36 | 37 | 38 | 39 | 40 | 41 | 42}`;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const commit = formData.get("commit") === "true";

  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  if (rows.length === 0) return NextResponse.json({ error: "Empty spreadsheet" }, { status: 400 });

  // Load all products and outlets for matching
  const products = await prisma.productLibrary.findMany({
    select: { id: true, h2uSku: true, supplierSku: true, productName: true },
  });
  const outlets = await prisma.outlet.findMany({
    select: { id: true, name: true, marking: true },
  });

  const productMap = new Map<string, string>(); // normalized sku → id
  products.forEach((p: { id: string; h2uSku: string | null; supplierSku: string | null }) => {
    if (p.h2uSku) productMap.set(normalize(p.h2uSku), p.id);
    if (p.supplierSku) productMap.set(normalize(p.supplierSku), p.id);
  });

  const outletMap = new Map<string, string>(); // normalized name/marking → id
  outlets.forEach((o: { id: string; name: string; marking: string }) => {
    outletMap.set(normalize(o.name), o.id);
    outletMap.set(normalize(o.marking), o.id);
  });

  type MatchedRow = {
    sku: string;
    location: string;
    productLibraryId: string;
    outletId: string;
    qty35: number; qty36: number; qty37: number; qty38: number;
    qty39: number; qty40: number; qty41: number; qty42: number;
    totalQty: number;
    notes?: string;
  };

  const matched: MatchedRow[] = [];
  const unmatched: { row: number; sku: string; location: string; reason: string }[] = [];

  rows.forEach((row, i) => {
    // Support flexible header names
    const sku = normalize(row["SKU"] ?? row["Sku"] ?? row["sku"] ?? "");
    const location = normalize(
      row["Location"] ?? row["Outlet"] ?? row["location"] ?? row["outlet"] ?? ""
    );

    if (!sku) { unmatched.push({ row: i + 2, sku: "(blank)", location, reason: "SKU is empty" }); return; }
    if (!location) { unmatched.push({ row: i + 2, sku, location: "(blank)", reason: "Location is empty" }); return; }

    const productLibraryId = productMap.get(sku);
    if (!productLibraryId) { unmatched.push({ row: i + 2, sku, location, reason: "SKU not found in Product Library" }); return; }

    const outletId = outletMap.get(location);
    if (!outletId) { unmatched.push({ row: i + 2, sku, location, reason: "Location not found in system" }); return; }

    const qtys: Record<string, number> = {};
    let total = 0;
    SIZES.forEach(s => {
      const val = parseInt(
        row[`Size ${s}`] ?? row[`size ${s}`] ?? row[`EU${s}`] ?? row[`eu${s}`] ?? row[`${s}`] ?? "0"
      );
      const q = isNaN(val) ? 0 : Math.max(0, val);
      qtys[colKey(s)] = q;
      total += q;
    });

    matched.push({
      sku,
      location,
      productLibraryId,
      outletId,
      qty35: qtys.qty35, qty36: qtys.qty36, qty37: qtys.qty37, qty38: qtys.qty38,
      qty39: qtys.qty39, qty40: qtys.qty40, qty41: qtys.qty41, qty42: qtys.qty42,
      totalQty: total,
      notes: row["Notes"] ?? row["notes"] ?? undefined,
    });
  });

  if (!commit) {
    // Preview mode — return what will be imported
    return NextResponse.json({ matched: matched.length, unmatched, preview: matched.slice(0, 10) });
  }

  // Commit: upsert each row
  let saved = 0;
  for (const m of matched) {
    await prisma.locationInventory.upsert({
      where: { productLibraryId_outletId: { productLibraryId: m.productLibraryId, outletId: m.outletId } },
      update: {
        qty35: m.qty35, qty36: m.qty36, qty37: m.qty37, qty38: m.qty38,
        qty39: m.qty39, qty40: m.qty40, qty41: m.qty41, qty42: m.qty42,
        totalQty: m.totalQty, notes: m.notes ?? null, uploadedAt: new Date(),
      },
      create: {
        productLibraryId: m.productLibraryId,
        outletId: m.outletId,
        qty35: m.qty35, qty36: m.qty36, qty37: m.qty37, qty38: m.qty38,
        qty39: m.qty39, qty40: m.qty40, qty41: m.qty41, qty42: m.qty42,
        totalQty: m.totalQty, notes: m.notes ?? null,
      },
    });
    saved++;
  }

  return NextResponse.json({ saved, unmatched });
}
