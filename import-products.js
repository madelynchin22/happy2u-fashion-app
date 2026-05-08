const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TYPE_TO_CATEGORY = {
  "Sandals": "sandals",
  "Sneakers": "sneakers",
  "Flats": "flats",
  "Heels": "heels",
  "Wedges | Platforms": "wedges",
  "GIFT CARD": "accessories",
  "FOOTPATCH": "shoe_care",
  "CLEARANCE": "clearance",
  "Sanitizer": "accessories",
  "Accessories": "accessories",
  "Fashion Bag": "bags",
  "Ballerina": "flats",
  "Loafers": "flats",
};

function baseSku(sku) {
  if (!sku) return null;
  // strip trailing 2-digit size (36-42)
  return sku.replace(/\d{2}$/, "");
}

function computeStatus(type, totalQty) {
  if (type === "CLEARANCE") return "clearance";
  if (totalQty === 0) return "out_of_stock";
  if (totalQty <= 10) return "low_stock";
  return "active";
}

function sizeRange(variants) {
  const sizes = variants
    .map(v => parseInt(v.size))
    .filter(s => !isNaN(s))
    .sort((a, b) => a - b);
  if (!sizes.length) return null;
  const min = sizes[0], max = sizes[sizes.length - 1];
  return min === max ? String(min) : `${min}–${max}`;
}

function padNum(n) {
  return String(n).padStart(4, "0");
}

async function main() {
  const wb = XLSX.readFile("/Users/gwenheng/Downloads/Export_2026-05-05_115138.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  // Headers:
  // 0:Title 1:Type 2:UpdatedAt 3:PublishedAt 4:Color 5:Size 6:SKU
  // 7:Price 8:CompareAt 9:InvQty 10:Cost
  // 11-27: per-location inventory (inv[13] = H2U Warehouse)

  const groups = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const title = r[0], color = r[4], sku = r[6];
    if (!title) continue;
    const key = title + "||" + (color || "");
    if (!groups.has(key)) {
      groups.set(key, { title, color: color || null, type: r[1] || "", variants: [] });
    }
    const inv = r.slice(11);
    groups.get(key).variants.push({
      sku,
      size: String(r[5] || ""),
      price: r[7] || null,
      compareAt: r[8] || null,
      qty: parseInt(r[9]) || 0,
      cost: r[10] || null,
      // inv[13] = H2U Warehouse (Melaka), index = col 24 - col 11 = 13
      warehouseQty: parseInt(inv[13]) || 0,
    });
  }

  console.log(`Grouped into ${groups.size} product-color entries`);

  // Delete all existing ProductLibrary entries
  const existing = await prisma.productLibrary.count();
  if (existing > 0) {
    await prisma.productLibrary.deleteMany({});
    console.log(`Deleted ${existing} existing entries`);
  }

  const entries = [...groups.values()];
  let created = 0;

  for (let i = 0; i < entries.length; i++) {
    const g = entries[i];
    const libNumber = `PL-${padNum(i + 1)}`;
    const totalQty = g.variants.reduce((s, v) => s + (parseInt(v.qty) || 0), 0);
    const totalWarehouse = g.variants.reduce((s, v) => s + (parseInt(v.warehouseQty) || 0), 0);
    const firstVariant = g.variants[0];
    const sku = baseSku(firstVariant?.sku);
    const category = TYPE_TO_CATEGORY[g.type] || "accessories";
    const status = computeStatus(g.type, totalQty);
    const sr = sizeRange(g.variants);

    // Unique sizes (sorted)
    const uniqueSizes = [...new Set(
      g.variants.map(v => String(v.size).trim()).filter(s => s && s !== "undefined")
    )].sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    // Per-size inventory: { "36": 5, "37": 4, "38": 5, ... }
    const sizeInv = {};
    for (const v of g.variants) {
      const sz = String(v.size).trim();
      if (sz && sz !== "undefined") {
        sizeInv[sz] = (sizeInv[sz] || 0) + (parseInt(v.qty) || 0);
      }
    }

    await prisma.productLibrary.create({
      data: {
        libNumber,
        productName: g.title,
        h2uSku: sku || null,
        brand: "Happy2U",
        category,
        colorName: g.color,
        status,
        inventoryTotal: totalQty,
        warehouseQty: totalWarehouse,
        sizeRange: sr,
        availableSizes: JSON.stringify(uniqueSizes),
        sizeInventory: JSON.stringify(sizeInv),
        sellingPrice: firstVariant?.price || null,
        compareAtPrice: firstVariant?.compareAt || null,
        costRm: firstVariant?.cost || null,
        productType: g.type || null,
      },
    });
    created++;
    if (created % 50 === 0) console.log(`  Created ${created}/${entries.length}...`);
  }

  console.log(`\nDone! Created ${created} product entries.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
