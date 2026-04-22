import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function tryFetch(url: string, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
      },
      redirect: "follow",
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Fallback: fetch via allorigins proxy to bypass Cloudflare/IP blocks */
async function tryFetchViaProxy(url: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    const wrapper = await res.json();
    const body: string = wrapper.contents ?? "";
    // Reconstruct a fake Response with the proxied body
    return new Response(body, {
      status: wrapper.status?.http_code ?? 200,
      headers: { "content-type": "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function normaliseBase(rawUrl: string): string[] {
  // Returns candidate base URLs to try, no trailing slash
  const withScheme = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  const base = withScheme.replace(/\/$/, "");
  const withoutWww = base.replace("://www.", "://");
  const withWww    = base.includes("://www.") ? base : base.replace("://", "://www.");
  // Deduplicate
  return [...new Set([base, withWww, withoutWww])];
}

async function fetchProductsJson(url: string): Promise<any> {
  // 1. Try direct fetch first
  try {
    const res = await tryFetch(url);
    if (res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("json")) {
        const json = await res.json();
        if (json.products) return json;
      } else {
        const text = await res.text();
        // Cloudflare or bot wall — fall through to proxy
        if (!text.includes("Just a moment") && !text.includes("cf-browser-verification")) {
          // Not Cloudflare — real non-JSON response, give up
          throw new Error(`${url} returned HTML. The site may not support /products.json`);
        }
      }
    }
  } catch (err: any) {
    if (err.name !== "AbortError" && !err.message.includes("fetch failed")) throw err;
  }

  // 2. Fallback: route through allorigins proxy
  try {
    const res = await tryFetchViaProxy(url);
    const text = await res.text();
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      throw new Error(`Proxy returned non-JSON from ${url}`);
    }
    const json = JSON.parse(text);
    if (json.products) return json;
  } catch (err: any) {
    throw new Error(`Direct and proxy fetch both failed for ${url}: ${err.message}`);
  }

  throw new Error(`No products found at ${url}`);
}

async function fetchShopifyProducts(rawUrl: string) {
  const bases = normaliseBase(rawUrl);
  let lastError = "Unknown error";

  for (const base of bases) {
    const url = `${base}/products.json?limit=250&page=1`;
    try {
      const json = await fetchProductsJson(url);

      // Paginate
      const all: any[] = [...json.products];
      let page = 2;
      while (all.length % 250 === 0 && page <= 20) {
        const pageUrl = `${base}/products.json?limit=250&page=${page}`;
        try {
          const pageJson = await fetchProductsJson(pageUrl);
          const batch: any[] = pageJson.products ?? [];
          if (!batch.length) break;
          all.push(...batch);
          page++;
        } catch { break; }
      }

      return { products: all, resolvedBase: base };
    } catch (err: any) {
      lastError = err.message;
    }
  }
  throw new Error(lastError);
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competitor = await prisma.competitor.findUnique({ where: { id: (await params).id } });
  if (!competitor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let shopifyProducts: any[];
  let resolvedBase: string;
  try {
    const result = await fetchShopifyProducts(competitor.url);
    shopifyProducts = result.products;
    resolvedBase = result.resolvedBase;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  if (!shopifyProducts.length) {
    return NextResponse.json({
      error: `Connected successfully but got 0 products from ${competitor.url}/products.json. The catalogue may be empty or hidden.`,
    }, { status: 422 });
  }

  let newCount = 0;
  let restockCount = 0;
  const seenIds: string[] = [];

  for (const p of shopifyProducts) {
    const variants: any[] = p.variants ?? [];
    const prices = variants.map((v: any) => parseFloat(v.price)).filter((n: number) => n > 0);
    const available = variants.some((v: any) => v.available !== false);
    const colorOpt = (p.options ?? []).find((o: any) => /color|colour|warna/i.test(o.name));

    const externalId = String(p.id);
    seenIds.push(externalId);

    const product = {
      name: p.title as string,
      handle: (p.handle ?? "") as string,
      productUrl: `${resolvedBase}/products/${p.handle}`,
      imageUrl: (p.images?.[0]?.src ?? "") as string,
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,
      colors: JSON.stringify(colorOpt?.values ?? []),
      productType: (p.product_type ?? "") as string,
      isAvailable: available,
    };

    const existing = await prisma.competitorProduct.findUnique({
      where: { competitorId_externalId: { competitorId: competitor.id, externalId } },
    });

    if (!existing) {
      await prisma.competitorProduct.create({
        data: { competitorId: competitor.id, externalId, ...product, isNew: true, wasRestocked: false },
      });
      newCount++;
    } else {
      const isRestock = !existing.isAvailable && available;
      await prisma.competitorProduct.update({
        where: { id: existing.id },
        data: {
          ...product,
          imageUrl: product.imageUrl || existing.imageUrl,
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

  await prisma.competitor.update({
    where: { id: competitor.id },
    data: { lastCrawledAt: new Date() },
  });

  return NextResponse.json({ total: shopifyProducts.length, newProducts: newCount, restocks: restockCount });
}
