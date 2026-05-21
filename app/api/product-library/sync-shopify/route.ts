import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STORE = "https://shophappy2u.com";
const SIZE_SUFFIX = /^(.*?)(3[5-9]|4[0-2])$/;
const MAIN_SKU_PREFIX = /^(S\d{4})/i;

async function fetchAllProducts() {
  const all: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${STORE}/products.json?limit=250&page=${page}`, {
      headers: { "User-Agent": "Happy2U-Admin/1.0" },
      cache: "no-store",
    });
    if (!res.ok) break;
    const json = await res.json();
    const batch: any[] = json.products ?? [];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 250) break;
    page++;
  }
  return all;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const products = await fetchAllProducts();
    if (!products.length) {
      return NextResponse.json({ error: "Could not fetch products from shophappy2u.com" }, { status: 502 });
    }

    // skuImageMap:   h2uSku (uppercase) → color-specific image URL
    // mainSkuDescMap: mainSku (uppercase) → plain-text description
    const skuImageMap    = new Map<string, string>();
    const mainSkuDescMap = new Map<string, string>();

    for (const product of products) {
      const variantImageMap = new Map<number, string>();
      for (const img of product.images ?? []) {
        for (const vid of img.variant_ids ?? []) {
          if (!variantImageMap.has(vid)) variantImageMap.set(vid, img.src);
        }
      }
      const defaultImage: string =
        (product.images ?? []).find((i: any) => i.position === 1)?.src ??
        product.images?.[0]?.src ?? "";

      const description = product.body_html ? stripHtml(product.body_html) : "";

      const seenBase = new Set<string>();
      for (const variant of product.variants ?? []) {
        const raw: string = variant.sku ?? "";
        if (!raw) continue;

        const m = raw.match(SIZE_SUFFIX);
        const baseSku = m ? m[1] : raw;
        const baseKey = baseSku.toUpperCase();

        if (!seenBase.has(baseKey)) {
          seenBase.add(baseKey);
          const imageUrl = variantImageMap.get(variant.id) ?? defaultImage;
          if (imageUrl) skuImageMap.set(baseKey, imageUrl);
        }

        const mp = raw.match(MAIN_SKU_PREFIX);
        if (mp && description && !mainSkuDescMap.has(mp[1].toUpperCase())) {
          mainSkuDescMap.set(mp[1].toUpperCase(), description);
        }
      }
    }

    const items = await prisma.productLibrary.findMany({
      where: { OR: [{ h2uSku: { not: null } }, { mainSku: { not: null } }] },
      select: { id: true, h2uSku: true, mainSku: true },
    });

    let photosUpdated = 0;
    let descUpdated   = 0;
    let skipped       = 0;

    // Build all updates then run in parallel batches of 20
    const updates: Promise<any>[] = [];
    for (const item of items) {
      const baseKey = (item.h2uSku ?? "").toUpperCase();
      const mainKey = (item.mainSku ?? "").toUpperCase();
      const imageUrl    = skuImageMap.get(baseKey);
      const description = mainSkuDescMap.get(mainKey);

      const data: any = {};
      if (imageUrl)    { data.shoePhotoUrl = imageUrl;   photosUpdated++; }
      if (description) { data.description  = description; descUpdated++;  }

      if (Object.keys(data).length) {
        updates.push(prisma.productLibrary.update({ where: { id: item.id }, data }));
      } else {
        skipped++;
      }
    }

    // Execute in batches to avoid overwhelming the DB
    const BATCH = 20;
    for (let i = 0; i < updates.length; i += BATCH) {
      await Promise.all(updates.slice(i, i + BATCH));
    }

    return NextResponse.json({
      shopifyProducts: products.length,
      shopifySkus:     skuImageMap.size,
      photosUpdated,
      descUpdated,
      skipped,
    });
  } catch (err: any) {
    console.error("Shopify sync error:", err);
    return NextResponse.json({ error: err?.message ?? "Sync failed" }, { status: 500 });
  }
}
