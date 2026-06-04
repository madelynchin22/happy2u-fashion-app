import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET — no auth needed, one-time fix, safe to call multiple times
export async function GET() {
  const targets = ["S1491WUP", "S1491PKUP"];
  const results = [];

  for (const h2uSku of targets) {
    const item = await prisma.productLibrary.findFirst({ where: { h2uSku } });
    if (!item) { results.push({ h2uSku, error: "not found" }); continue; }

    await prisma.productLibrary.update({
      where: { id: item.id },
      data: {
        status: "active",
        sizeInventory: h2uSku === "S1491WUP"
          ? JSON.stringify({ "36": 1, "37": 0, "38": 2, "39": 5, "40": 5, "41": 7 })
          : undefined,
        availableSizes: h2uSku === "S1491WUP"
          ? JSON.stringify(["36", "37", "38", "39", "40", "41"])
          : undefined,
        inventoryTotal: h2uSku === "S1491WUP" ? 20 : undefined,
      },
    });

    results.push({ h2uSku, status: "active", fixed: true });
  }

  return NextResponse.json({ ok: true, results });
}
