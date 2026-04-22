export type RawProduct = {
  externalId: string;
  name: string;
  handle: string;
  productUrl: string;
  imageUrl: string;
  priceMin: number;
  priceMax: number;
  colors: string[];
  productType: string;
  isAvailable: boolean;
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function parseShopifyProducts(data: any, base: string): RawProduct[] {
  const products: RawProduct[] = [];
  for (const p of (data.products ?? [])) {
    const variants = p.variants ?? [];
    const prices = variants.map((v: any) => parseFloat(v.price)).filter((n: number) => !isNaN(n) && n > 0);
    const available = variants.some((v: any) => v.available !== false);
    const colorOption = (p.options ?? []).find((o: any) => /color|colour|warna/i.test(o.name));
    products.push({
      externalId: String(p.id),
      name: p.title,
      handle: p.handle ?? "",
      productUrl: `${base}/products/${p.handle}`,
      imageUrl: p.images?.[0]?.src ?? "",
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,
      colors: colorOption?.values ?? [],
      productType: p.product_type ?? "",
      isAvailable: available,
    });
  }
  return products;
}

// Strategy 1: Shopify /products.json — page through in batches of 50
async function tryShopifyJson(base: string): Promise<RawProduct[]> {
  const allProducts: RawProduct[] = [];
  let page = 1;
  const limit = 50;

  while (true) {
    const url = `${base}/products.json?limit=${limit}&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept": "application/json, */*" },
        cache: "no-store",
        redirect: "follow",
      });
      if (!res.ok) break;
      const data = await res.json();
      const batch = parseShopifyProducts(data, base);
      if (batch.length === 0) break;
      allProducts.push(...batch);
      if (batch.length < limit) break;
      page++;
    } catch {
      break;
    }
  }

  // If page 1 failed, try collections/all
  if (allProducts.length === 0) {
    try {
      const res = await fetch(`${base}/collections/all/products.json?limit=${limit}`, {
        headers: { "User-Agent": UA, "Accept": "application/json, */*" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        allProducts.push(...parseShopifyProducts(data, base));
      }
    } catch {}
  }

  return allProducts;
}

// Strategy 2: Parse JSON-LD / script tags embedded in HTML
async function tryHtmlScrape(base: string): Promise<RawProduct[]> {
  const products: RawProduct[] = [];

  // Try to find collection/shop page
  const pagesToTry = [`${base}/collections/all`, `${base}/shop`, `${base}/products`, base];

  for (const pageUrl of pagesToTry) {
    try {
      const res = await fetch(pageUrl, {
        headers: { "User-Agent": UA, "Accept": "text/html" },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const html = await res.text();

      // Try to extract Shopify embedded JSON (window.ShopifyAnalytics or similar)
      const shopifyJson = html.match(/var\s+meta\s*=\s*(\{[\s\S]{0,5000}?\});/);
      if (shopifyJson) {
        try {
          const meta = JSON.parse(shopifyJson[1]);
          if (meta?.product) {
            const p = meta.product;
            products.push({
              externalId: String(p.id ?? Math.random()),
              name: p.title ?? "Unknown",
              handle: p.handle ?? "",
              productUrl: pageUrl,
              imageUrl: p.featured_image ?? "",
              priceMin: p.price ? p.price / 100 : 0,
              priceMax: p.price ? p.price / 100 : 0,
              colors: [],
              productType: p.type ?? "",
              isAvailable: p.available ?? true,
            });
          }
        } catch {}
      }

      // Parse JSON-LD structured data
      const jsonLdMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      for (const match of jsonLdMatches) {
        try {
          const json = JSON.parse(match[1]);
          const items = Array.isArray(json) ? json : [json];
          for (const item of items) {
            if (item["@type"] === "Product" && item.name) {
              const offer = item.offers;
              const price = parseFloat(offer?.price ?? offer?.lowPrice ?? 0);
              products.push({
                externalId: item.sku ?? item.productID ?? String(Math.random()),
                name: item.name,
                handle: "",
                productUrl: item.url ?? pageUrl,
                imageUrl: Array.isArray(item.image) ? item.image[0] : (item.image ?? ""),
                priceMin: price,
                priceMax: parseFloat(offer?.highPrice ?? 0) || price,
                colors: [],
                productType: item.category ?? "",
                isAvailable: offer?.availability !== "https://schema.org/OutOfStock",
              });
            }
            // ItemList with products
            if (item["@type"] === "ItemList" && item.itemListElement) {
              for (const el of item.itemListElement) {
                const prod = el.item ?? el;
                if (prod["@type"] === "Product" || prod.name) {
                  const offer = prod.offers;
                  const price = parseFloat(offer?.price ?? offer?.lowPrice ?? 0);
                  products.push({
                    externalId: prod.sku ?? prod.productID ?? String(Math.random()),
                    name: prod.name ?? "Product",
                    handle: "",
                    productUrl: prod.url ?? pageUrl,
                    imageUrl: Array.isArray(prod.image) ? prod.image[0] : (prod.image ?? ""),
                    priceMin: price,
                    priceMax: parseFloat(offer?.highPrice ?? 0) || price,
                    colors: [],
                    productType: prod.category ?? "",
                    isAvailable: offer?.availability !== "https://schema.org/OutOfStock",
                  });
                }
              }
            }
          }
        } catch {}
      }

      if (products.length > 0) return products;
    } catch {}
  }

  return products;
}

export async function crawlShopify(baseUrl: string): Promise<RawProduct[]> {
  const base = baseUrl.replace(/\/$/, "");

  // Try Shopify JSON first
  const jsonProducts = await tryShopifyJson(base);
  if (jsonProducts.length > 0) return jsonProducts;

  // Fall back to HTML scraping
  const htmlProducts = await tryHtmlScrape(base);
  return htmlProducts;
}

export async function crawlCompetitor(url: string, _platform: string): Promise<RawProduct[]> {
  // Always try all methods regardless of platform setting
  return crawlShopify(url);
}
