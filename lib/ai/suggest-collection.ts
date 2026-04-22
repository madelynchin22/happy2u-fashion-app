import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type SuggestionItem = {
  productType: string;
  name: string;
  category: string;
  colorway: string;
  material: string;
  heelHeight?: string;
  hardware?: string;
  keyDesignElements: string;
  whyTrending: string;
  suggestedRetailRm: string;
  targetMarket: string;
  recommendedManufacturer?: string;
  priority: "high" | "medium" | "low";
};

export type AICollectionResult = {
  season: string;
  summary: string;
  suggestions: SuggestionItem[];
  generatedAt: string;
};

export async function suggestCollection({
  season,
  targetMarkets,
  trends,
  bestSellers,
  manufacturers,
  additionalNotes,
}: {
  season: string;
  targetMarkets: string[];
  trends: any[];
  bestSellers: any[];
  manufacturers: any[];
  additionalNotes?: string;
}): Promise<AICollectionResult> {
  const trendsText = trends.length > 0
    ? trends.map(t =>
        `- [${t.category.toUpperCase()}] ${t.title}${t.market ? ` (${t.market})` : ""}${t.rankPosition ? ` — Rank #${t.rankPosition}` : ""}${t.salesData ? ` — ${t.salesData}` : ""}${t.description ? `: ${t.description}` : ""}`
      ).join("\n")
    : "No trend data entered yet — base suggestions on general SE Asian market knowledge for women's footwear and bags.";

  const sellersText = bestSellers.length > 0
    ? bestSellers.map(b =>
        `- ${b.productName}${b.category ? ` (${b.category})` : ""}${b.colorName ? `, ${b.colorName}` : ""}${b.material ? `, ${b.material}` : ""}${b.unitsSold ? ` — ${b.unitsSold} units sold` : ""}${b.revenueRm ? `, RM${b.revenueRm} revenue` : ""}${b.season ? ` [${b.season}]` : ""}`
      ).join("\n")
    : "No past best seller data entered yet.";

  const mfrText = manufacturers.length > 0
    ? manufacturers.map(m =>
        `- ${m.name}${m.nameEn ? ` (${m.nameEn})` : ""}: ${m.materials ?? "general footwear"}${m.moq ? `, MOQ ${m.moq}` : ""}${m.leadTimeDays ? `, ${m.leadTimeDays}d lead time` : ""}`
      ).join("\n")
    : "Manufacturers not specified.";

  const prompt = `You are a senior fashion buyer and collection planner for Happy2U, a Malaysian women's footwear and bag brand.
The brand sells in Malaysia (main market) and Thailand, with price-conscious but fashion-forward customers.
Products are manufactured in China and sold online and offline.

Your task is to suggest a product collection for the ${season} season.

TARGET MARKETS: ${targetMarkets.join(", ")}

CURRENT FASHION TRENDS (from research):
${trendsText}

HAPPY2U PAST BEST SELLERS:
${sellersText}

AVAILABLE MANUFACTURERS & CAPABILITIES:
${mfrText}

${additionalNotes ? `ADDITIONAL NOTES FROM BUYER:\n${additionalNotes}\n` : ""}

Please suggest 8-12 products for the ${season} collection. Mix of footwear and bags.
For each product, provide a JSON object. Return ONLY a valid JSON array with no extra text:

[
  {
    "productType": "heels/flats/sandals/boots/bag/accessory",
    "name": "Descriptive product name",
    "category": "heels/flats/sandals/boots/bags/shoe_care/keychain",
    "colorway": "Primary color and any secondary colors (e.g. Beige, Black, Dusty Pink)",
    "material": "Upper material and key construction details",
    "heelHeight": "e.g. 7cm block heel (only for heels/wedges, otherwise omit)",
    "hardware": "Buckle/strap/zipper details if relevant",
    "keyDesignElements": "2-3 key design features that make this sellable",
    "whyTrending": "Specific reason tied to the trend data above",
    "suggestedRetailRm": "e.g. RM 89 - RM 109",
    "targetMarket": "MY / TH / Both",
    "recommendedManufacturer": "Manufacturer name from the list, or null",
    "priority": "high/medium/low"
  }
]`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text : "";

  // Extract JSON from response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");

  const suggestions: SuggestionItem[] = JSON.parse(jsonMatch[0]);

  // Build a summary
  const summaryMsg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `In 2-3 sentences, summarize the key themes of this ${season} collection for Happy2U (Malaysian women's footwear brand): ${suggestions.map(s => s.name).join(", ")}`,
    }],
  });

  const summary = summaryMsg.content[0].type === "text" ? summaryMsg.content[0].text : "";

  return {
    season,
    summary,
    suggestions,
    generatedAt: new Date().toISOString(),
  };
}
