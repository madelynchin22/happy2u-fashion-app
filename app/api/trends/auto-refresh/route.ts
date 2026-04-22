import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type ZaloraProduct = { name: string; brand: string; price: number; imageUrl: string };
type ZaloraData = { text: string; products: ZaloraProduct[] };

async function fetchZaloraProducts(): Promise<ZaloraProduct[]> {
  const params = new URLSearchParams({
    shop: "m", fullFacetCategory: "true", image_quality: "70",
    image_format: "webp", image_resize: "304x440",
    categoryId: "4", segment: "women", sort: "popularity",
    offset: "0", limit: "36",
  });
  const res = await fetch(`https://api.zalora.com.my/v1/dynproducts/datajet/list?${params}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/json",
      "Content-Language": "en-MY",
    },
  });
  if (!res.ok) return [];
  const json = await res.json();
  const raw: any[] = json?.data?.Products ?? [];
  return raw.slice(0, 30).map((p: any) => ({
    name: p.Name ?? "",
    brand: p.Brand ?? "",
    price: parseFloat(p.Price ?? p.SpecialPrice ?? "0"),
    imageUrl: p.MainImageUrl ?? p.ImageList?.[0] ?? "",
  })).filter(p => p.name && p.imageUrl);
}

// Scrape Zalora MY trending footwear page
async function scrapeZalora(): Promise<ZaloraData> {
  try {
    const products = await fetchZaloraProducts();
    if (products.length > 0) {
      const lines = products.map(p => `"name":"${p.name}","brand":"${p.brand}","price":"RM ${p.price}"`);
      return { text: `ZALORA MY TOP TRENDING FOOTWEAR (with images):\n${lines.join("\n")}`, products };
    }
    // Fallback: scrape HTML for text data only
    const res = await fetch("https://www.zalora.com.my/women/shoes/?sort=popularity", {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Happy2U/1.0)" },
    });
    const html = await res.text();
    const titleMatches = html.match(/"name"\s*:\s*"([^"]{5,80})"/g)?.slice(0, 40) ?? [];
    const priceMatches = html.match(/"price"\s*:\s*"([^"]{2,20})"/g)?.slice(0, 40) ?? [];
    return {
      text: `ZALORA MY TOP TRENDING FOOTWEAR:\n${titleMatches.join("\n")}\nPRICES:${priceMatches.join(" ")}`,
      products: [],
    };
  } catch {
    return { text: "Zalora data unavailable.", products: [] };
  }
}

async function scrapeZaloraTH(): Promise<string> {
  try {
    const res = await fetch(
      "https://www.zalora.co.th/women/shoes/?sort=popularity",
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; Happy2U/1.0)" }, next: { revalidate: 0 } }
    );
    const html = await res.text();
    const titleMatches = html.match(/"name"\s*:\s*"([^"]{5,80})"/g)?.slice(0, 30) ?? [];
    return `ZALORA TH TOP TRENDING FOOTWEAR:\n${titleMatches.join("\n")}`;
  } catch {
    return "Zalora TH data unavailable.";
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.startsWith("sk-ant-replace")) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 400 });
  }

  const [zaloraMy, zaloraTh] = await Promise.all([scrapeZalora(), scrapeZaloraTH()]);

  const productListText = zaloraMy.products.length
    ? `\nACTUAL ZALORA PRODUCTS WITH IMAGES (index:name:imageUrl):\n${zaloraMy.products.map((p, i) => `${i}|${p.name}|${p.brand}|RM${p.price}|${p.imageUrl}`).join("\n")}\n\nFor imageUrl: pick the index number of the most relevant product from the list above (e.g. "3" means use products[3].imageUrl). Or null if none match.\n`
    : "";

  const prompt = `You are a fashion trend analyst for Happy2U, a Malaysian women's footwear and bag brand.

Analyse the following scraped data from popular fashion marketplaces and identify the top trending items.

${zaloraMy.text}

${zaloraTh}
${productListText}
Today's date: ${new Date().toISOString().split("T")[0]}
Season: ${new Date().getMonth() >= 3 && new Date().getMonth() <= 8 ? "SS2026" : "AW2026"}

Based on this data, identify 8-12 specific fashion trends relevant for Happy2U (women's footwear: heels, flats, sandals, boots; and bags).

For each trend return a JSON object. Return ONLY a valid JSON array with no extra text:
[
  {
    "category": "color | material | accessory | silhouette | style",
    "title": "Short trend name (e.g. Butter Yellow Flats)",
    "description": "1-2 sentences why this is trending and who buys it",
    "market": "MY | TH | GLOBAL",
    "brand": "Brand name if specific, or null",
    "colorName": "Primary color name or null",
    "priceMin": 49,
    "priceMax": 189,
    "trendScore": 85,
    "season": "SS2026",
    "imageIndex": 3
  }
]

imageIndex must be an integer index from the ACTUAL ZALORA PRODUCTS list, or null.`;

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "";
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return NextResponse.json({ error: "AI did not return valid JSON" }, { status: 500 });

  const trends = JSON.parse(jsonMatch[0]);
  const now = new Date();
  const validUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Remove old auto-generated trends older than 7 days
  await prisma.trendItem.deleteMany({
    where: { isManual: false, scrapedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });

  const created = await Promise.all(
    trends.map((t: any, i: number) => {
      let imageUrl: string | null = null;
      if (typeof t.imageIndex === "number" && zaloraMy.products[t.imageIndex]) {
        imageUrl = zaloraMy.products[t.imageIndex].imageUrl;
      } else if (zaloraMy.products.length > 0) {
        // cycle through available Zalora images so every trend gets one
        imageUrl = zaloraMy.products[i % zaloraMy.products.length].imageUrl;
      }
      return prisma.trendItem.create({
        data: {
          category: t.category ?? "style",
          title: t.title,
          description: t.description,
          market: t.market ?? "MY",
          brand: t.brand ?? null,
          colorName: t.colorName ?? null,
          priceMin: t.priceMin ?? null,
          priceMax: t.priceMax ?? null,
          trendScore: t.trendScore ?? null,
          season: t.season ?? null,
          imageUrl,
          sourceName: "Auto (Zalora)",
          isManual: false,
          scrapedAt: now,
          validUntil,
        },
      });
    })
  );

  return NextResponse.json({ added: created.length });
}
