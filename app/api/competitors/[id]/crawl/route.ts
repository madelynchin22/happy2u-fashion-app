import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchText(url: string, timeoutMs = 15000): Promise<{ text: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, "Accept": "text/html,application/json,*/*", "Accept-Language": "en-MY,en;q=0.9" },
      redirect: "follow",
    });
    return { text: await res.text(), finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

// ── Strategy detection ────────────────────────────────────────────────────────

function detectStrategy(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("charleskeith.com")) return "charleskeith";
  if (u.includes("bata.com"))         return "bata";
  if (u.includes("padini.com"))       return "padini";
  return "shopify"; // default — will try /products.json
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseBase(rawUrl: string): string[] {
  const withScheme = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const base       = withScheme.replace(/\/$/, "");
  const noWww      = base.replace("://www.", "://");
  const withWww    = base.includes("://www.") ? base : base.replace("://", "://www.");
  return [...new Set([base, withWww, noWww])];
}

type ScrapedProduct = {
  externalId: string; name: string; handle: string; productUrl: string;
  imageUrl: string; priceMin: number; priceMax: number;
  colors: string; productType: string; isAvailable: boolean;
};

// ── Shopify scraper ───────────────────────────────────────────────────────────

async function scrapeShopify(rawUrl: string): Promise<{ products: ScrapedProduct[]; resolvedBase: string }> {
  const bases = normaliseBase(rawUrl);
  let lastError = "Could not connect";

  for (const base of bases) {
    const url = `${base}/products.json?limit=250&page=1`;
    try {
      const { text } = await fetchText(url);
      if (!text.trim().startsWith("{")) {
        if (text.includes("Just a moment") || text.includes("cf-browser-verification")) {
          throw new Error(`Cloudflare is blocking requests to ${base}`);
        }
        throw new Error(`${base} returned HTML — may not be a Shopify store`);
      }
      const json = JSON.parse(text);
      if (!Array.isArray(json.products)) throw new Error(`${base}/products.json has no products array`);

      // Paginate
      const all: any[] = [...json.products];
      let page = 2;
      while (all.length % 250 === 0 && page <= 20) {
        const { text: pt } = await fetchText(`${base}/products.json?limit=250&page=${page}`);
        const pj = JSON.parse(pt);
        const batch: any[] = pj.products ?? [];
        if (!batch.length) break;
        all.push(...batch);
        page++;
      }

      const products: ScrapedProduct[] = all.map((p: any) => {
        const variants: any[] = p.variants ?? [];
        const prices = variants.map((v: any) => parseFloat(v.price)).filter(Boolean);
        const colorOpt = (p.options ?? []).find((o: any) => /color|colour|warna/i.test(o.name));
        return {
          externalId: String(p.id),
          name: p.title,
          handle: p.handle ?? "",
          productUrl: `${base}/products/${p.handle}`,
          imageUrl: p.images?.[0]?.src ?? "",
          priceMin: prices.length ? Math.min(...prices) : 0,
          priceMax: prices.length ? Math.max(...prices) : 0,
          colors: JSON.stringify(colorOpt?.values ?? []),
          productType: p.product_type ?? "",
          isAvailable: variants.some((v: any) => v.available !== false),
        };
      });
      return { products, resolvedBase: base };
    } catch (err: any) {
      if (err.name === "AbortError") { lastError = `Timed out on ${url}`; continue; }
      throw err;
    }
  }
  throw new Error(lastError);
}

// ── Charles & Keith scraper ───────────────────────────────────────────────────
// Uses data-ga analytics attributes which embed product name/price/category as JSON

async function scrapeCharlesKeith(): Promise<ScrapedProduct[]> {
  const crawlPages = [
    "https://www.charleskeith.com/my/new-arrivals/shoes",
    "https://www.charleskeith.com/my/new-arrivals/bags",
    "https://www.charleskeith.com/my/shoes",
    "https://www.charleskeith.com/my/bags",
  ];
  const seen = new Set<string>();
  const products: ScrapedProduct[] = [];

  for (const page of crawlPages) {
    try {
      const { text } = await fetchText(page);
      const gaMatches = [...text.matchAll(/data-ga="(\{[^"]*(?:&quot;[^"]*)*}?)"/g)];
      // Also extract pid→image mapping
      const pidImgMap: Record<string, string> = {};
      const pidImgMatches = [...text.matchAll(/data-pid="(CK[^"]+)"[\s\S]{0,800}?src="(https:\/\/www\.charleskeith\.com\/on\/demandware\.static[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/g)];
      for (const m of pidImgMatches) {
        if (!pidImgMap[m[1]]) pidImgMap[m[1]] = m[2];
      }

      for (const m of gaMatches) {
        const raw = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&");
        try {
          const d = JSON.parse(raw);
          if (!d.item_id) continue;
          if (seen.has(d.item_id)) continue;
          seen.add(d.item_id);
          const price = parseFloat(d.price) || 0;
          const baseId = d.item_id.replace(/_[A-Z]+$/, "").toLowerCase();
          products.push({
            externalId: d.item_id,
            name: d.item_name ?? d.item_id,
            handle: d.item_id.toLowerCase(),
            productUrl: `https://www.charleskeith.com/my/products/${baseId}`,
            imageUrl: pidImgMap[d.item_id] ?? "",
            priceMin: price, priceMax: price,
            colors: JSON.stringify([]),
            productType: d.item_category2 ?? d.item_category ?? "shoes",
            isAvailable: true,
          });
        } catch {}
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("CK page error:", page, err.message);
    }
  }
  return products;
}

// ── Bata scraper ──────────────────────────────────────────────────────────────
// Uses Constructor.io data-cnstrc-* attributes embedded in the listing HTML

async function scrapeBata(): Promise<ScrapedProduct[]> {
  const crawlPages = [
    "https://www.bata.com/my/women/shoes/",
    "https://www.bata.com/my/women/sandals/",
    "https://www.bata.com/my/women/sneakers/",
    "https://www.bata.com/my/new-arrivals/",
  ];
  const seen = new Set<string>();
  const products: ScrapedProduct[] = [];

  for (const page of crawlPages) {
    try {
      const { text } = await fetchText(page);
      const itemMatches = [...text.matchAll(
        /data-cnstrc-item-variation-id="([^"]+)"[\s\S]{0,100}?data-cnstrc-item-price="([^"]+)"/g
      )];

      for (const m of itemMatches) {
        const sku = m[1];
        const price = parseFloat(m[2]) || 0;
        if (seen.has(sku)) continue;
        seen.add(sku);

        const idx = text.indexOf(`data-cnstrc-item-variation-id="${sku}"`);
        const ctx = text.slice(Math.max(0, idx - 50), idx + 1200);
        const urlM  = ctx.match(/href="(\/my\/[^"]+\.html)"/);
        const nameM = ctx.match(/aria-label="([^"]+)"/);
        const imgM  = ctx.match(/src="(https:\/\/www\.bata\.com\/dw\/image[^"]+)"/);

        products.push({
          externalId: sku,
          name: nameM?.[1] ?? sku,
          handle: sku.toLowerCase(),
          productUrl: urlM ? `https://www.bata.com${urlM[1]}` : page,
          imageUrl: imgM?.[1] ?? "",
          priceMin: price, priceMax: price,
          colors: JSON.stringify([]),
          productType: "shoes",
          isAvailable: true,
        });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("Bata page error:", page, err.message);
    }
  }
  return products;
}

// ── Padini/Vincci scraper ─────────────────────────────────────────────────────
// Magento store. Price is in jsonConfig JSON (~2000 chars after product link).
// Name is in the img alt attribute right after the link. Image URL is also there.

async function scrapePadini(rawUrl: string): Promise<ScrapedProduct[]> {
  const baseUrl = rawUrl.includes("padini.com") ? rawUrl.replace(/\/$/, "") : "https://www.padini.com/vincci";
  const seen = new Set<string>();
  const products: ScrapedProduct[] = [];

  for (let p = 1; p <= 10; p++) {
    try {
      const { text } = await fetchText(`${baseUrl}?p=${p}`);

      // Split into per-product blocks using <li class="item product product-item"> as separator
      const blocks = text.split(/<li\s[^>]*class="[^"]*product-item[^"]*"/g).slice(1);
      if (blocks.length === 0) break;

      for (const block of blocks) {
        // Product URL — must be a padini.com product page (not deals/brands)
        const urlM = block.match(/href="(https:\/\/www\.padini\.com\/(?!deals|brands|en\/)[^"]+\.html)"/);
        if (!urlM) continue;
        const productUrl = urlM[1];

        const slug = productUrl.split("/").pop()?.replace(".html", "") ?? "";
        const parts = slug.split("-");
        const externalId = parts[parts.length - 1]; // e.g. vi20506586
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        // Product name from img alt attribute (most reliable source)
        const nameM = block.match(/alt="([^"]+)"/);
        const name  = nameM?.[1] ?? parts.slice(1, -1).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");

        // Image URL — first media/catalog image in the block
        const imgM = block.match(/src="(https:\/\/www\.padini\.com\/media\/catalog\/product\/[^"]+\.jpg[^"]*)"/);

        // Price from Magento jsonConfig: "finalPrice":{"amount":49}
        const priceM = block.match(/"finalPrice"\s*:\s*\{"amount"\s*:\s*([\d.]+)\}/);
        const price  = parseFloat(priceM?.[1] ?? "0") || 0;

        // isAvailable: check if "salable" is non-empty or "Out of Stock" not present
        const outOfStock = block.includes("Out of Stock") || block.includes("out-of-stock");

        products.push({
          externalId,
          name,
          handle: slug,
          productUrl,
          imageUrl: imgM?.[1] ?? "",
          priceMin: price,
          priceMax: price,
          colors: JSON.stringify([]),
          productType: "shoes",
          isAvailable: !outOfStock,
        });
      }

      // If fewer blocks than expected, we've reached the last page
      if (blocks.length < 20) break;
    } catch (err: any) {
      if (err.name !== "AbortError") console.error("Padini page error:", p, err.message);
      break;
    }
  }
  return products;
}

// ── Main POST handler ─────────────────────────────────────────────────────────

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competitor = await prisma.competitor.findUnique({ where: { id: (await params).id } });
  if (!competitor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let scrapedProducts: ScrapedProduct[];
  let resolvedBase = competitor.url;

  try {
    const strategy = detectStrategy(competitor.url);
    if (strategy === "charleskeith") {
      scrapedProducts = await scrapeCharlesKeith();
    } else if (strategy === "bata") {
      scrapedProducts = await scrapeBata();
    } else if (strategy === "padini") {
      scrapedProducts = await scrapePadini(competitor.url);
    } else {
      const result = await scrapeShopify(competitor.url);
      scrapedProducts = result.products;
      resolvedBase = result.resolvedBase;
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  if (!scrapedProducts.length) {
    return NextResponse.json({ error: `Connected but found 0 products from ${competitor.url}` }, { status: 422 });
  }

  let newCount = 0, restockCount = 0;
  const seenIds: string[] = [];

  for (const p of scrapedProducts) {
    seenIds.push(p.externalId);
    const existing = await prisma.competitorProduct.findUnique({
      where: { competitorId_externalId: { competitorId: competitor.id, externalId: p.externalId } },
    });
    if (!existing) {
      await prisma.competitorProduct.create({ data: { competitorId: competitor.id, ...p, isNew: true, wasRestocked: false } });
      newCount++;
    } else {
      const isRestock = !existing.isAvailable && p.isAvailable;
      await prisma.competitorProduct.update({
        where: { id: existing.id },
        data: {
          ...p,
          imageUrl: p.imageUrl || existing.imageUrl,
          wasRestocked: isRestock || existing.wasRestocked,
          restockedAt: isRestock ? new Date() : existing.restockedAt,
          lastSeenAt: new Date(),
          isNew: existing.isNew && (Date.now() - existing.firstSeenAt.getTime()) < 8 * 86400000,
        },
      });
      if (isRestock) restockCount++;
    }
  }

  if (seenIds.length > 0) {
    await prisma.competitorProduct.updateMany({
      where: { competitorId: competitor.id, externalId: { notIn: seenIds } },
      data: { isAvailable: false },
    });
  }

  await prisma.competitor.update({ where: { id: competitor.id }, data: { lastCrawledAt: new Date() } });
  return NextResponse.json({ total: scrapedProducts.length, newProducts: newCount, restocks: restockCount });
}
