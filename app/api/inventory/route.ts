import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get("outletId");
  const search = searchParams.get("search") ?? "";

  const where: any = {};
  if (outletId) where.outletId = outletId;
  if (search) {
    where.productLibrary = {
      OR: [
        { h2uSku: { contains: search } },
        { supplierSku: { contains: search } },
        { productName: { contains: search } },
      ],
    };
  }

  const rows = await prisma.locationInventory.findMany({
    where,
    include: {
      productLibrary: {
        select: { id: true, productName: true, h2uSku: true, mainSku: true, colorCode: true, supplierSku: true, category: true, colorName: true, status: true },
      },
      outlet: { select: { id: true, name: true, marking: true, country: true } },
    },
    orderBy: [{ productLibrary: { mainSku: "asc" } }, { productLibrary: { colorCode: "asc" } }],
  });

  return NextResponse.json(rows);
}
