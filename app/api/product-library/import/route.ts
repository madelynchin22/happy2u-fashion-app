import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

// Accepts JSON array from client-side Excel parse
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows: any[] = await req.json();
  if (!Array.isArray(rows)) return NextResponse.json({ error: "Expected JSON array" }, { status: 400 });

  const count = await prisma.productLibrary.count();
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.productName) continue;
    const libNumber = generateOrderNumber("PL", count + created + 1);
    await prisma.productLibrary.create({
      data: {
        libNumber,
        productName: String(r.productName ?? ""),
        h2uSku:       r.h2uSku       ? String(r.h2uSku)       : null,
        mainSku:      r.mainSku      ? String(r.mainSku)      : null,
        supplierSku:  r.supplierSku  ? String(r.supplierSku)  : null,
        brand:        r.brand        ? String(r.brand)        : null,
        category:     r.category     ? String(r.category)     : null,
        colorName:    r.colorName    ? String(r.colorName)    : null,
        colorCode:    r.colorCode    ? String(r.colorCode)    : null,
        season:       r.season       ? String(r.season)       : null,
        materialUpper:   r.materialUpper   ? String(r.materialUpper)   : null,
        materialLining:  r.materialLining  ? String(r.materialLining)  : null,
        materialMidsole: r.materialMidsole ? String(r.materialMidsole) : null,
        materialOutsole: r.materialOutsole ? String(r.materialOutsole) : null,
        hardware:     r.hardware     ? String(r.hardware)     : null,
        logoSpec:     r.logoSpec     ? String(r.logoSpec)     : null,
        heelSpec:     r.heelSpec     ? String(r.heelSpec)     : null,
        platformSpec: r.platformSpec ? String(r.platformSpec) : null,
        costRmb:      r.costRmb      ? parseFloat(r.costRmb)      : null,
        costRm:       r.costRm       ? parseFloat(r.costRm)       : null,
        sellingPrice: r.sellingPrice ? parseFloat(r.sellingPrice) : null,
        notes:        r.notes        ? String(r.notes)        : null,
      },
    });
    created++;
  }

  return NextResponse.json({ imported: created });
}
