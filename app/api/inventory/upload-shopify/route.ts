import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const SIZE_RE = /^(.*?)(3[5-9]|4[0-2])$/;
const SIZES = [35, 36, 37, 38, 39, 40, 41, 42] as const;

function normalize(s: string) {
  return s?.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Fuzzy match: score how well shopify location matches an outlet
function matchScore(shopifyLoc: string, outletName: string, outletMarking: string): number {
  const sl = normalize(shopifyLoc);
  const on = normalize(outletName);
  const om = normalize(outletMarking);
  if (sl === on || sl === om) return 100;
  // count matching word tokens
  const slWords = sl.split("").filter(Boolean);
  let score = 0;
  if (on.includes(sl) || sl.includes(on.slice(0, 6))) score += 50;
  const shopWords = shopifyLoc.toLowerCase().split(/[\s,()]+/).filter(w => w.length > 2);
  const nameWords = outletName.toLowerCase().split(/[\s,()]+/).filter(w => w.length > 2);
  for (const w of shopWords) {
    if (nameWords.some(n => n.includes(w) || w.includes(n))) score += 10;
  }
  return score;
}

function bestOutletMatch(shopifyLoc: string, outlets: { id: string; name: string; marking: string }[]): string | null {
  let best = { id: "", score: 0 };
  for (const o of outlets) {
    const s = matchScore(shopifyLoc, o.name, o.marking);
    if (s > best.score) best = { id: o.id, score: s };
  }
  return best.score >= 10 ? best.id : null;
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

  if (!rows.length) return NextResponse.json({ error: "Empty spreadsheet" }, { status: 400 });

  // Detect Shopify location columns: "Inventory Available: [Location]"
  const headers = Object.keys(rows[0]);
  const locationCols = headers.filter(h => h.toLowerCase().startsWith("inventory available:"));
  if (!locationCols.length) {
    return NextResponse.json({ error: "No 'Inventory Available: ...' columns found. Make sure this is a Shopify inventory export." }, { status: 400 });
  }

  // Load products and outlets
  const products = await prisma.productLibrary.findMany({
    select: { id: true, h2uSku: true },
  });
  const outlets = await prisma.outlet.findMany({
    select: { id: true, name: true, marking: true },
  });

  const productMap = new Map<string, string>(); // normalized baseSku → productLibraryId
  for (const p of products) {
    if (p.h2uSku) productMap.set(p.h2uSku.toUpperCase(), p.id);
  }

  // Pre-match location columns to outlets
  const locColToOutletId = new Map<string, string | null>();
  const locColToName = new Map<string, string>();
  for (const col of locationCols) {
    const locName = col.replace(/^inventory available:\s*/i, "").trim();
    locColToName.set(col, locName);
    locColToOutletId.set(col, bestOutletMatch(locName, outlets));
  }

  // key: "baseSku|||outletId" → per-size qty map
  type SizeMap = Map<number, number>;
  const grouped = new Map<string, SizeMap>();

  const unmatched: { row: number; sku: string; reason: string }[] = [];
  const unmatchedLocs = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawSku: string = (row["Variant SKU"] ?? row["SKU"] ?? "").toString().trim();
    if (!rawSku) continue;

    const m = rawSku.match(SIZE_RE);
    if (!m) { unmatched.push({ row: i + 2, sku: rawSku, reason: "SKU has no size suffix (expected 35–42)" }); continue; }

    const baseSku = m[1].toUpperCase();
    const size    = parseInt(m[2]);

    if (!productMap.has(baseSku)) {
      unmatched.push({ row: i + 2, sku: rawSku, reason: `Base SKU ${baseSku} not found in Product Library` });
      continue;
    }
    const productLibraryId = productMap.get(baseSku)!;

    for (const col of locationCols) {
      const outletId = locColToOutletId.get(col);
      if (!outletId) { unmatchedLocs.add(locColToName.get(col)!); continue; }

      const qty = Math.max(0, parseInt(row[col] ?? "0") || 0);
      const key = `${productLibraryId}|||${outletId}`;
      if (!grouped.has(key)) grouped.set(key, new Map());
      const sm = grouped.get(key)!;
      sm.set(size, (sm.get(size) ?? 0) + qty);
    }
  }

  if (!commit) {
    // Preview
    const preview: any[] = [];
    for (const [key, sm] of Array.from(grouped.entries()).slice(0, 10)) {
      const [productLibraryId, outletId] = key.split("|||");
      const product = products.find(p => p.id === productLibraryId);
      const outlet  = outlets.find(o => o.id === outletId);
      const total   = Array.from(sm.values()).reduce((s, v) => s + v, 0);
      preview.push({ sku: product?.h2uSku, outlet: outlet?.name, sizes: Object.fromEntries(sm), total });
    }
    return NextResponse.json({
      rows: rows.length,
      locationColumns: locationCols.length,
      matchedCombinations: grouped.size,
      unmatchedSkus: unmatched.length,
      unmatchedLocations: Array.from(unmatchedLocs),
      preview,
      unmatched: unmatched.slice(0, 20),
    });
  }

  // Commit
  let saved = 0;
  for (const [key, sm] of grouped.entries()) {
    const [productLibraryId, outletId] = key.split("|||");
    const qtys: Record<string, number> = {};
    let total = 0;
    for (const s of SIZES) {
      const q = sm.get(s) ?? 0;
      qtys[`qty${s}`] = q;
      total += q;
    }
    await prisma.locationInventory.upsert({
      where: { productLibraryId_outletId: { productLibraryId, outletId } },
      update: { ...qtys, totalQty: total, uploadedAt: new Date() },
      create: { productLibraryId, outletId, ...qtys, totalQty: total },
    });
    saved++;
  }

  return NextResponse.json({
    saved,
    unmatchedSkus: unmatched.length,
    unmatchedLocations: Array.from(unmatchedLocs),
  });
}
