import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchShopifyProducts(rawUrl: string) {
  const base = (rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).replace(/\/$/, "");
  const all: any[] = [];
  let page = 1;

  while (page <= 20) {
    const url = `${base}/products.json?limit=50&page=${page}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
    });
    if (!res.ok) break;
    const json = await res.json();
    const batch: any[] = json.products ?? [];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 50) break;
    page++;
  }
  return all;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const competitor = await prisma.competitor.findUnique({ where: { id: params.id } });
  if (!competitor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let shopifyProducts: any[];
  try {
    shopifyProducts = await fetchShopifyProducts(competitor.url);
  } catch (err: any) {
    return NextResponse.json({ error: `Fetch failed: ${err.message}` }, { status: 500 });
  }

  if (!shopifyProducts.length) {
    return NextResponse.json({ error: `No products returned from ${competitor.url}/products.json` }, { status: 422 });
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
      productUrl: `${competitor.url.replace(/\/$/, "")}/products/${p.handle}`,
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
