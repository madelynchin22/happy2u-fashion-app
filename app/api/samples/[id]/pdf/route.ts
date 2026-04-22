import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { SampleOrderPDF } from "@/lib/pdf/sample-order";
import React from "react";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sample = await prisma.sampleOrder.findUnique({
      where: { id: (await params).id },
      include: { manufacturer: true },
    });
    if (!sample) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only allow PDF download for non-draft orders
    if (sample.status === "draft") {
      return NextResponse.json({ error: "PDF is only available after the sample order is submitted." }, { status: 403 });
    }

    const buffer = await renderToBuffer(React.createElement(SampleOrderPDF, { sample }));

    return new NextResponse(buffer, {
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
