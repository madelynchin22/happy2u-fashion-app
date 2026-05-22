import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

const STORE = "https://shophappy2u.com";
const SIZE_SUFFIX = /^(.*?)(3[5-9]|4[0-2])$/;
const MAIN_SKU_RE = /^(S\d{4})/i;

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
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function mapCategory(productType: string): string {
  const t = productType.toLowerCase();
  if (t.includes("heel"))       return "heels";
  if (t.includes("flat"))       return "flats";
  if (t.includes("sandal"))     return "sandals";
  if (t.includes("boot"))       return "boots";
  if (t.includes("sneaker"))    return "sneakers";
  if (t.includes("wedge"))      return "wedges";
  if (t.includes("bag"))        return "bags";
  if (t.includes("accessor"))   return "accessories";
  if (t.includes("clearance"))  return "clearance";
  return t || "accessories";
}

// One entry per color variant (h2uSku = mainSku + colorCode, e.g. S1806BRS)
type ColorEntry = {
  productName:    string;
  vendor:         string;
  mainSku:        string;
  h2uSku:         string;
  colorCode:      string;
  colorName:      string;
  category:       string;
  productType:    string;
  sellingPrice:   number | null;
  compareAtPrice: number | null;
  shoePhotoUrl:   string;
  description:    string;
  sizeRange:      string;
  availableSizes: string; // JSON
  status:         string;
  tags:           string[];
};

function extractColorEntries(product: any): ColorEntry[] {
  const variantImageMap = new Map<number, string>();
  for (const img of product.images ?? []) {
    for (const vid of img.variant_ids ?? []) {
      if (!variantImageMap.has(vid)) variantImageMap.set(vid, img.src);
    }
  }
  const defaultImage: string = product.images?.[0]?.src ?? "";
  const description = product.body_html ? stripHtml(product.body_html) : "";
  const category    = mapCategory(product.product_type ?? "");
  const tags: string[] = product.tags ?? [];
  // Normalise vendor: collapse non-breaking spaces → regular space
  const vendor = (product.vendor ?? "Happy2U").replace(/ /g, " ").trim();

  // Group variants by color (baseSku = mainSku + colorCode)
  const byColor = new Map<string, { colorName: string; sizes: string[]; price: number | null; compareAt: number | null; imageUrl: string; available: boolean }>();

  for (const variant of product.variants ?? []) {
    const raw: string = variant.sku ?? "";
    if (!raw) continue;

    const m = raw.match(SIZE_SUFFIX);
    const baseSku   = (m ? m[1] : raw).toUpperCase();
    const size      = m ? m[2] : null;
    const colorName = variant.option1 ?? "";

    if (!byColor.has(baseSku)) {
      const imageUrl = variantImageMap.get(variant.id) ?? defaultImage;
      byColor.set(baseSku, { colorName, sizes: [], price: null, compareAt: null, imageUrl, available: false });
    }
    const entry = byColor.get(baseSku)!;
    if (size && !entry.sizes.includes(size)) entry.sizes.push(size);
    if (variant.available) entry.available = true;
    if (entry.price === null && variant.price) entry.price = parseFloat(variant.price);
    if (entry.compareAt === null && variant.compare_at_price) entry.compareAt = parseFloat(variant.compare_at_price);
  }

  const entries: ColorEntry[] = [];
  for (const [baseSku, data] of byColor.entries()) {
    const mainMatch = baseSku.match(MAIN_SKU_RE);
    const mainSku   = mainMatch ? mainMatch[1] : baseSku;
    const colorCode = baseSku.slice(mainSku.length);

    const sizes     = data.sizes.sort((a, b) => parseInt(a) - parseInt(b));
    const sizeRange = sizes.length ? `${sizes[0]}–${sizes[sizes.length - 1]}` : "";
    const isClearance = category === "clearance"
      || tags.some(t => /clearance/i.test(t));
    // Don't use Shopify's `available` flag for out_of_stock — that reflects online
    // purchase availability, not physical inventory. Inventory-based statuses
    // (out_of_stock / low_stock) are set by the Excel import instead.
    const status = isClearance ? "clearance" : "active";

    entries.push({
      productName:    product.title,
      vendor,
      mainSku,
      h2uSku:         baseSku,
      colorCode,
      colorName:      data.colorName,
      category,
      productType:    product.product_type ?? "",
      sellingPrice:   data.price,
      compareAtPrice: data.compareAt,
      shoePhotoUrl:   data.imageUrl,
      description,
      sizeRange,
      availableSizes: JSON.stringify(sizes),
      status,
      tags,
    });
  }
  return entries;
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const products = await fetchAllProducts();
    if (!products.length) {
      return NextResponse.json({ error: "Could not fetch products from shophappy2u.com" }, { status: 502 });
    }

    // Build map of all Shopify color entries keyed by h2uSku
    const shopifyMap = new Map<string, ColorEntry>();
    for (const product of products) {
      for (const entry of extractColorEntries(product)) {
        if (!shopifyMap.has(entry.h2uSku)) shopifyMap.set(entry.h2uSku, entry);
      }
    }

    // Get existing ProductLibrary entries
    const existing = await prisma.productLibrary.findMany({
      select: { id: true, h2uSku: true, libNumber: true, status: true },
    });
    const existingMap = new Map(existing.filter(e => e.h2uSku).map(e => [e.h2uSku!.toUpperCase(), e]));

    // Get current count for libNumber generation
    let libCount = await prisma.productLibrary.count();

    const toCreate: any[] = [];
    const toUpdate: { id: string; data: any }[] = [];

    for (const [h2uSku, entry] of shopifyMap.entries()) {
      const data = {
        productName:    entry.productName,
        mainSku:        entry.mainSku,
        h2uSku:         entry.h2uSku,
        colorCode:      entry.colorCode,
        colorName:      entry.colorName,
        category:       entry.category,
        productType:    entry.productType,
        sellingPrice:   entry.sellingPrice,
        compareAtPrice: entry.compareAtPrice,
        shoePhotoUrl:   entry.shoePhotoUrl || undefined,
        description:    entry.description || undefined,
        sizeRange:      entry.sizeRange || undefined,
        availableSizes: entry.availableSizes,
        status:         entry.status,
        brand:          entry.vendor,
      };

      if (existingMap.has(h2uSku)) {
        toUpdate.push({ id: existingMap.get(h2uSku)!.id, data });
      } else {
        libCount++;
        toCreate.push({ ...data, libNumber: generateOrderNumber("PL", libCount) });
      }
    }

    // Execute in batches of 20
    const BATCH = 20;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      await prisma.$transaction(
        toCreate.slice(i, i + BATCH).map(d => prisma.productLibrary.create({ data: d }))
      );
    }
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      await prisma.$transaction(
        toUpdate.slice(i, i + BATCH).map(({ id, data }) => prisma.productLibrary.update({ where: { id }, data }))
      );
    }

    // Products in DB with a h2uSku that Shopify no longer lists → archived
    // Exclude draft (not on Shopify yet) and already-archived entries
    const shopifySkus = new Set([...shopifyMap.keys()]);
    const toArchive = existing.filter(
      e => e.h2uSku
        && !shopifySkus.has(e.h2uSku.toUpperCase())
        && !["draft", "archived"].includes(e.status ?? "")
    );
    for (let i = 0; i < toArchive.length; i += BATCH) {
      await prisma.$transaction(
        toArchive.slice(i, i + BATCH).map(({ id }) =>
          prisma.productLibrary.update({ where: { id }, data: { status: "archived" } })
        )
      );
    }

    return NextResponse.json({
      shopifyProducts: products.length,
      shopifyColorVariants: shopifyMap.size,
      created: toCreate.length,
      updated: toUpdate.length,
      archived: toArchive.length,
    });
  } catch (err: any) {
    console.error("Shopify sync error:", err);
    return NextResponse.json({ error: err?.message ?? "Sync failed" }, { status: 500 });
  }
}
