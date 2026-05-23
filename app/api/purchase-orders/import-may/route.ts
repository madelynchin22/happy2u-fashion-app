import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import * as XLSX from "xlsx";

const OUTLET_MAP: Record<string, string> = {
  "JN53-H2UWM":     "cmowg9eed0001nkbf2y1yx9d7",
  "JN55-H2UES":     "cmowg9eee0002nkbfe9eiqekp",
  "JN55-H2USA":     "cmowg9eef0003nkbfrwixoa72",
  "JN59-H2UMV":     "cmowg9eef0004nkbfwbxvom6o",
  "JN62-H2UPTJ":    "cmowg9eeg0005nkbflnslo9rr",
  "JN75-H2UABM":    "cmowg9eeg0006nkbf86bo15ax",
  "JN75-H2UABMDEP": "cmowg9eeh0007nkbfyai2gkfq",
  "JN75-H2UAK":     "cmowg9eei0008nkbfkahlsmcb",
  "JN75-H2UHQ":     "cmowg9eei0009nkbfhtoz6o1y",
  "JN81-H2UATC":    "cmowg9eej000ankbfoo8xwf0z",
  "JN81-H2UBI":     "cmowg9eej000bnkbf9yec4sdi",
};

const PO_CONFIGS = [
  { poNumber: "PO-2026-MAY01", mfrName: "Nancy",          poSheet: "MAY-01 (NANCY)",       plSheet: "MAY-01 (PL)"   },
  { poNumber: "PO-2026-MAY02", mfrName: "Anna",           poSheet: "MAY-02 (ANNA)",        plSheet: "MAY-02 (PL)"   },
  { poNumber: "PO-2026-MAY03", mfrName: "Zhang Sheng",    poSheet: "MAY-03 (ZHANG SHENG)", plSheet: "MAY-03 (PL)"   },
  { poNumber: "PO-2026-MAY04", mfrName: "Ms Sweet",       poSheet: "MAY-04 (MS SWEET)",    plSheet: "MAY-04 (PL)"   },
  { poNumber: "PO-2026-MAY05", mfrName: "Tina Real Shoes",poSheet: "MAY-05 (TINA)",        plSheet: "MAY-05 (PL)"   },
  { poNumber: "PO-2026-MAY06", mfrName: "Jojo",           poSheet: "MAY-06 (JOJO)",        plSheet: "MAY-06 (PL)"   },
  { poNumber: "PO-2026-MAY07", mfrName: "Sophia",         poSheet: "MAY-07 (SOPHIA)",      plSheet: "MAY-07 (PL)"   },
  { poNumber: "PO-2026-MAY08", mfrName: "Nancy",          poSheet: "MAY-08 (NANCY)",       plSheet: "MAY-08 (PL) "  },
  { poNumber: "PO-2026-MAY09", mfrName: "Ms Sweet",       poSheet: "MAY-09 (MS SWEET)",    plSheet: "MAY-09 (PL)"   },
];

function str(v: unknown) { return String(v ?? "").trim(); }

function excelDate(v: unknown): Date | null {
  if (!v || typeof v !== "number") return null;
  return new Date(Math.round((v - 25569) * 86400000));
}

function parsePL(wb: XLSX.WorkBook, plSheet: string): Record<string, object[]> {
  const ws = wb.Sheets[plSheet];
  if (!ws) return {};
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  const map: Record<string, object[]> = {};
  let currentSku = "";
  for (let i = 16; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const sku   = str(r[2]);
    const marking = str(r[4]);
    if (sku) currentSku = sku;
    if (!currentSku || !marking || marking === "MARKING") continue;
    const outletId = OUTLET_MAP[marking];
    if (!outletId) continue;
    const q = [r[5], r[6], r[7], r[8], r[9], r[10]].map(v => Number(v) || 0);
    const total = q.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    if (!map[currentSku]) map[currentSku] = [];
    map[currentSku].push({
      outletId,
      qty36: q[0], qty37: q[1], qty38: q[2],
      qty39: q[3], qty40: q[4], qty41: q[5],
    });
  }
  return map;
}

function parsePO(wb: XLSX.WorkBook, poSheet: string) {
  const ws = wb.Sheets[poSheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  const date = excelDate(rows[1]?.[23]);
  const totalPairs = Number(rows[2]?.[23]) || 0;
  const totalPrice = Number(rows[3]?.[23]) || 0;

  const items: object[] = [];
  for (let i = 7; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    const h2uSku = str(r[3]);
    if (!h2uSku || h2uSku === "H2U SKU") continue;
    const pairs = Number(r[21]) || 0;
    if (!pairs) continue;
    items.push({
      supplierSku:     str(r[0])  || null,
      h2uSku,
      colorName:       str(r[4])  || null,
      colorCode:       str(r[5])  || null,
      materialUpper:   str(r[6])  || null,
      materialLining:  str(r[7])  || null,
      materialMidsole: str(r[8])  || null,
      materialOutsole: str(r[9])  || null,
      hardware:        str(r[10]) || null,
      remark:          str(r[11]) || null,
      logoSpec:        str(r[12]) || null,
      deliveryDate:    excelDate(r[13]),
      qty35: 0,
      qty36: Number(r[14]) || 0,
      qty37: Number(r[15]) || 0,
      qty38: Number(r[16]) || 0,
      qty39: Number(r[17]) || 0,
      qty40: Number(r[18]) || 0,
      qty41: Number(r[19]) || 0,
      qty42: 0,
      totalPairs: pairs,
      discountPrice: Number(r[22]) || null,
      lineTotal:     Number(r[23]) || 0,
    });
  }
  return { date, totalPairs, totalPrice, items };
}

async function getMfrId(name: string): Promise<string> {
  // Try exact match first, then case-insensitive contains
  let mfr = await prisma.manufacturer.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (!mfr) {
    const keyword = name.split(" ")[0]; // e.g. "Tina" from "Tina Real Shoes"
    mfr = await prisma.manufacturer.findFirst({ where: { name: { contains: keyword, mode: "insensitive" } } });
  }
  if (!mfr) {
    mfr = await prisma.manufacturer.create({ data: { name } });
  }
  return mfr.id;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });

    // ── 1. Delete all existing MAY 2026 POs ──────────────────────────────────
    const mayPOs = await prisma.purchaseOrder.findMany({
      where: { poNumber: { startsWith: "PO-2026-MAY" } },
      select: { id: true, poNumber: true },
    });
    const ids = mayPOs.map(p => p.id);
    let deleted = 0;
    if (ids.length) {
      // Get all PO item IDs so we can delete DeliveryItem rows that reference them
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: { poId: { in: ids } },
        select: { id: true },
      });
      const itemIds = poItems.map(i => i.id);

      // Delete in dependency order (most-dependent first)
      if (itemIds.length) {
        await prisma.deliveryItem.deleteMany({ where: { poItemId: { in: itemIds } } });
        await prisma.packingListItem.deleteMany({ where: { poItemId: { in: itemIds } } });
      }
      await prisma.shipmentItem.deleteMany({ where: { poId: { in: ids } } });
      await prisma.packingList.deleteMany({ where: { poId: { in: ids } } });
      const result = await prisma.purchaseOrder.deleteMany({ where: { id: { in: ids } } });
      deleted = result.count;
    }

    // ── 2. Create each PO from Excel ─────────────────────────────────────────
    const adminUser = await prisma.user.findFirst({ select: { id: true } });
    const log: string[] = [];

    for (const cfg of PO_CONFIGS) {
      const mfrId = await getMfrId(cfg.mfrName);
      const { date, totalPairs, totalPrice, items } = parsePO(wb, cfg.poSheet);
      const allocMap = parsePL(wb, cfg.plSheet);

      if (!items.length) {
        log.push(`⚠ ${cfg.poNumber} (${cfg.mfrName}) — no items found, skipped`);
        continue;
      }

      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber:       cfg.poNumber,
          date:           date ?? new Date("2026-05-12"),
          manufacturerId: mfrId,
          createdById:    adminUser?.id ?? null,
          status:         "submitted",
          currency:       "RMB",
          totalPairs,
          totalPrice,
          items: {
            create: (items as any[]).map(item => ({
              supplierSku:     item.supplierSku,
              h2uSku:          item.h2uSku,
              colorName:       item.colorName,
              colorCode:       item.colorCode,
              materialUpper:   item.materialUpper,
              materialLining:  item.materialLining,
              materialMidsole: item.materialMidsole,
              materialOutsole: item.materialOutsole,
              hardware:        item.hardware,
              remark:          item.remark,
              logoSpec:        item.logoSpec,
              deliveryDate:    item.deliveryDate,
              qty35: item.qty35, qty36: item.qty36, qty37: item.qty37,
              qty38: item.qty38, qty39: item.qty39, qty40: item.qty40,
              qty41: item.qty41, qty42: item.qty42,
              totalPairs:    item.totalPairs,
              discountPrice: item.discountPrice,
              lineTotal:     item.lineTotal,
              outletAllocations: allocMap[item.h2uSku]
                ? JSON.stringify(allocMap[item.h2uSku])
                : null,
            })),
          },
        },
      });

      log.push(`✓ ${cfg.poNumber} (${cfg.mfrName}) — ${items.length} SKUs, ${totalPairs} pairs, ¥${totalPrice}`);
    }

    return NextResponse.json({ deleted, created: log.filter(l => l.startsWith("✓")).length, log });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
