import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Location mapping: Excel name → outlet marking / create info ──────────────
const LOCATION_MAP = {
  'AEON ABM (DEPT)':              { marking: 'JN75-H2UABMDEP' },
  'AEON Ayer Keroh, Melaka':      { marking: 'JN75-H2UAK' },
  'AEON Bandaraya Melaka':        { marking: 'JN75-H2UABM' },
  'AEON Bukit Indah , JB':        { marking: 'JN81-H2UBI' },
  'AEON Bukit Tinggi':            { marking: 'JN-H2UABT' },
  'AEON IOI Putrajaya':           { marking: 'JN62-H2UPTJ' },
  'AEON Mid valley':              { marking: 'JN59-H2UMV' },
  'AEON Shah Alam, Selangor':     { marking: 'JN55-H2USA' },
  'AEON Taman Maluri, KL':        { marking: 'JN-H2UATM' },
  'AEON Tebrau, JB':              { marking: 'JN81-H2UATC' },
  'AEON Wangsa Maju, KL':         { marking: 'JN53-H2UWM' },
  'Aramex':                       null, // logistics only, skip
  'Eslite Spectrum Kuala Lumpur': { marking: 'JN55-H2UES' },
  'H2U Warehouse (Melaka)':       { marking: 'JN75-H2UHQ' },
  'MISF Pavilion, KL':            null, // removed outlet, skip
  'Photoshoot':                   null, // skip
  'Pop-up Store, MyTOWN KL':      null, // removed outlet, skip
};

// Parse variant SKU → { mainSku, colorCode, size }
function parseSku(sku) {
  if (!sku) return null;
  const m = sku.match(/^([A-Z]\d+)([A-Z]+)(\d{2})$/);
  if (m) return { mainSku: m[1], colorCode: m[2], size: parseInt(m[3]) };
  return null;
}

// Map Shopify type → system category
function mapCategory(type) {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t.includes('sneaker')) return 'sneakers';
  if (t.includes('heel')) return 'heels';
  if (t.includes('flat')) return 'flats';
  if (t.includes('sandal')) return 'sandals';
  if (t.includes('boot')) return 'boots';
  if (t.includes('wedge')) return 'wedges';
  if (t.includes('bag')) return 'bags';
  if (t.includes('care') || t.includes('mist')) return 'shoe_care';
  if (t.includes('accessor')) return 'accessories';
  return null;
}

async function main() {
  console.log('Reading Excel...');
  const wb = XLSX.readFile('/Users/gwenheng/Downloads/Export_2026-05-18_102441.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`Total rows: ${rows.length}`);

  const locCols = Object.keys(rows[0]).filter(k => k.startsWith('Inventory Available:'));

  // ── Step 1: Ensure all outlets exist ────────────────────────────────────────
  console.log('\n── Step 1: Outlets ──');
  const outletByMarking = new Map();
  const existing = await prisma.outlet.findMany();
  existing.forEach(o => outletByMarking.set(o.marking, o.id));

  const locationToOutletId = new Map(); // Excel col name → outletId
  for (const col of locCols) {
    const name = col.replace('Inventory Available: ', '');
    const conf = LOCATION_MAP[name];
    if (!conf) { console.log(`  SKIP: ${name}`); continue; }
    if (conf.marking) {
      const id = outletByMarking.get(conf.marking);
      if (id) { locationToOutletId.set(name, id); console.log(`  MAPPED: ${name} → ${conf.marking}`); }
      else { console.log(`  WARN: marking ${conf.marking} not found for "${name}"`); }
    } else if (conf.create) {
      if (outletByMarking.has(conf.create.marking)) {
        locationToOutletId.set(name, outletByMarking.get(conf.create.marking));
        console.log(`  EXISTS: ${conf.create.name}`);
      } else {
        const o = await prisma.outlet.create({ data: conf.create });
        outletByMarking.set(o.marking, o.id);
        locationToOutletId.set(name, o.id);
        console.log(`  CREATED: ${conf.create.name}`);
      }
    }
  }

  // ── Step 2: Build product+color index from Excel ─────────────────────────────
  console.log('\n── Step 2: Product+color index ──');
  // Map h2uSku → { mainSku, colorCode, colorName, productName, category, sellingPrice, costRm }
  const productMeta = new Map();
  for (const row of rows) {
    const parsed = parseSku(row['Variant SKU']);
    if (!parsed) continue;
    const { mainSku, colorCode } = parsed;
    const h2uSku = mainSku + colorCode;
    if (!productMeta.has(h2uSku)) {
      productMeta.set(h2uSku, {
        h2uSku,
        mainSku,
        colorCode,
        colorName: row['Option1 Value'] || null,
        productName: row['Title'] || '',
        category: mapCategory(row['Type']),
        sellingPrice: parseFloat(row['Variant Price']) || null,
        costRm: parseFloat(row['Variant Cost']) || null,
      });
    }
  }
  console.log(`  Unique product+color SKUs from Excel: ${productMeta.size}`);

  // ── Step 3: Find existing ProductLibrary entries ────────────────────────────
  const existingLib = await prisma.productLibrary.findMany({ select: { id: true, h2uSku: true, libNumber: true } });
  const libByH2uSku = new Map();
  existingLib.forEach(l => { if (l.h2uSku) libByH2uSku.set(l.h2uSku, l.id); });

  // Get next libNumber counter
  const maxLib = existingLib
    .map(l => parseInt(l.libNumber?.replace(/[^\d]/g, '') ?? '0'))
    .filter(n => !isNaN(n))
    .reduce((a, b) => Math.max(a, b), 0);
  let libCounter = maxLib + 1;

  // ── Step 4: Create missing ProductLibrary entries ────────────────────────────
  console.log('\n── Step 3: Create missing ProductLibrary entries ──');
  let created = 0;
  for (const [h2uSku, meta] of productMeta) {
    if (libByH2uSku.has(h2uSku)) continue;
    const libNumber = `PL-2026-${String(libCounter).padStart(3, '0')}`;
    libCounter++;
    const entry = await prisma.productLibrary.create({
      data: {
        libNumber,
        h2uSku,
        mainSku: meta.mainSku,
        colorCode: meta.colorCode,
        colorName: meta.colorName,
        productName: meta.productName,
        category: meta.category,
        sellingPrice: meta.sellingPrice,
        costRm: meta.costRm,
      },
    });
    libByH2uSku.set(h2uSku, entry.id);
    created++;
  }
  console.log(`  Created: ${created}, Existing: ${existingLib.length}`);

  // ── Step 5: Aggregate inventory per product+color × location × size ──────────
  console.log('\n── Step 4: Aggregating inventory ──');
  // key = `${h2uSku}|${outletId}` → { qty36..42 }
  const inv = new Map();

  for (const row of rows) {
    const parsed = parseSku(row['Variant SKU']);
    if (!parsed) continue;
    const size = parsed.size;
    if (size < 35 || size > 42) continue;
    const h2uSku = parsed.mainSku + parsed.colorCode;
    const productLibraryId = libByH2uSku.get(h2uSku);
    if (!productLibraryId) continue;

    for (const col of locCols) {
      const locName = col.replace('Inventory Available: ', '');
      const outletId = locationToOutletId.get(locName);
      if (!outletId) continue;
      const qty = parseInt(row[col]) || 0;
      if (qty === 0 && !inv.has(`${productLibraryId}|${outletId}`)) {
        // still need to ensure the key exists so we can create 0-stock records
      }
      const key = `${productLibraryId}|${outletId}`;
      if (!inv.has(key)) {
        inv.set(key, { productLibraryId, outletId, qty35:0, qty36:0, qty37:0, qty38:0, qty39:0, qty40:0, qty41:0, qty42:0 });
      }
      const rec = inv.get(key);
      rec[`qty${size}`] = (rec[`qty${size}`] || 0) + qty;
    }
  }

  // Calculate totals
  for (const rec of inv.values()) {
    rec.totalQty = rec.qty35 + rec.qty36 + rec.qty37 + rec.qty38 + rec.qty39 + rec.qty40 + rec.qty41 + rec.qty42;
  }
  console.log(`  Inventory records to upsert: ${inv.size}`);

  // ── Step 6: Upsert LocationInventory ─────────────────────────────────────────
  console.log('\n── Step 5: Upserting LocationInventory ──');
  let saved = 0;
  for (const rec of inv.values()) {
    await prisma.locationInventory.upsert({
      where: { productLibraryId_outletId: { productLibraryId: rec.productLibraryId, outletId: rec.outletId } },
      update: {
        qty35: rec.qty35, qty36: rec.qty36, qty37: rec.qty37, qty38: rec.qty38,
        qty39: rec.qty39, qty40: rec.qty40, qty41: rec.qty41, qty42: rec.qty42,
        totalQty: rec.totalQty, uploadedAt: new Date(),
      },
      create: {
        productLibraryId: rec.productLibraryId, outletId: rec.outletId,
        qty35: rec.qty35, qty36: rec.qty36, qty37: rec.qty37, qty38: rec.qty38,
        qty39: rec.qty39, qty40: rec.qty40, qty41: rec.qty41, qty42: rec.qty42,
        totalQty: rec.totalQty,
      },
    });
    saved++;
    if (saved % 500 === 0) console.log(`  ... ${saved} saved`);
  }
  console.log(`  Done. Total saved: ${saved}`);

  // ── Also update ProductLibrary inventoryTotal & warehouseQty ─────────────────
  console.log('\n── Step 6: Updating ProductLibrary totals ──');
  // Group inv by productLibraryId
  const totals = new Map();
  const warehouseOutletId = outletByMarking.get('JN75-H2UHQ');
  for (const rec of inv.values()) {
    if (!totals.has(rec.productLibraryId)) totals.set(rec.productLibraryId, { total: 0, warehouse: 0 });
    const t = totals.get(rec.productLibraryId);
    t.total += rec.totalQty;
    if (rec.outletId === warehouseOutletId) t.warehouse = rec.totalQty;
  }
  for (const [id, t] of totals) {
    await prisma.productLibrary.update({
      where: { id },
      data: { inventoryTotal: t.total, warehouseQty: t.warehouse },
    });
  }
  console.log(`  Updated ${totals.size} ProductLibrary totals`);

  await prisma.$disconnect();
  console.log('\n✅ Import complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
