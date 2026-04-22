import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const S = StyleSheet.create({
  page:       { fontFamily: "Helvetica", fontSize: 8, padding: "20 24", color: "#1a1a1a" },
  header:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 10, borderBottom: "2pt solid #d03070", paddingBottom: 8 },
  logoText:   { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#d03070" },
  docTitle:   { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#374151", marginTop: 2 },
  metaBox:    { alignItems: "flex-end" },
  metaRow:    { flexDirection: "row", gap: 4, marginBottom: 2 },
  metaLabel:  { color: "#888", width: 70, textAlign: "right" },
  metaValue:  { fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
  totalsBox:  { backgroundColor: "#fdf4f7", border: "1pt solid #f6aac8", borderRadius: 3, padding: "5 10", alignItems: "flex-end", marginTop: 4 },
  totalsLabel: { color: "#888", fontSize: 7 },
  totalsValue: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#d03070" },
  // Main table
  table:      { marginTop: 8 },
  thead:      { flexDirection: "row", backgroundColor: "#1a1a1a", color: "white" },
  th:         { padding: "4 3", fontFamily: "Helvetica-Bold", fontSize: 7, color: "white", borderRight: "0.5pt solid #555" },
  tbody:      { },
  tr:         { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb" },
  trAlt:      { backgroundColor: "#fdf4f7" },
  td:         { padding: "4 3", fontSize: 8, borderRight: "0.5pt solid #e5e7eb" },
  // Column widths
  colPhoto:   { width: 35 },
  colSku:     { width: 38 },
  colBrand:   { width: 40 },
  colH2u:     { width: 40 },
  colColor:   { width: 38 },
  colCode:    { width: 20 },
  colMat:     { width: 45 },
  colSize:    { width: 18, textAlign: "center" },
  colPairs:   { width: 22, textAlign: "center", fontFamily: "Helvetica-Bold" },
  colPrice:   { width: 32, textAlign: "right" },
  colTotal:   { width: 35, textAlign: "right", fontFamily: "Helvetica-Bold", color: "#d03070" },
  photoImg:   { width: 30, height: 30, objectFit: "contain" },
  footer:     { position: "absolute", bottom: 14, left: 24, right: 24, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#aaa", borderTop: "0.5pt solid #e5e7eb", paddingTop: 4 },
});

const SIZES = ["36","37","38","39","40","41","42"];

export function PurchaseOrderPDF({ po }: { po: any }) {
  return (
    <Document>
      <Page size="A3" orientation="landscape" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.logoText}>Happy2U</Text>
            <Text style={S.docTitle}>PURCHASE ORDER</Text>
          </View>
          <View style={S.metaBox}>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>PO No:</Text>
              <Text style={[S.metaValue, { color: "#d03070" }]}>{po.poNumber}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Date:</Text>
              <Text style={S.metaValue}>{new Date(po.date ?? po.createdAt).toLocaleDateString("en-MY", { day:"2-digit", month:"2-digit", year:"numeric" })}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Supplier:</Text>
              <Text style={S.metaValue}>{po.manufacturer?.name}</Text>
            </View>
            {po.deliveryDate && (
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>Delivery:</Text>
                <Text style={S.metaValue}>{new Date(po.deliveryDate).toLocaleDateString("en-MY")}</Text>
              </View>
            )}
            <View style={S.totalsBox}>
              <Text style={S.totalsLabel}>TOTAL PAIRS</Text>
              <Text style={S.totalsValue}>{po.totalPairs}</Text>
              <Text style={[S.totalsLabel, { marginTop: 4 }]}>TOTAL PRICE</Text>
              <Text style={S.totalsValue}>¥ {po.totalPrice?.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={S.table}>
          <View style={S.thead}>
            <Text style={[S.th, S.colPhoto]}>Photo</Text>
            <Text style={[S.th, S.colSku]}>Supplier SKU</Text>
            <Text style={[S.th, S.colBrand]}>Brand</Text>
            <Text style={[S.th, S.colH2u]}>H2U SKU</Text>
            <Text style={[S.th, S.colColor]}>Color</Text>
            <Text style={[S.th, S.colCode]}>Code</Text>
            <Text style={[S.th, S.colMat]}>材料 Upper</Text>
            <Text style={[S.th, S.colMat]}>内里 Lining</Text>
            <Text style={[S.th, S.colMat]}>中底 Midsole</Text>
            <Text style={[S.th, S.colMat]}>大底 Outsole</Text>
            <Text style={[S.th, S.colMat]}>五金 Hardware</Text>
            <Text style={[S.th, { width: 50 }]}>Remark / Logo</Text>
            {SIZES.map(s => <Text key={s} style={[S.th, S.colSize]}>{s}</Text>)}
            <Text style={[S.th, S.colPairs]}>Pairs</Text>
            <Text style={[S.th, S.colPrice]}>Price</Text>
            <Text style={[S.th, S.colTotal]}>Total</Text>
          </View>

          <View style={S.tbody}>
            {po.items?.map((item: any, i: number) => (
              <View key={item.id} style={[S.tr, i % 2 === 1 ? S.trAlt : {}]}>
                <View style={[S.td, S.colPhoto]}>
                  {item.photoUrl ? <Image src={item.photoUrl} style={S.photoImg} /> : <View style={[S.photoImg, { backgroundColor: "#f3f4f6" }]} />}
                </View>
                <Text style={[S.td, S.colSku]}>{item.supplierSku || ""}</Text>
                <Text style={[S.td, S.colBrand]}>{item.brand || po.brand}</Text>
                <Text style={[S.td, S.colH2u]}>{item.h2uSku || ""}</Text>
                <Text style={[S.td, S.colColor]}>{item.colorName || ""}</Text>
                <Text style={[S.td, S.colCode]}>{item.colorCode || ""}</Text>
                <Text style={[S.td, S.colMat]}>{item.materialUpper || ""}</Text>
                <Text style={[S.td, S.colMat]}>{item.materialLining || ""}</Text>
                <Text style={[S.td, S.colMat]}>{item.materialMidsole || ""}</Text>
                <Text style={[S.td, S.colMat]}>{item.materialOutsole || ""}</Text>
                <Text style={[S.td, S.colMat]}>{item.hardware || ""}</Text>
                <Text style={[S.td, { width: 50 }]}>{[item.remark, item.logoSpec].filter(Boolean).join(" · ")}</Text>
                {SIZES.map(s => (
                  <Text key={s} style={[S.td, S.colSize]}>{(item as any)[`qty${s}`] || ""}</Text>
                ))}
                <Text style={[S.td, S.colPairs]}>{item.totalPairs}</Text>
                <Text style={[S.td, S.colPrice]}>{item.discountPrice ? `¥${item.discountPrice}` : ""}</Text>
                <Text style={[S.td, S.colTotal]}>{item.lineTotal ? `¥${item.lineTotal.toFixed(0)}` : ""}</Text>
              </View>
            ))}
          </View>
        </View>

        {po.notes && (
          <View style={{ marginTop: 8, backgroundColor: "#fffbeb", border: "0.5pt solid #fbbf24", borderRadius: 3, padding: 6 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, color: "#92400e", marginBottom: 2 }}>NOTES</Text>
            <Text style={{ color: "#78350f" }}>{po.notes}</Text>
          </View>
        )}

        <View style={S.footer} fixed>
          <Text>Happy2U Fashion Management System — CONFIDENTIAL</Text>
          <Text>{po.poNumber} · Generated {new Date().toLocaleDateString("en-MY")}</Text>
        </View>
      </Page>
    </Document>
  );
}
