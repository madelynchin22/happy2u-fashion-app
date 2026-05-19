/**
 * verify-import.mjs
 * Thorough verification of imported inventory data against the source Excel file.
 * Run with: node scripts/verify-import.mjs
 */

import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXCEL_PATH = '/Users/gwenheng/Downloads/Export_2026-05-18_102441.xlsx';

// ── Location mapping (mirrors import-inventory.mjs) ──────────────────────────
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
  'Aramex':                       null,
  'Eslite Spectrum Kuala Lumpur': { marking: 'JN55-H2UES' },
  'H2U Warehouse (Melaka)':       { marking: 'JN75-H2UHQ' },
  'MISF Pavilion, KL':            null, // removed outlet
  'Photoshoot':                   null,
  'Pop-up Store, MyTOWN KL':      null, // removed outlet
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseSku(sku) {
  if (!sku) return null;
  const m = String(sku).trim().match(/^([A-Z]\d+)([A-Z]+)(\d{2})$/);
  if (m) return { mainSku: m[1], colorCode: m[2], size: parseInt(m[3]) };
  return null;
}

function deriveStatus(row) {
  if (!row['Published At']) return 'archived';
  if ((row['Type'] ?? '').toUpperCase() === 'CLEARANCE') return 'clearance';
  return 'active';
}

function sep(char = '─', len = 70) {
  return char.repeat(len);
}

function header(title) {
  console.log('\n' + sep('═'));
  console.log(`  ${title}`);
  console.log(sep('═'));
}

function subHeader(title) {
  console.log('\n' + sep('─', 60));
  console.log(`  ${title}`);
  console.log(sep('─', 60));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nVerification script started at ${new Date().toISOString()}`);
  console.log(`Excel: ${EXCEL_PATH}`);

  // ── Load Excel ──────────────────────────────────────────────────────────────
  console.log('\nLoading Excel file...');
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  console.log(`  Rows loaded: ${rows.length}`);

  // Identify location columns
  const allCols = Object.keys(rows[0] || {});
  const locCols = allCols.filter(k => k.startsWith('Inventory Available:'));
  const locNames = locCols.map(c => c.replace('Inventory Available: ', ''));

  // ── Load DB outlets ──────────────────────────────────────────────────────────
  const dbOutlets = await prisma.outlet.findMany();
  const outletByMarking = new Map(dbOutlets.map(o => [o.marking, o]));

  // Build location → outletId map
  const locationToOutletId = new Map();
  const locationToMarking = new Map();
  for (const name of locNames) {
    const conf = LOCATION_MAP[name];
    if (!conf) continue;
    const marking = conf.marking;
    if (!marking) continue;
    const outlet = outletByMarking.get(marking);
    if (outlet) {
      locationToOutletId.set(name, outlet.id);
      locationToMarking.set(name, marking);
    }
  }

  // ── Build Excel-side data structures ────────────────────────────────────────
  // h2uSku → first-seen row metadata (for status, etc.)
  const excelProductMeta = new Map();
  // h2uSku → per-location → per-size qty aggregated
  // key: `${h2uSku}|${locName}` → { qty35..qty42 }
  const excelInventory = new Map();

  let parsedRows = 0;
  let unparsedRows = 0;

  for (const row of rows) {
    const parsed = parseSku(row['Variant SKU']);
    if (!parsed) { unparsedRows++; continue; }
    parsedRows++;

    const { mainSku, colorCode, size } = parsed;
    const h2uSku = mainSku + colorCode;

    if (!excelProductMeta.has(h2uSku)) {
      excelProductMeta.set(h2uSku, {
        h2uSku,
        mainSku,
        colorCode,
        status: deriveStatus(row),
        type: row['Type'] ?? '',
        publishedAt: row['Published At'] ?? '',
        productName: row['Title'] ?? '',
      });
    }

    if (size >= 35 && size <= 42) {
      for (const col of locCols) {
        const locName = col.replace('Inventory Available: ', '');
        if (!locationToOutletId.has(locName)) continue; // skip unmapped
        const qty = parseInt(row[col]) || 0;
        const key = `${h2uSku}|${locName}`;
        if (!excelInventory.has(key)) {
          excelInventory.set(key, { qty35:0, qty36:0, qty37:0, qty38:0, qty39:0, qty40:0, qty41:0, qty42:0 });
        }
        const rec = excelInventory.get(key);
        rec[`qty${size}`] += qty;
      }
    }
  }

  // ── Load DB data ─────────────────────────────────────────────────────────────
  const dbProducts = await prisma.productLibrary.findMany({
    include: { locationInventories: { include: { outlet: true } } },
  });
  const dbByH2uSku = new Map();
  for (const p of dbProducts) {
    if (p.h2uSku) dbByH2uSku.set(p.h2uSku, p);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK 1: STATUS ACCURACY
  // ════════════════════════════════════════════════════════════════════════════
  header('CHECK 1: STATUS ACCURACY');
  console.log('  Rule: Published At empty → archived, Type=CLEARANCE → clearance, else → active\n');

  let statusMatch = 0;
  let statusMismatch = 0;
  const statusMismatches = [];

  for (const [h2uSku, meta] of excelProductMeta) {
    const dbProduct = dbByH2uSku.get(h2uSku);
    if (!dbProduct) continue; // will be caught in check 3
    const excelStatus = meta.status;
    const dbStatus = dbProduct.status ?? '(null)';
    if (excelStatus === dbStatus) {
      statusMatch++;
    } else {
      statusMismatch++;
      statusMismatches.push({
        h2uSku,
        excelStatus,
        dbStatus,
        publishedAt: meta.publishedAt,
        type: meta.type,
      });
    }
  }

  console.log(`  Matches:    ${statusMatch}`);
  console.log(`  Mismatches: ${statusMismatch}`);

  if (statusMismatches.length > 0) {
    console.log('\n  MISMATCHES:');
    console.log(`  ${'SKU'.padEnd(14)} ${'Excel Status'.padEnd(12)} ${'DB Status'.padEnd(12)} ${'Published At'.padEnd(22)} Type`);
    console.log('  ' + '─'.repeat(80));
    for (const m of statusMismatches) {
      const pub = m.publishedAt ? String(m.publishedAt).slice(0, 20) : '(empty)';
      console.log(`  ${m.h2uSku.padEnd(14)} ${m.excelStatus.padEnd(12)} ${m.dbStatus.padEnd(12)} ${pub.padEnd(22)} ${m.type}`);
    }
  } else {
    console.log('\n  All statuses match.');
  }

  // Status breakdown
  const excelBreakdown = { active: 0, clearance: 0, archived: 0 };
  const dbBreakdown = { active: 0, clearance: 0, archived: 0, null: 0 };
  for (const [, meta] of excelProductMeta) excelBreakdown[meta.status] = (excelBreakdown[meta.status] || 0) + 1;
  for (const [, p] of dbByH2uSku) {
    const s = p.status ?? 'null';
    dbBreakdown[s] = (dbBreakdown[s] || 0) + 1;
  }
  console.log('\n  Excel breakdown:', excelBreakdown);
  console.log('  DB breakdown:   ', dbBreakdown);

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK 2: INVENTORY PER LOCATION (5 random samples)
  // ════════════════════════════════════════════════════════════════════════════
  header('CHECK 2: INVENTORY PER LOCATION (5 random samples with non-zero stock)');

  // Find h2uSkus with non-zero inventory in at least one mapped location
  const nonZeroSkus = [];
  for (const [key, rec] of excelInventory) {
    const total = rec.qty35 + rec.qty36 + rec.qty37 + rec.qty38 + rec.qty39 + rec.qty40 + rec.qty41 + rec.qty42;
    if (total > 0) {
      const [h2uSku, locName] = key.split('|');
      if (dbByH2uSku.has(h2uSku)) nonZeroSkus.push({ h2uSku, locName, total });
    }
  }

  // Deduplicate by h2uSku — take one per SKU
  const seenSku = new Set();
  const uniqueNonZero = [];
  for (const entry of nonZeroSkus) {
    if (!seenSku.has(entry.h2uSku)) {
      seenSku.add(entry.h2uSku);
      uniqueNonZero.push(entry);
    }
  }

  // Pseudo-random sample (deterministic via sort+slice for reproducibility)
  const seed = nonZeroSkus.length;
  const shuffled = [...uniqueNonZero].sort((a, b) => {
    const ha = a.h2uSku.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + seed), 0);
    const hb = b.h2uSku.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + seed), 0);
    return (ha % 997) - (hb % 997);
  });
  const sample5 = shuffled.slice(0, 5);

  for (const { h2uSku, locName } of sample5) {
    subHeader(`SKU: ${h2uSku}  |  Location: ${locName}`);
    const excelRec = excelInventory.get(`${h2uSku}|${locName}`) || {};
    const dbProduct = dbByH2uSku.get(h2uSku);
    const outletId = locationToOutletId.get(locName);

    const dbLocInv = dbProduct?.locationInventories?.find(li => li.outletId === outletId);

    const sizes = [35, 36, 37, 38, 39, 40, 41, 42];
    console.log(`\n  ${'Size'.padEnd(6)} ${'Excel Qty'.padEnd(12)} ${'DB Qty'.padEnd(12)} ${'Match?'}`);
    console.log('  ' + '─'.repeat(40));

    let allMatch = true;
    for (const s of sizes) {
      const exQty = excelRec[`qty${s}`] ?? 0;
      const dbQty = dbLocInv ? (dbLocInv[`qty${s}`] ?? 0) : 0;
      const match = exQty === dbQty ? 'YES' : 'NO  <<<';
      if (exQty !== dbQty) allMatch = false;
      console.log(`  ${String(s).padEnd(6)} ${String(exQty).padEnd(12)} ${String(dbQty).padEnd(12)} ${match}`);
    }

    const exTotal = Object.values(excelRec).reduce((a, b) => a + b, 0);
    const dbTotal = dbLocInv?.totalQty ?? 0;
    const totalMatch = exTotal === dbTotal ? 'YES' : 'NO  <<<';
    if (exTotal !== dbTotal) allMatch = false;
    console.log('  ' + '─'.repeat(40));
    console.log(`  ${'TOTAL'.padEnd(6)} ${String(exTotal).padEnd(12)} ${String(dbTotal).padEnd(12)} ${totalMatch}`);

    if (!dbLocInv) {
      console.log(`  WARNING: No DB LocationInventory record found for this product+outlet.`);
    }
    console.log(`  Overall: ${allMatch ? 'ALL MATCH' : 'DISCREPANCIES FOUND'}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK 3: PRODUCT COUNTS
  // ════════════════════════════════════════════════════════════════════════════
  header('CHECK 3: PRODUCT COUNTS');

  const excelSkus = new Set(excelProductMeta.keys());
  const dbSkus = new Set(dbByH2uSku.keys());

  console.log(`  Unique h2uSkus in Excel (parseable): ${excelSkus.size}`);
  console.log(`  Unique h2uSkus in DB ProductLibrary: ${dbSkus.size}`);

  const inExcelNotDb = [...excelSkus].filter(s => !dbSkus.has(s));
  const inDbNotExcel = [...dbSkus].filter(s => !excelSkus.has(s));

  if (inExcelNotDb.length > 0) {
    console.log(`\n  SKUs in Excel but NOT in DB (${inExcelNotDb.length}):`);
    for (const s of inExcelNotDb) {
      console.log(`    ${s}  [${excelProductMeta.get(s)?.productName}]`);
    }
  } else {
    console.log('\n  All Excel SKUs are present in DB.');
  }

  if (inDbNotExcel.length > 0) {
    console.log(`\n  SKUs in DB but NOT in Excel (${inDbNotExcel.length}):`);
    for (const s of inDbNotExcel.slice(0, 30)) {
      const p = dbByH2uSku.get(s);
      console.log(`    ${s}  [${p?.productName ?? ''}]  status=${p?.status ?? 'null'}`);
    }
    if (inDbNotExcel.length > 30) console.log(`    ... and ${inDbNotExcel.length - 30} more`);
  } else {
    console.log('\n  All DB SKUs are present in Excel.');
  }

  // Also count unparseable rows
  console.log(`\n  Rows with unparseable Variant SKU (skipped): ${unparsedRows}`);
  console.log(`  Rows with valid Variant SKU (parsed):        ${parsedRows}`);

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK 4: LOCATION COVERAGE
  // ════════════════════════════════════════════════════════════════════════════
  header('CHECK 4: LOCATION COVERAGE');

  console.log(`  Total location columns in Excel: ${locNames.length}`);
  console.log(`  Columns: ${locCols.map(c => c.replace('Inventory Available: ','  '))}\n`);

  const mapped = [];
  const skipped = [];
  const notInDb = [];

  for (const name of locNames) {
    const conf = LOCATION_MAP[name];
    if (conf === undefined) {
      skipped.push({ name, reason: 'Not in LOCATION_MAP (unmapped by importer)' });
    } else if (conf === null) {
      skipped.push({ name, reason: 'Explicitly set to null in LOCATION_MAP (skip: logistics/photoshoot)' });
    } else if (conf.marking) {
      const outlet = outletByMarking.get(conf.marking);
      if (outlet) {
        mapped.push({ name, marking: conf.marking, outletName: outlet.name });
      } else {
        notInDb.push({ name, marking: conf.marking, reason: 'Marking not found in DB Outlet table' });
      }
    }
  }

  console.log(`  MAPPED (${mapped.length}):`);
  for (const m of mapped) {
    console.log(`    [OK]  "${m.name}"  →  ${m.marking}  (${m.outletName})`);
  }

  if (skipped.length > 0) {
    console.log(`\n  SKIPPED (${skipped.length}):`);
    for (const s of skipped) {
      console.log(`    [SKIP] "${s.name}"  —  ${s.reason}`);
    }
  }

  if (notInDb.length > 0) {
    console.log(`\n  MARKING NOT IN DB (${notInDb.length}):`);
    for (const n of notInDb) {
      console.log(`    [WARN] "${n.name}"  →  ${n.marking}  —  ${n.reason}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK 5: QUANTITY TOTALS (3 specific products)
  // ════════════════════════════════════════════════════════════════════════════
  header('CHECK 5: QUANTITY TOTALS (3 specific products)');

  // Pick 3 products that have inventory in Excel: prefer ones with highest total qty
  const skuTotals = new Map();
  for (const [key, rec] of excelInventory) {
    const [h2uSku] = key.split('|');
    const total = rec.qty35 + rec.qty36 + rec.qty37 + rec.qty38 + rec.qty39 + rec.qty40 + rec.qty41 + rec.qty42;
    skuTotals.set(h2uSku, (skuTotals.get(h2uSku) || 0) + total);
  }
  const top3 = [...skuTotals.entries()]
    .filter(([sku]) => dbByH2uSku.has(sku))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([sku]) => sku);

  for (const h2uSku of top3) {
    subHeader(`SKU: ${h2uSku}  [${excelProductMeta.get(h2uSku)?.productName ?? ''}]`);

    // Excel: sum across all mapped locations
    let excelGrandTotal = 0;
    const excelByLoc = [];
    for (const name of locNames) {
      if (!locationToOutletId.has(name)) continue;
      const key = `${h2uSku}|${name}`;
      const rec = excelInventory.get(key);
      if (!rec) continue;
      const locTotal = rec.qty35 + rec.qty36 + rec.qty37 + rec.qty38 + rec.qty39 + rec.qty40 + rec.qty41 + rec.qty42;
      excelGrandTotal += locTotal;
      if (locTotal > 0) excelByLoc.push({ name, total: locTotal });
    }

    // DB: sum LocationInventory.totalQty across all outlets
    const dbProduct = dbByH2uSku.get(h2uSku);
    let dbGrandTotal = 0;
    const dbByLoc = [];
    for (const li of (dbProduct?.locationInventories ?? [])) {
      dbGrandTotal += li.totalQty;
      if (li.totalQty > 0) dbByLoc.push({ name: li.outlet?.name, total: li.totalQty });
    }

    console.log(`\n  Excel total (mapped locations): ${excelGrandTotal}`);
    console.log(`  DB total (LocationInventory):   ${dbGrandTotal}`);
    console.log(`  Match: ${excelGrandTotal === dbGrandTotal ? 'YES' : 'NO  <<<  DISCREPANCY of ' + Math.abs(excelGrandTotal - dbGrandTotal)}`);

    // Also compare ProductLibrary.inventoryTotal
    const plTotal = dbProduct?.inventoryTotal ?? null;
    console.log(`  ProductLibrary.inventoryTotal:  ${plTotal ?? '(null)'}  ${plTotal === dbGrandTotal ? '[= DB sum]' : '[differs from DB LocationInventory sum!]'}`);

    console.log('\n  Excel by location:');
    for (const e of excelByLoc) console.log(`    ${e.name.padEnd(35)} ${e.total}`);
    console.log('  DB by location:');
    for (const d of dbByLoc) console.log(`    ${(d.name ?? '?').padEnd(35)} ${d.total}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK 6: SKU PARSING SPOT-CHECK (10 samples)
  // ════════════════════════════════════════════════════════════════════════════
  header('CHECK 6: SKU PARSING SPOT-CHECK (10 samples)');

  // Get 10 diverse raw Variant SKUs from the Excel
  const rawSkusAll = rows
    .map(r => String(r['Variant SKU'] || '').trim())
    .filter(s => s.length > 0);

  // Take a spread: first, some from middle, end
  const step = Math.floor(rawSkusAll.length / 9);
  const indices = Array.from({ length: 10 }, (_, i) => Math.min(i * step, rawSkusAll.length - 1));
  const sampleRawSkus = [...new Set(indices.map(i => rawSkusAll[i]))].slice(0, 10);

  console.log(`\n  ${'Raw Variant SKU'.padEnd(18)} ${'Matches Regex?'.padEnd(16)} ${'mainSku'.padEnd(10)} ${'colorCode'.padEnd(12)} ${'size'}`);
  console.log('  ' + '─'.repeat(70));

  const SKU_REGEX = /^([A-Z]\d+)([A-Z]+)(\d{2})$/;
  for (const rawSku of sampleRawSkus) {
    const m = rawSku.match(SKU_REGEX);
    if (m) {
      console.log(`  ${rawSku.padEnd(18)} ${'YES'.padEnd(16)} ${m[1].padEnd(10)} ${m[2].padEnd(12)} ${m[3]}`);
    } else {
      console.log(`  ${rawSku.padEnd(18)} NO`);
    }
  }

  // Also show a few that DON'T parse (if any)
  const nonMatching = rawSkusAll.filter(s => !SKU_REGEX.test(s)).slice(0, 5);
  if (nonMatching.length > 0) {
    console.log('\n  Sample SKUs that do NOT match the standard pattern:');
    for (const s of nonMatching) console.log(`    "${s}"`);
  } else {
    console.log('\n  All Variant SKUs in Excel match the standard pattern.');
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════════════
  header('SUMMARY');

  const issues = [];
  if (statusMismatch > 0) issues.push(`Check 1: ${statusMismatch} status mismatch(es)`);
  if (inExcelNotDb.length > 0) issues.push(`Check 3: ${inExcelNotDb.length} Excel SKU(s) missing from DB`);
  if (inDbNotExcel.length > 0) issues.push(`Check 3: ${inDbNotExcel.length} DB SKU(s) not in Excel`);
  if (notInDb.length > 0) issues.push(`Check 4: ${notInDb.length} location(s) with marking not found in DB`);

  if (issues.length === 0) {
    console.log('  No critical issues found. All checks passed.');
  } else {
    console.log('  Issues requiring attention:');
    for (const issue of issues) console.log(`    - ${issue}`);
  }

  console.log('\n  Run complete at', new Date().toISOString());
  await prisma.$disconnect();
}

main().catch(e => {
  console.error('\nFATAL ERROR:', e);
  prisma.$disconnect();
  process.exit(1);
});
