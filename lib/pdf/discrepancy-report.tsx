import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const S = StyleSheet.create({
  page:    { fontFamily: "Helvetica", fontSize: 9, padding: "22 26", color: "#1a1a1a" },
  header:  { borderBottom: "2pt solid #dc2626", paddingBottom: 10, marginBottom: 12 },
  logo:    { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#dc2626" },
  title:   { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#374151", marginTop: 2 },
  subtitle:{ fontSize: 9, color: "#888", marginTop: 1 },
  row2:    { flexDirection: "row", gap: 12, marginBottom: 10 },
  infoBox: { flex: 1, border: "0.5pt solid #e5e7eb", borderRadius: 3, padding: 8 },
  infoTitle:{ fontFamily: "Helvetica-Bold", fontSize: 8, color: "#dc2626", marginBottom: 5 },
  infoRow: { flexDirection: "row", marginBottom: 3 },
  infoLabel:{ width: 80, color: "#888", fontSize: 8 },
  infoVal: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  alertBox:{ backgroundColor: "#fef2f2", border: "1pt solid #fca5a5", borderRadius: 3, padding: "6 10", marginBottom: 10, flexDirection: "row", gap: 10 },
  alertNum:{ fontSize: 22, fontFamily: "Helvetica-Bold", color: "#dc2626" },
  alertLabel:{ fontSize: 8, color: "#991b1b", marginTop: 4 },
  table:   { marginBottom: 10 },
  thead:   { flexDirection: "row", backgroundColor: "#dc2626" },
  th:      { color: "white", padding: "4 5", fontFamily: "Helvetica-Bold", fontSize: 7, borderRight: "0.5pt solid #ef4444" },
  tr:      { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb" },
  trFlag:  { backgroundColor: "#fef2f2" },
  td:      { padding: "4 5", fontSize: 8, borderRight: "0.5pt solid #f3f4f6" },
  cSku:    { width: 50 }, cH2u:{ width: 50 }, cColor:{ width: 50 },
  cExp:    { width: 35, textAlign: "center" }, cRec:{ width: 35, textAlign: "center" },
  cDisc:   { width: 35, textAlign: "center", fontFamily: "Helvetica-Bold" },
  cType:   { width: 55 }, cDesc:{ flex: 1 },
  sig:     { marginTop: 20, flexDirection: "row", gap: 20 },
  sigBox:  { flex: 1, borderTop: "1pt solid #e5e7eb", paddingTop: 5 },
  sigLabel:{ fontSize: 8, color: "#888" },
  footer:  { position: "absolute", bottom: 14, left: 26, right: 26, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#aaa", borderTop: "0.5pt solid #e5e7eb", paddingTop: 4 },
});

export function DiscrepancyReportPDF({ report, delivery }: { report: any; delivery: any }) {
  const flaggedItems = delivery.items?.filter((i: any) => i.isFlagged || i.discrepancyType) ?? [];
  const totalShortage = flaggedItems.filter((i: any) => i.discrepancyType === "shortage")
    .reduce((s: number, i: any) => s + (i.expectedQty - i.receivedQty), 0);

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <Text style={S.logo}>Happy2U</Text>
          <Text style={S.title}>DISCREPANCY REPORT</Text>
          <Text style={S.subtitle}>Report No: {report.reportNumber} · Generated: {new Date().toLocaleDateString("en-MY")}</Text>
        </View>

        <View style={S.row2}>
          <View style={S.infoBox}>
            <Text style={S.infoTitle}>DELIVERY DETAILS</Text>
            <View style={S.infoRow}><Text style={S.infoLabel}>Delivery ID:</Text><Text style={S.infoVal}>{delivery.id.slice(0,8).toUpperCase()}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Outlet:</Text><Text style={S.infoVal}>{delivery.outlet?.name}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Received:</Text><Text style={S.infoVal}>{delivery.receivedAt ? new Date(delivery.receivedAt).toLocaleDateString("en-MY") : "-"}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Shipment:</Text><Text style={S.infoVal}>{delivery.shipment?.shipmentNumber}</Text></View>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoTitle}>SUPPLIER INFORMATION</Text>
            <View style={S.infoRow}><Text style={S.infoLabel}>Supplier:</Text><Text style={S.infoVal}>{delivery.shipment?.manufacturer?.name ?? "—"}</Text></View>
            <View style={S.infoRow}><Text style={S.infoLabel}>Container:</Text><Text style={S.infoVal}>{delivery.shipment?.containerNumber ?? "—"}</Text></View>
          </View>
        </View>

        {/* Alert */}
        <View style={S.alertBox}>
          <View>
            <Text style={S.alertNum}>{flaggedItems.length}</Text>
            <Text style={S.alertLabel}>DISCREPANT ITEMS</Text>
          </View>
          <View style={{ flex: 1, justifyContent: "center" }}>
            <Text style={{ fontSize: 9, color: "#991b1b", lineHeight: 1.6 }}>
              Total shortage: {totalShortage} pairs · Estimated loss: {report.estimatedLossRm ? `RM ${report.estimatedLossRm.toFixed(2)}` : "—"}
            </Text>
            <Text style={{ fontSize: 8, color: "#991b1b", marginTop: 3 }}>
              Please review the items below and arrange for replacement or credit note within 7 working days.
            </Text>
          </View>
        </View>

        {/* Table */}
        <View style={S.table}>
          <View style={S.thead}>
            <Text style={[S.th, S.cSku]}>Supplier SKU</Text>
            <Text style={[S.th, S.cH2u]}>H2U SKU</Text>
            <Text style={[S.th, S.cColor]}>Color</Text>
            <Text style={[S.th, S.cExp]}>Expected</Text>
            <Text style={[S.th, S.cRec]}>Received</Text>
            <Text style={[S.th, S.cDisc]}>Diff</Text>
            <Text style={[S.th, S.cType]}>Issue Type</Text>
            <Text style={[S.th, S.cDesc]}>Description</Text>
          </View>
          {flaggedItems.map((item: any, i: number) => {
            const diff = item.expectedQty - item.receivedQty;
            return (
              <View key={item.id} style={[S.tr, S.trFlag]}>
                <Text style={[S.td, S.cSku]}>{item.poItem?.supplierSku ?? item.supplierSku ?? "—"}</Text>
                <Text style={[S.td, S.cH2u]}>{item.poItem?.h2uSku ?? item.h2uSku ?? "—"}</Text>
                <Text style={[S.td, S.cColor]}>{item.poItem?.colorName ?? item.colorName ?? "—"}</Text>
                <Text style={[S.td, S.cExp]}>{item.expectedQty}</Text>
                <Text style={[S.td, S.cRec]}>{item.receivedQty}</Text>
                <Text style={[S.td, S.cDisc, { color: diff > 0 ? "#dc2626" : "#16a34a" }]}>{diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}</Text>
                <Text style={[S.td, S.cType]}>{item.discrepancyType ?? "—"}</Text>
                <Text style={[S.td, S.cDesc]}>{item.damageDescription ?? "—"}</Text>
              </View>
            );
          })}
        </View>

        {report.notes && (
          <View style={{ backgroundColor: "#fffbeb", border: "0.5pt solid #fbbf24", borderRadius: 3, padding: 8, marginBottom: 12 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8, color: "#92400e", marginBottom: 3 }}>ADDITIONAL NOTES</Text>
            <Text style={{ color: "#78350f", lineHeight: 1.5 }}>{report.notes}</Text>
          </View>
        )}

        <View style={S.sig}>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Prepared by: ____________________</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Happy2U · Date: {new Date().toLocaleDateString("en-MY")}</Text>
          </View>
          <View style={S.sigBox}>
            <Text style={S.sigLabel}>Acknowledged by: ____________________</Text>
            <Text style={[S.sigLabel, { marginTop: 2 }]}>Supplier · Date: _______________</Text>
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text>Happy2U Fashion Management — CONFIDENTIAL</Text>
          <Text>{report.reportNumber} · {new Date().toLocaleDateString("en-MY")}</Text>
        </View>
      </Page>
    </Document>
  );
}
