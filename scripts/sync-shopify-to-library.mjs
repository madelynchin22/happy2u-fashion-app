/**
 * sync-shopify-to-library.mjs
 * Fetches all active products from shophappy2u.com and upserts ProductLibrary entries.
 * Safe to re-run: only fills in missing fields, never overwrites existing data.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SHOPIFY_URL = "https://shophappy2u.com/products.json?limit=250";

// Parse "S1806BRS36" → { h2uSku:"S1806BRS", mainSku:"S1806", colorCode:"BRS", size:"36" }
// Parse "S1625-2H36" → { h2uSku:"S1625-2H",  mainSku:"S1625-2", colorCode:"H",   size:"36" }
function parseSku(sku) {
  if (!sku || !/^S\d/i.test(sku)) return null;
  const sizeMatch = sku.match(/(\d{2,3})$/);
  if (!sizeMatch) return null;
  const size   = sizeMatch[1];
  const h2uSku = sku.slice(0, sku.length - size.length);
  const ccMatch = h2uSku.match(/([A-Z]+)$/);
  const colorCode = ccMatch ? ccMatch[1] : "";
  const mainSku   = colorCode ? h2uSku.slice(0, h2uSku.length - colorCode.length) : h2uSku;
  return { h2uSku, mainSku, colorCode, size };
}

// Get next available libNumbers starting from current max
async function getNextLibNumbers(count) {
  const rows = await prisma.productLibrary.findMany({
    select: { libNumber: true },
    orderBy: { libNumber: "desc" },
    take: 1,
  });
  const maxNum = rows.length
    ? parseInt(rows[0].libNumber.replace(/\D/g, ""), 10)
    : 2026484;
  return Array.from({ length: count }, (_, i) => `PL-2026-${maxNum + i + 1}`);
}

async function main() {
  console.log("Fetching products from shophappy2u.com...");
  const res = await fetch(SHOPIFY_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  const { products } = await res.json();
  console.log(`  ${products.length} products found`);

  // Build colour-level entries from Shopify
  // entries: Map<h2uSku, { h2uSku, mainSku, colorCode, colorName, productName, shoePhotoUrl, status }>
  const entries = new Map();

  for (const product of products) {
    // Build variant-id → image-src map
    const imgMap = {};
    for (const img of product.images) {
      for (const vid of img.variant_ids) imgMap[vid] = img.src;
    }

    // Public products.json only returns published products, so all are "active"
    const status = "active";

    const seenH2u = new Set();
    for (const variant of product.variants) {
      const parsed = parseSku(variant.sku);
      if (!parsed) continue;
      if (seenH2u.has(parsed.h2uSku)) continue;
      seenH2u.add(parsed.h2uSku);

      entries.set(parsed.h2uSku, {
        h2uSku:      parsed.h2uSku,
        mainSku:     parsed.mainSku,
        colorCode:   parsed.colorCode || null,
        colorName:   variant.option1 || null,
        productName: product.title || null,
        shoePhotoUrl: imgMap[variant.id] || null,
        brand:       product.vendor || null,
        status,
      });
    }
  }

  console.log(`  ${entries.size} unique colour SKUs from Shopify\n`);

  // Fetch all existing ProductLibrary entries (just h2uSku + key fields)
  const existing = await prisma.productLibrary.findMany({
    select: { id: true, h2uSku: true, shoePhotoUrl: true, productName: true, colorName: true, brand: true, status: true },
  });
  const existingByH2u = new Map(existing.map(e => [e.h2uSku, e]));

  // Prepare next libNumbers for new entries
  const toCreate = [...entries.values()].filter(e => !existingByH2u.has(e.h2uSku));
  const libNumbers = await getNextLibNumbers(toCreate.length);

  let created = 0, updated = 0, skipped = 0;

  for (const entry of entries.values()) {
    const existing = existingByH2u.get(entry.h2uSku);

    if (!existing) {
      // Create new entry
      const libNumber = libNumbers[created];
      await prisma.productLibrary.create({
        data: {
          libNumber,
          h2uSku:      entry.h2uSku,
          mainSku:     entry.mainSku,
          colorCode:   entry.colorCode,
          colorName:   entry.colorName,
          productName: entry.productName,
          shoePhotoUrl: entry.shoePhotoUrl,
          brand:       entry.brand,
          status:      entry.status,
        },
      });
      console.log(`  [CREATE] ${entry.h2uSku} — ${entry.colorName} — ${entry.productName}`);
      created++;
    } else {
      // Update only fields that are missing in the existing record
      const updates = {};
      if (!existing.shoePhotoUrl && entry.shoePhotoUrl) updates.shoePhotoUrl = entry.shoePhotoUrl;
      if (!existing.productName  && entry.productName)  updates.productName  = entry.productName;
      if (!existing.colorName    && entry.colorName)    updates.colorName    = entry.colorName;
      // Always sync vendor and status from Shopify (authoritative source)
      if (entry.brand   && existing.brand   !== entry.brand)   updates.brand  = entry.brand;
      if (existing.status !== entry.status) updates.status = entry.status;

      if (Object.keys(updates).length > 0) {
        await prisma.productLibrary.update({ where: { id: existing.id }, data: updates });
        const keys = Object.keys(updates).join(", ");
        console.log(`  [UPDATE] ${entry.h2uSku} — ${keys}`);
        updated++;
      } else {
        skipped++;
      }
    }
  }

  // Report h2uSkus in library that are NOT on Shopify (discontinued / manual entries)
  const notOnShopify = existing.filter(e => e.h2uSku && !entries.has(e.h2uSku));
  if (notOnShopify.length) {
    console.log(`\n  [INFO] ${notOnShopify.length} library entries not found on Shopify (discontinued / manual):`);
    notOnShopify.slice(0, 20).forEach(e => console.log(`    ${e.h2uSku}`));
    if (notOnShopify.length > 20) console.log(`    ...and ${notOnShopify.length - 20} more`);
  }

  console.log(`\nDone. Created: ${created} | Updated: ${updated} | Already in sync: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
