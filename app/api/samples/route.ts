import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const samples = await prisma.sampleOrder.findMany({
    where: { ...(status ? { status } : {}), parentId: null },
    include: {
      manufacturer: { select: { id: true, name: true } },
      children: { select: { id: true, version: true, status: true } },
      productLibraries: { select: { id: true, mainSku: true, productName: true, status: true, colorName: true, colorCode: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });

  // For samples with a Main SKU, fetch all sibling ProductLibrary colours (the lib is source of truth)
  const mainSkus = [...new Set(samples.map(s => s.productLibraries[0]?.mainSku).filter(Boolean))] as string[];
  let skuColourMap: Record<string, { colorName: string | null; colorCode: string | null }[]> = {};
  if (mainSkus.length > 0) {
    const libRows = await prisma.productLibrary.findMany({
      where: { mainSku: { in: mainSkus } },
      select: { mainSku: true, colorName: true, colorCode: true },
      orderBy: { createdAt: "asc" },
    });
    for (const row of libRows) {
      if (!row.mainSku) continue;
      if (!skuColourMap[row.mainSku]) skuColourMap[row.mainSku] = [];
      skuColourMap[row.mainSku].push({ colorName: row.colorName, colorCode: row.colorCode });
    }
  }

  const enriched = samples.map(s => {
    const mainSku = s.productLibraries[0]?.mainSku;
    return { ...s, libColours: mainSku ? (skuColourMap[mainSku] ?? null) : null };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();

    // Auto-generate order number using SR- prefix for Sample Request
    const count = await prisma.sampleOrder.count();
    const orderNumber = generateOrderNumber("SR", count + 1);

    // Resolve user ID by email to avoid stale JWT issues after DB resets
    const dbUser = await prisma.user.findUnique({ where: { email: session.user!.email! } });
    const createdById = dbUser?.id ?? null;

    // Only pass known schema fields to avoid Prisma unknown field errors
    const {
      productName, brand, season, sampleSize, lastModel,
      dateSent, deadline, manufacturerId, mainSku, colorName, colorCode, colorVariants,
      materialUpper, materialUpperRemark, materialUpperPhoto,
      materialLining, materialLiningRemark, materialLiningPhoto,
      materialMidsole, materialMidsoleRemark, materialMidsolePhoto,
      materialOutsole, materialOutsoleRemark, materialOutsolePhoto,
      hardware, hardwareRemark, hardwarePhoto,
      heelSpec, heelSpecRemark, heelSpecPhoto,
      platformSpec, platformSpecRemark, platformSpecPhoto,
      logoSpec, logoSpecRemark, logoSpecPhoto,
      photoSideUrl, photoBackUrl, photoFrontUrl, photoPlatformUrl, photoHeelUrl,
      notesA, notesB, notesC, notesD, notesE,
      generalNotes, amendmentNotes, designSource, ipNotes,
    } = data;

    const sample = await prisma.sampleOrder.create({
      data: {
        orderNumber,
        createdById,
        productName: productName || "Sample",
        brand, season, sampleSize, lastModel,
        dateSent: dateSent ? new Date(dateSent) : null,
        deadline: deadline ? new Date(deadline) : null,
        manufacturerId,
        mainSku: mainSku ?? null, colorName, colorCode, colorVariants: colorVariants ?? null,
        materialUpper, materialUpperRemark, materialUpperPhoto,
        materialLining, materialLiningRemark, materialLiningPhoto,
        materialMidsole, materialMidsoleRemark, materialMidsolePhoto,
        materialOutsole, materialOutsoleRemark, materialOutsolePhoto,
        hardware, hardwareRemark, hardwarePhoto,
        heelSpec, heelSpecRemark, heelSpecPhoto,
        platformSpec, platformSpecRemark, platformSpecPhoto,
        logoSpec, logoSpecRemark, logoSpecPhoto,
        photoSideUrl, photoBackUrl, photoFrontUrl, photoPlatformUrl, photoHeelUrl,
        notesA, notesB, notesC, notesD, notesE,
        generalNotes, amendmentNotes, designSource, ipNotes,
      },
    });
    return NextResponse.json(sample, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/samples error:", err);
    return NextResponse.json({ error: err?.message ?? "Server error" }, { status: 500 });
  }
}
