export const runtime = "nodejs";

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
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

/** Strip Prisma metadata, convert Date objects → ISO strings, make fully plain */
function toPlain(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (_key, val) => {
    if (val instanceof Date) return val.toISOString();
    return val;
  }));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const raw = await prisma.sampleOrder.findUnique({
      where: { id: (await params).id },
      include: { manufacturer: true },
    });
    if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (raw.status === "draft") {
      return NextResponse.json({ error: "PDF is only available after the sample order is submitted." }, { status: 403 });
    }

    // Convert to a fully plain JSON-serialisable object (no Prisma proxies, no Date objects)
    const sample = toPlain(raw);

    // Resolve photo URLs to absolute so @react-pdf/renderer can fetch them server-side
    const photoFields = [
      "photoSideUrl", "photoBackUrl", "photoFrontUrl", "photoPlatformUrl", "photoHeelUrl",
      "materialUpperPhoto", "materialLiningPhoto", "materialMidsolePhoto",
      "materialOutsolePhoto", "hardwarePhoto", "heelSpecPhoto", "platformSpecPhoto", "logoSpecPhoto",
    ];
    for (const field of photoFields) {
      if (sample[field]) sample[field] = toAbsolute(sample[field]);
    }

    const element = React.createElement(SampleOrderPDF, { sample });
    const buffer  = await renderToBuffer(element);
    const uint8   = new Uint8Array(buffer);

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
