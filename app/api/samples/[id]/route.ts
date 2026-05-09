import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sample = await prisma.sampleOrder.findUnique({
    where: { id: (await params).id },
    include: {
      manufacturer: true,
      collection: true,
      parent: { select: { id: true, orderNumber: true, version: true } },
      children: { select: { id: true, orderNumber: true, version: true, status: true } },
      productLibraries: { select: { id: true, mainSku: true, productName: true, status: true }, take: 1 },
    },
  });
  if (!sample) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sample);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = (await params).id;
    const raw = await req.json();

    // Explicitly pick and sanitize known fields to avoid Prisma unknown field errors
    const data: Record<string, any> = {};

    const strFields = [
      "status", "brand", "season", "sampleSize", "lastModel", "productName", "productNumber",
      "manufacturerId", "collectionId", "supplierSku", "h2uSku", "mainSku",
      "colorName", "colorCode",
      "materialUpper", "materialUpperRemark", "materialUpperPhoto",
      "materialLining", "materialLiningRemark", "materialLiningPhoto",
      "materialMidsole", "materialMidsoleRemark", "materialMidsolePhoto",
      "materialOutsole", "materialOutsoleRemark", "materialOutsolePhoto",
      "hardware", "hardwareRemark", "hardwarePhoto",
      "heelSpec", "heelSpecRemark", "heelSpecPhoto",
      "platformSpec", "platformSpecRemark", "platformSpecPhoto",
      "logoSpec", "logoSpecRemark", "logoSpecPhoto",
      "photoSideUrl", "photoBackUrl", "photoFrontUrl", "photoPlatformUrl", "photoHeelUrl",
      "notesA", "notesB", "notesC", "notesD", "notesE",
      "generalNotes", "amendmentNotes", "designSource", "ipNotes",
      "receivedRemark",
      "trackingNumber", "courierCompany",
      "category", "sizesOffered", "colorVariants", "trendInspiration",
      "predecessorSku", "predecessorLesson", "launchType",
    ];

    const dateFields = ["dateSent", "deadline", "sentAt", "receivedAt", "shipOutDate"];
    const numFields  = [
      "productCostRmb", "productCostRm", "costRmb", "costRm", "suggestedRetailLow", "suggestedRetailHigh",
      "bulkCostEst", "leadTime", "moq",
    ];

    for (const f of strFields) {
      if (f in raw) data[f] = raw[f] ?? null;
    }
    for (const f of dateFields) {
      if (f in raw) data[f] = raw[f] ? new Date(raw[f]) : null;
    }
    for (const f of numFields) {
      if (f in raw) data[f] = raw[f] != null ? Number(raw[f]) : null;
    }

    // Remove manufacturerId if it's empty (would fail FK constraint)
    if (data.manufacturerId === "" || data.manufacturerId === null) {
      delete data.manufacturerId;
    }

    const sample = await prisma.sampleOrder.update({
      where: { id },
      data,
      include: {
        manufacturer: true,
        parent: { select: { id: true, orderNumber: true, version: true } },
        children: { select: { id: true, orderNumber: true, version: true, status: true } },
      },
    });

    // Auto-create ProductLibrary drafts (one per color) when sample is approved
    if (data.status === "approved") {
      const existingLib = await prisma.productLibrary.findFirst({ where: { sampleOrderId: sample.id } });
      if (!existingLib) {
        let colors: { name: string; hex: string; code?: string }[] = [];
        if (sample.colorVariants) {
          try { colors = JSON.parse(sample.colorVariants as string); } catch {}
        }
        if (colors.length === 0 && sample.colorName) {
          colors = [{ name: sample.colorName, hex: sample.colorCode ?? "", code: sample.colorCode ?? "" }];
        }
        if (colors.length === 0) {
          colors = [{ name: "", hex: "", code: "" }];
        }
        const libCount = await prisma.productLibrary.count();
        for (let i = 0; i < colors.length; i++) {
          const cv = colors[i];
          const colorCodeLetter = cv.code || null;
          const mainSkuVal      = (sample as any).mainSku || null;
          const colorSkuVal     = mainSkuVal && colorCodeLetter ? mainSkuVal + colorCodeLetter : null;
          const libNumber = `PL-${new Date().getFullYear()}-${String(libCount + i + 1).padStart(3, "0")}`;
          await prisma.productLibrary.create({
            data: {
              libNumber,
              status:          "draft",
              productName:     sample.productName  || "Product",
              brand:           sample.brand        || null,
              colorName:       cv.name             || sample.colorName  || null,
              colorCode:       colorCodeLetter,
              mainSku:         mainSkuVal,
              h2uSku:          colorSkuVal,
              materialUpper:   sample.materialUpper   || null,
              materialLining:  sample.materialLining  || null,
              materialMidsole: sample.materialMidsole || null,
              materialOutsole: sample.materialOutsole || null,
              hardware:        sample.hardware     || null,
              logoSpec:        sample.logoSpec     || null,
              heelSpec:        sample.heelSpec     || null,
              platformSpec:    sample.platformSpec  || null,
              materialUpperPhoto:   sample.materialUpperPhoto   || null,
              materialLiningPhoto:  sample.materialLiningPhoto  || null,
              materialMidsolePhoto: sample.materialMidsolePhoto || null,
              materialOutsolePhoto: sample.materialOutsolePhoto || null,
              hardwarePhoto:        sample.hardwarePhoto        || null,
              logoSpecPhoto:        sample.logoSpecPhoto        || null,
              heelSpecPhoto:        sample.heelSpecPhoto        || null,
              platformSpecPhoto:    sample.platformSpecPhoto    || null,
              shoePhotoUrl:    sample.photoSideUrl  || null,
              supplierSku:     sample.supplierSku  || null,
              manufacturerId:  sample.manufacturerId || null,
              sampleOrderId:   sample.id,
              costRmb:         sample.productCostRmb || null,
              costRm:          sample.productCostRm  || null,
            },
          });
        }
      }
    }

    return NextResponse.json(sample);
  } catch (err: any) {
    console.error("PATCH /api/samples/[id] error:", err);
    return NextResponse.json({ error: err?.message ?? "Update failed" }, { status: 500 });
  }
}

// POST to /:id creates a new amendment version
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parent = await prisma.sampleOrder.findUnique({ where: { id: (await params).id } });
    if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const data = await req.json();
    const count = await prisma.sampleOrder.count();
    const orderNumber = generateOrderNumber("SR", count + 1);

    const { id, createdAt, updatedAt, orderNumber: _on, version, parentId, ...rest } = parent as any;
    const newSample = await prisma.sampleOrder.create({
      data: {
        ...rest,
        ...data,
        orderNumber,
        version: parent.version + 1,
        parentId: parent.id,
        status: "draft",
        createdById: (session.user as any).id,
      },
    });
    return NextResponse.json(newSample, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/samples/[id] error:", err);
    return NextResponse.json({ error: err?.message ?? "Amendment failed" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await prisma.sampleOrder.delete({ where: { id: (await params).id } });
  return NextResponse.json({ ok: true });
}
