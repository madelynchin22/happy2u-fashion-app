// Compares April 6 vs May 5 Shopify inventory exports.
// Derives unitsSold for each ProductLibrary entry and updates the DB.
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const APR_FILE = "/Users/gwenheng/Downloads/Export_2026-04-06_142928.xlsx";
const MAY_FILE = "/Users/gwenheng/Downloads/Export_2026-05-05_115138.xlsx";
const DAYS = 29; // Apr 6 → May 5

// April 6 columns: title=0, color=6 (Option1 Value), inv=13
function parseApr(rows) {
  const groups = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    const key = r[0] + "||" + (r[6] || "");
    groups.set(key, (groups.get(key) || 0) + (parseInt(r[13]) || 0));
  }
  return groups;
}

// May 5 columns: title=0, color=4 (Option1 Value), inv=9
function parseMay(rows) {
  const groups = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;
    const key = r[0] + "||" + (r[4] || "");
    groups.set(key, (groups.get(key) || 0) + (parseInt(r[9]) || 0));
  }
  return groups;
}

async function main() {
  const apr = parseApr(XLSX.utils.sheet_to_json(XLSX.readFile(APR_FILE).Sheets[XLSX.readFile(APR_FILE).SheetNames[0]], { header: 1 }));
  const may = parseMay(XLSX.utils.sheet_to_json(XLSX.readFile(MAY_FILE).Sheets[XLSX.readFile(MAY_FILE).SheetNames[0]], { header: 1 }));

  // Build comparison — units sold = inventory decrease only
  // May > April → inventory went up (restock), treat as 0 sold for velocity purposes
  // May < April → sold = difference
  // May = April → 0 sold
  const sales = new Map();
  let totalSold = 0, soldCount = 0;
  for (const [key, aprInv] of apr) {
    const mayInv = may.get(key) ?? null;
    if (mayInv === null) continue;
    const sold = Math.max(0, aprInv - mayInv);
    sales.set(key, { sold, aprInv, mayInv });
    if (sold > 0) { soldCount++; totalSold += sold; }
  }

  console.log(`Window: Apr 6 → May 5 (${DAYS} days)`);
  console.log(`SKUs with sales: ${soldCount} | Total units sold: ${totalSold}`);

  // Fetch all ProductLibrary entries
  const all = await prisma.productLibrary.findMany({ select: { id: true, productName: true, colorName: true } });
  console.log(`\nUpdating ${all.length} ProductLibrary entries…`);

  let updated = 0, notFound = 0;
  for (const item of all) {
    const key = item.productName + "||" + (item.colorName || "");
    const entry = sales.get(key);
    if (!entry) {
      const aprInv = apr.get(key);
      await prisma.productLibrary.update({
        where: { id: item.id },
        data: { unitsSold: 0, daysTracked: DAYS, aprInventory: aprInv ?? null },
      });
      notFound++;
      continue;
    }
    await prisma.productLibrary.update({
      where: { id: item.id },
      data: {
        unitsSold:   entry.sold,
        daysTracked: DAYS,
        aprInventory: entry.aprInv,
      },
    });
    updated++;
    if ((updated + notFound) % 100 === 0) console.log(`  ${updated + notFound}/${all.length}…`);
  }

  console.log(`\nDone. Updated: ${updated} | No April match: ${notFound}`);

  const topSellers = await prisma.productLibrary.findMany({
    where: { unitsSold: { gt: 0 } },
    orderBy: { unitsSold: "desc" },
    take: 15,
    select: { productName: true, colorName: true, unitsSold: true, aprInventory: true, inventoryTotal: true, sellingPrice: true, costRm: true },
  });
  console.log("\nTop 15 sellers (Apr 6 → May 5):");
  topSellers.forEach((p, i) => {
    const margin = p.sellingPrice && p.costRm
      ? Math.round((p.sellingPrice - p.costRm) / p.sellingPrice * 100) : null;
    console.log(`  ${i+1}. ${p.productName} [${p.colorName || "N/A"}] — sold:${p.unitsSold} | margin:${margin ?? "?"}%`);
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
