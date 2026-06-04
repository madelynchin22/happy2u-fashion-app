import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const STORE = "https://shophappy2u.com";
const SIZE_SUFFIX = /^(.*?)(3[5-9]|4[0-2])([A-Z]*)$/i;

export async function GET() {
  // Fetch Shopify products
  const res = await fetch(`${STORE}/products.json?limit=250&page=1`, {
    headers: { "User-Agent": "Happy2U-Admin/1.0" }, cache: "no-store",
  });
  const { products = [] } = await res.json();

  // Build Shopify SKU map
  const shopifyMap = new Map<string, { name: string; status: string }>();
  for (const p of products) {
    const tags: string = [...(p.tags ?? [])].join(" ");
    const isClearance = /clearance/i.test(p.product_type ?? "") || /clearance/i.test(tags);
    const status = isClearance ? "clearance" : "active";
    for (const v of p.variants ?? []) {
      const raw: string = v.sku ?? "";
      if (!raw) continue;
      const m = raw.match(SIZE_SUFFIX);
      const base = (m ? m[1] + (m[3] ?? "") : raw).toUpperCase();
      if (!shopifyMap.has(base)) shopifyMap.set(base, { name: p.title, status });
    }
  }

  // Fetch Product Library
  const plItems = await prisma.productLibrary.findMany({
    select: { h2uSku: true, productName: true, status: true },
  });
  const plMap = new Map(plItems.filter(i => i.h2uSku).map(i => [i.h2uSku!.toUpperCase(), i]));

  // Compare
  const missingFromPL: { sku: string; name: string; shopifyStatus: string }[] = [];
  const statusMismatch: { sku: string; name: string; shopify: string; db: string }[] = [];

  for (const [sku, shopify] of shopifyMap) {
    if (!plMap.has(sku)) {
      missingFromPL.push({ sku, name: shopify.name, shopifyStatus: shopify.status });
    } else {
      const pl = plMap.get(sku)!;
      if (shopify.status !== pl.status) {
        statusMismatch.push({ sku, name: shopify.name, shopify: shopify.status, db: pl.status ?? "none" });
      }
    }
  }

  const notOnShopify = [...plMap.entries()]
    .filter(([sku]) => !shopifyMap.has(sku))
    .map(([sku, pl]) => ({ sku, name: pl.productName, dbStatus: pl.status }));

  return NextResponse.json({
    summary: {
      shopifySkus: shopifyMap.size,
      productLibrarySkus: plMap.size,
      missingFromProductLibrary: missingFromPL.length,
      statusMismatches: statusMismatch.length,
      inDbNotOnShopify: notOnShopify.length,
    },
    missingFromProductLibrary: missingFromPL,
    statusMismatches: statusMismatch,
    inDbNotOnShopify: notOnShopify.filter(i => !["draft","archived"].includes(i.dbStatus ?? "")),
  });
}
