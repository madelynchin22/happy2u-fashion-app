import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const S = StyleSheet.create({
  page:      { fontFamily: "Helvetica", fontSize: 8, padding: "18 22", color: "#1a1a1a" },
  header:    { flexDirection: "row", justifyContent: "space-between", borderBottom: "2pt solid #d03070", paddingBottom: 8, marginBottom: 10 },
  logoText:  { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#d03070" },
  docTitle:  { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#374151", marginTop: 2 },
  summaryBox:{ alignItems: "flex-end" },
  metaRow:   { flexDirection: "row", gap: 4, marginBottom: 2 },
  metaLabel: { color: "#888", width: 70, textAlign: "right" },
  metaValue: { fontFamily: "Helvetica-Bold" },
  // Summary table (top-right: outlet → total pairs)
  summaryTable: { border: "0.5pt solid #e5e7eb", marginBottom: 10 },
  stRow:     { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb" },
  stHead:    { backgroundColor: "#fdf4f7" },
  stCell:    { padding: "3 6" },
  // Main table
  table:     { },
  thead:     { flexDirection: "row", backgroundColor: "#1a1a1a" },
  th:        { color: "white", padding: "4 4", fontFamily: "Helvetica-Bold", fontSize: 7, borderRight: "0.5pt solid #555" },
  tr:        { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb" },
  trAlt:     { backgroundColor: "#fdf4f7" },
  td:        { padding: "3 4", borderRight: "0.5pt solid #e5e7eb" },
  // Col widths
  cPhoto:    { width: 30 },
  cSku:      { width: 40 },
  cH2u:      { width: 40 },
  cColor:    { width: 40 },
  cMarking:  { width: 68 },
  cSize:     { width: 18, textAlign: "center" },
  cPairs:    { width: 24, textAlign: "center", fontFamily: "Helvetica-Bold" },
  cDate:     { width: 40 },
  cRemark:   { flex: 1 },
  totalRow:  { flexDirection: "row", backgroundColor: "#1a1a1a", borderBottom: "0.5pt solid #333" },
  totalLabel:{ color: "white", fontFamily: "Helvetica-Bold", padding: "3 4" },
  footer:    { position: "absolute", bottom: 14, left: 22, right: 22, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#aaa", borderTop: "0.5pt solid #e5e7eb", paddingTop: 4 },
});

const SIZES = ["36","37","38","39","40","41"] as const;

export function PackingListPDF({ po, outlets }: { po: any; outlets: any[] }) {
  // Build outlet totals summary
  const outletTotals: Record<string, number> = {};
  for (const item of po.items ?? []) {
    for (const pl of item.packingListItems ?? []) {
      outletTotals[pl.outlet?.marking ?? pl.outletId] = (outletTotals[pl.outlet?.marking ?? pl.outletId] ?? 0) + pl.totalPairs;
    }
  }
  const grandTotal = Object.values(outletTotals).reduce((s, v) => s + v, 0);

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.logoText}>Happy2U</Text>
            <Text style={S.docTitle}>PACKING LIST</Text>
          </View>
          <View style={S.summaryBox}>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>PO No:</Text>
              <Text style={[S.metaValue, { color: "#d03070" }]}>{po.poNumber}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Manufacturer:</Text>
              <Text style={S.metaValue}>{po.manufacturer?.name}</Text>
            </View>
            {/* Outlet summary box */}
            <View style={[S.summaryTable, { marginTop: 6 }]}>
              <View style={[S.stRow, S.stHead]}>
                <Text style={[S.stCell, { width: 90, fontFamily: "Helvetica-Bold", fontSize: 7, color: "#d03070" }]}>Outlet Marking</Text>
                <Text style={[S.stCell, { width: 40, fontFamily: "Helvetica-Bold", fontSize: 7, textAlign: "right", color: "#d03070" }]}>Pairs</Text>
              </View>
              {Object.entries(outletTotals).map(([marking, pairs]) => (
                <View key={marking} style={S.stRow}>
                  <Text style={[S.stCell, { width: 90 }]}>{marking}</Text>
                  <Text style={[S.stCell, { width: 40, textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{pairs}</Text>
                </View>
              ))}
              <View style={[S.stRow, { backgroundColor: "#1a1a1a" }]}>
                <Text style={[S.stCell, { width: 90, color: "white", fontFamily: "Helvetica-Bold" }]}>TOTAL</Text>
                <Text style={[S.stCell, { width: 40, textAlign: "right", color: "white", fontFamily: "Helvetica-Bold" }]}>{grandTotal}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Main table */}
        <View style={S.table}>
          <View style={S.thead}>
            <Text style={[S.th, S.cSku]}>Supplier SKU</Text>
            <Text style={[S.th, S.cH2u]}>H2U SKU</Text>
            <Text style={[S.th, S.cColor]}>Color</Text>
            <Text style={[S.th, S.cMarking]}>Marking (Outlet)</Text>
            {SIZES.map(s => <Text key={s} style={[S.th, S.cSize]}>{s}</Text>)}
            <Text style={[S.th, S.cPairs]}>Pairs</Text>
            <Text style={[S.th, S.cDate]}>Delivery</Text>
            <Text style={[S.th, S.cRemark]}>Remark</Text>
          </View>

          {po.items?.flatMap((item: any, iIdx: number) => {
            const rows: React.ReactNode[] = [];
            const plItems = item.packingListItems ?? [];
            if (plItems.length === 0) return rows;

            plItems.forEach((pl: any, plIdx: number) => {
              const alt = (iIdx + plIdx) % 2 === 1;
              rows.push(
                <View key={`${item.id}-${pl.id}`} style={[S.tr, alt ? S.trAlt : {}]}>
                  <Text style={[S.td, S.cSku]}>{plIdx === 0 ? item.supplierSku ?? "" : ""}</Text>
                  <Text style={[S.td, S.cH2u]}>{plIdx === 0 ? item.h2uSku ?? "" : ""}</Text>
                  <Text style={[S.td, S.cColor]}>{plIdx === 0 ? item.colorName ?? "" : ""}</Text>
                  <Text style={[S.td, S.cMarking]}>{pl.outlet?.marking ?? pl.outletId}</Text>
                  {SIZES.map(s => <Text key={s} style={[S.td, S.cSize]}>{(pl as any)[`qty${s}`] || ""}</Text>)}
                  <Text style={[S.td, S.cPairs]}>{pl.totalPairs}</Text>
                  <Text style={[S.td, S.cDate]}>{pl.deliveryDate ? new Date(pl.deliveryDate).toLocaleDateString("en-MY") : ""}</Text>
                  <Text style={[S.td, S.cRemark]}>{pl.remark ?? ""}</Text>
                </View>
              );
            });

            // Sub-total row per item
            const itemTotal = plItems.reduce((s: number, p: any) => s + p.totalPairs, 0);
            rows.push(
              <View key={`${item.id}-total`} style={[S.tr, { backgroundColor: "#f9fafb" }]}>
                <Text style={[S.td, S.cSku, { fontFamily: "Helvetica-Bold" }]}>{item.supplierSku}</Text>
                <Text style={[S.td, S.cH2u, { fontFamily: "Helvetica-Bold" }]}>{item.h2uSku}</Text>
                <Text style={[S.td, S.cColor, { fontFamily: "Helvetica-Bold" }]}>{item.colorName} TOTAL</Text>
                <Text style={[S.td, S.cMarking]}></Text>
                {SIZES.map(s => {
                  const sizeTotal = plItems.reduce((sum: number, p: any) => sum + ((p as any)[`qty${s}`] ?? 0), 0);
                  return <Text key={s} style={[S.td, S.cSize, { fontFamily: "Helvetica-Bold" }]}>{sizeTotal || ""}</Text>;
                })}
                <Text style={[S.td, S.cPairs, { fontFamily: "Helvetica-Bold", color: "#d03070" }]}>{itemTotal}</Text>
                <Text style={[S.td, S.cDate]}></Text>
                <Text style={[S.td, S.cRemark]}></Text>
              </View>
            );
            return rows;
          })}
        </View>

        <View style={S.footer} fixed>
          <Text>Happy2U Fashion Management System</Text>
          <Text>Packing List — {po.poNumber} · {new Date().toLocaleDateString("en-MY")}</Text>
        </View>
      </Page>
    </Document>
  );
}
