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
      "manufacturerId", "collectionId", "supplierSku", "h2uSku",
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
    ];

    const dateFields = ["dateSent", "deadline", "sentAt", "receivedAt"];
    const numFields  = ["productCostRmb", "productCostRm", "costRmb", "costRm", "suggestedRetailLow", "suggestedRetailHigh"];

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
