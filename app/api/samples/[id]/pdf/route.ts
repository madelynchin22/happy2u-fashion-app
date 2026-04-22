import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { SampleOrderPDF } from "@/lib/pdf/sample-order";
import React from "react";

/** Convert a relative /uploads/... URL to an absolute URL the PDF renderer can fetch */
function toAbsolute(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Use NEXTAUTH_URL (set on Railway) or fall back to localhost
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sample = await prisma.sampleOrder.findUnique({
      where: { id: (await params).id },
      include: { manufacturer: true },
    });
    if (!sample) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (sample.status === "draft") {
      return NextResponse.json({ error: "PDF is only available after the sample order is submitted." }, { status: 403 });
    }

    // Resolve all photo URLs to absolute so @react-pdf/renderer can fetch them
    const resolved = {
      ...sample,
      photoSideUrl:         toAbsolute(sample.photoSideUrl),
      photoBackUrl:         toAbsolute(sample.photoBackUrl),
      photoFrontUrl:        toAbsolute(sample.photoFrontUrl),
      photoPlatformUrl:     toAbsolute(sample.photoPlatformUrl),
      photoHeelUrl:         toAbsolute(sample.photoHeelUrl),
      materialUpperPhoto:   toAbsolute(sample.materialUpperPhoto),
      materialLiningPhoto:  toAbsolute(sample.materialLiningPhoto),
      materialMidsolePhoto: toAbsolute(sample.materialMidsolePhoto),
      materialOutsolePhoto: toAbsolute(sample.materialOutsolePhoto),
      hardwarePhoto:        toAbsolute(sample.hardwarePhoto),
      heelSpecPhoto:        toAbsolute(sample.heelSpecPhoto),
      platformSpecPhoto:    toAbsolute(sample.platformSpecPhoto),
      logoSpecPhoto:        toAbsolute(sample.logoSpecPhoto),
    };

    const buffer = await renderToBuffer(React.createElement(SampleOrderPDF, { sample: resolved }));
    const uint8 = new Uint8Array(buffer);

    return new NextResponse(uint8, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sample.orderNumber}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("PDF generation error:", err);
    return NextResponse.json({ error: err?.message ?? "PDF generation failed" }, { status: 500 });
  }
}
