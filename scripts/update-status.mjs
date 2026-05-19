import XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseSku(sku) {
  if (!sku) return null;
  const m = sku.match(/^([A-Z]\d+)([A-Z]+)(\d{2})$/);
  if (m) return { mainSku: m[1], colorCode: m[2] };
  return null;
}

function deriveStatus(row) {
  if (!row['Published At']) return 'archived';
  if ((row['Type'] ?? '').toUpperCase() === 'CLEARANCE') return 'clearance';
  return 'active';
}

async function main() {
  console.log('Reading Excel...');
  const wb = XLSX.readFile('/Users/gwenheng/Downloads/Export_2026-05-18_102441.xlsx');
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Build h2uSku → status map (take first occurrence per SKU)
  const statusMap = new Map();
  for (const row of rows) {
    const parsed = parseSku(row['Variant SKU']);
    if (!parsed) continue;
    const h2uSku = parsed.mainSku + parsed.colorCode;
    if (!statusMap.has(h2uSku)) {
      statusMap.set(h2uSku, deriveStatus(row));
    }
  }
  console.log(`Unique h2uSkus with status: ${statusMap.size}`);

  const breakdown = { active: 0, clearance: 0, archived: 0 };
  statusMap.forEach(s => breakdown[s] = (breakdown[s] || 0) + 1);
  console.log('Breakdown:', breakdown);

  // Update ProductLibrary
  const all = await prisma.productLibrary.findMany({ select: { id: true, h2uSku: true } });
  let updated = 0;
  for (const lib of all) {
    if (!lib.h2uSku) continue;
    const status = statusMap.get(lib.h2uSku);
    if (!status) continue;
    await prisma.productLibrary.update({ where: { id: lib.id }, data: { status } });
    updated++;
  }
  console.log(`Updated ${updated} ProductLibrary entries.`);
  await prisma.$disconnect();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
