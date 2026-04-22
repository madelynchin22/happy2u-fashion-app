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
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(samples);
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();

    // Auto-generate order number using SR- prefix for Sample Request
    const count = await prisma.sampleOrder.count();
    const orderNumber = generateOrderNumber("SR", count + 1);

    // Only pass known schema fields to avoid Prisma unknown field errors
    const {
      productName, brand, season, sampleSize, lastModel,
      dateSent, deadline, manufacturerId, colorName, colorCode,
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
        createdById: (session.user as any).id,
        productName: productName || "Sample",
        brand, season, sampleSize, lastModel,
        dateSent: dateSent ? new Date(dateSent) : null,
        deadline: deadline ? new Date(deadline) : null,
        manufacturerId,
        colorName, colorCode,
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
