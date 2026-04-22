import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { DiscrepancyReportPDF } from "@/lib/pdf/discrepancy-report";
import { generateOrderNumber } from "@/lib/utils";
import React from "react";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const delivery = await prisma.delivery.findUnique({
    where: { id: params.id },
    include: {
      outlet: true,
      shipment: true,
      items: { include: { poItem: true } },
    },
  });
  if (!delivery) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Create or fetch existing report
  let report = await prisma.discrepancyReport.findFirst({ where: { deliveryId: params.id } });
  if (!report) {
    const count = await prisma.discrepancyReport.count();
    const flaggedItems = delivery.items.filter(i => i.isFlagged);
    report = await prisma.discrepancyReport.create({
      data: {
        reportNumber: generateOrderNumber("DR", count + 1),
        deliveryId: params.id,
        totalDiscrepancies: flaggedItems.length,
        status: "draft",
      },
    });
  }

  const buffer = await renderToBuffer(React.createElement(DiscrepancyReportPDF, { report, delivery }));

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${report.reportNumber}.pdf"`,
    },
  });
}
