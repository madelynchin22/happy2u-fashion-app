import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { join } from "path";

Font.register({
  family: "NotoSansSC",
  fonts: [
    { src: join(process.cwd(), "public/fonts/NotoSansSC-Regular.otf"), fontWeight: "normal" },
    { src: join(process.cwd(), "public/fonts/NotoSansSC-Bold.otf"),    fontWeight: "bold"   },
  ],
});

const SIZES = ["36","37","38","39","40","41"] as const;

const W = {
  supSku:  70,
  h2uSku:  52,
  color:   42,
  marking: 80,
  size:    22,
  pair:    28,
  delivery:50,
  remark:  60,
};

const S = StyleSheet.create({
  page:      { fontFamily: "NotoSansSC", fontSize: 7.5, padding: "16 20 24 20", color: "#111" },
  // Header
  headerRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  docTitle:      { fontSize: 18, fontFamily: "NotoSansSC", fontWeight: "bold", color: "#111", marginBottom: 2 },
  poInfo:        { fontSize: 8, color: "#555", marginBottom: 1 },
  // Outlet summary table (top-right)
  summaryTable:  { border: "0.75pt solid #aaa", fontSize: 7.5 },
  smHead:        { flexDirection: "row", backgroundColor: "#e5e5e5", borderBottom: "0.5pt solid #aaa" },
  smRow:         { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  smTotal:       { flexDirection: "row", backgroundColor: "#FFFF00", borderTop: "0.75pt solid #aaa" },
  smCell:        { padding: "2 4" },
  // Main table
  table:     { marginTop: 6 },
  sizeHeader:{ flexDirection: "row", backgroundColor: "#f0f0f0", borderBottom: "0.5pt solid #ccc" },
  sgLabel:   { fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 7, padding: "2 3", color: "#333" },
  thead:     { flexDirection: "row", backgroundColor: "#e5e5e5", borderTop: "0.75pt solid #aaa", borderBottom: "0.75pt solid #aaa" },
  th:        { padding: "3 2", fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 6.5, borderRight: "0.5pt solid #bbb", color: "#111" },
  tr:        { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  trFirst:   { borderTop: "0.75pt solid #aaa" },
  td:        { padding: "3 2", fontSize: 7.5, borderRight: "0.5pt solid #ddd" },
  tdBold:    { fontFamily: "NotoSansSC", fontWeight: "bold" },
  tdCenter:  { textAlign: "center" },
  tdRight:   { textAlign: "right" },
  totalRow:  { flexDirection: "row", backgroundColor: "#f9f9f9", borderBottom: "0.75pt solid #999" },
  footer:    { position: "absolute", bottom: 12, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: "#aaa", borderTop: "0.5pt solid #ddd", paddingTop: 3 },
});

function fmtDate(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric" });
}

export function PackingListPDF({ po, outlets }: { po: any; outlets: any[] }) {
  const items: any[] = po.items ?? [];

  // Build outlet totals from packingListItems
  const outletTotals: Record<string, number> = {};
  for (const item of items) {
    for (const pl of item.packingListItems ?? []) {
      const key = pl.outlet?.marking ?? pl.outletId ?? "—";
      outletTotals[key] = (outletTotals[key] ?? 0) + (pl.totalPairs ?? 0);
    }
  }
  const outletEntries = Object.entries(outletTotals).sort((a,b) => a[0].localeCompare(b[0]));
  const grandTotal = outletEntries.reduce((s, [,v]) => s + v, 0);

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={S.page}>

        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.docTitle}>PACKING LIST</Text>
            <Text style={S.poInfo}>PO NO: {po.poNumber}   SUPPLIER: {po.manufacturer?.name ?? ""}</Text>
            {po.productName && <Text style={S.poInfo}>{po.productName}</Text>}
          </View>

          {/* Outlet summary table */}
          <View style={S.summaryTable}>
            <View style={S.smHead}>
              <Text style={[S.smCell, { width: 100, fontFamily:"NotoSansSC", fontWeight:"bold", fontSize:6.5 }]}>MARKING</Text>
              <Text style={[S.smCell, { width: 40, fontFamily:"NotoSansSC", fontWeight:"bold", fontSize:6.5, textAlign:"right" }]}>PAIRS</Text>
            </View>
            {outletEntries.map(([marking, pairs]) => (
              <View key={marking} style={S.smRow}>
                <Text style={[S.smCell, { width: 100 }]}>{marking}</Text>
                <Text style={[S.smCell, { width: 40, textAlign:"right", fontFamily:"NotoSansSC", fontWeight:"bold" }]}>{pairs}</Text>
              </View>
            ))}
            <View style={S.smTotal}>
              <Text style={[S.smCell, { width: 100, fontFamily:"NotoSansSC", fontWeight:"bold" }]}>TOTAL</Text>
              <Text style={[S.smCell, { width: 40, textAlign:"right", fontFamily:"NotoSansSC", fontWeight:"bold" }]}>{grandTotal}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={S.table}>
          {/* Size group label */}
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: W.supSku + W.h2uSku + W.color + W.marking }} />
            <View style={[S.sizeHeader, { flex: 0 }]}>
              <Text style={S.sgLabel}>尺码 / SIZE</Text>
            </View>
          </View>

          {/* Column headers */}
          <View style={S.thead}>
            <Text style={[S.th, { width: W.supSku }]}>SUPPLIER SKU</Text>
            <Text style={[S.th, { width: W.h2uSku }]}>H2U SKU</Text>
            <Text style={[S.th, { width: W.color }]}>COLOR</Text>
            <Text style={[S.th, { width: W.marking }]}>MARKING</Text>
            {SIZES.map(s => <Text key={s} style={[S.th, { width: W.size, textAlign:"center" }]}>{s}</Text>)}
            <Text style={[S.th, { width: W.pair, textAlign:"center" }]}>Pair</Text>
            <Text style={[S.th, { width: W.delivery }]}>Delivery date</Text>
            <Text style={[S.th, { width: W.remark }]}>REMARK</Text>
          </View>

          {/* Data rows: grouped by item (colour), one sub-row per outlet */}
          {items.flatMap((item: any, iIdx: number) => {
            const plItems: any[] = item.packingListItems ?? [];
            if (plItems.length === 0) return [];

            const rows: React.ReactNode[] = [];

            // Outlet rows
            plItems.forEach((pl: any, plIdx: number) => {
              const isFirst = plIdx === 0;
              rows.push(
                <View key={`${item.id}-${pl.id ?? plIdx}`} style={[S.tr, isFirst ? S.trFirst : {}]}>
                  {/* Supplier SKU — shown only on first row of this colour block */}
                  <Text style={[S.td, S.tdBold, { width: W.supSku }]}>
                    {isFirst ? (item.supplierSku ?? "") : ""}
                  </Text>
                  <Text style={[S.td, { width: W.h2uSku }]}>
                    {isFirst ? (item.h2uSku ?? "") : ""}
                  </Text>
                  <Text style={[S.td, { width: W.color }]}>
                    {isFirst ? (item.colorName ?? "") : ""}
                  </Text>
                  <Text style={[S.td, { width: W.marking }]}>{pl.outlet?.marking ?? pl.outletId ?? ""}</Text>
                  {SIZES.map(s => (
                    <Text key={s} style={[S.td, S.tdCenter, { width: W.size }]}>
                      {(pl[`qty${s}`] ?? 0) || ""}
                    </Text>
                  ))}
                  <Text style={[S.td, S.tdBold, S.tdCenter, { width: W.pair }]}>{pl.totalPairs ?? ""}</Text>
                  <Text style={[S.td, { width: W.delivery }]}>
                    {isFirst && pl.deliveryDate ? fmtDate(pl.deliveryDate) : ""}
                  </Text>
                  <Text style={[S.td, { width: W.remark }]}>{pl.remark ?? ""}</Text>
                </View>
              );
            });

            // Sub-total row for this colour
            const colourTotal = plItems.reduce((s: number, p: any) => s + (p.totalPairs ?? 0), 0);
            rows.push(
              <View key={`${item.id}-subtotal`} style={S.totalRow}>
                <Text style={[S.td, S.tdBold, { width: W.supSku }]}>{item.supplierSku ?? ""}</Text>
                <Text style={[S.td, S.tdBold, { width: W.h2uSku }]}>{item.h2uSku ?? ""}</Text>
                <Text style={[S.td, S.tdBold, { width: W.color }]}>{item.colorName ?? ""}</Text>
                <Text style={[S.td, S.tdBold, { width: W.marking }]}>TOTAL</Text>
                {SIZES.map(s => {
                  const st = plItems.reduce((sum: number, p: any) => sum + (p[`qty${s}`] ?? 0), 0);
                  return <Text key={s} style={[S.td, S.tdBold, S.tdCenter, { width: W.size }]}>{st || ""}</Text>;
                })}
                <Text style={[S.td, S.tdBold, S.tdCenter, { width: W.pair }]}>{colourTotal}</Text>
                <Text style={[S.td, { width: W.delivery }]}></Text>
                <Text style={[S.td, { width: W.remark }]}></Text>
              </View>
            );

            return rows;
          })}

          {/* Grand total */}
          <View style={[S.tr, { backgroundColor: "#fffde7", borderTop: "1pt solid #888" }]}>
            <Text style={[S.td, S.tdBold, { width: W.supSku + W.h2uSku + W.color + W.marking }]}>GRAND TOTAL</Text>
            {SIZES.map(s => {
              const st = items.reduce((sum, item) =>
                sum + (item.packingListItems ?? []).reduce((ss: number, p: any) => ss + (p[`qty${s}`] ?? 0), 0), 0);
              return <Text key={s} style={[S.td, S.tdBold, S.tdCenter, { width: W.size }]}>{st || ""}</Text>;
            })}
            <Text style={[S.td, S.tdBold, S.tdCenter, { width: W.pair }]}>{grandTotal}</Text>
            <Text style={[S.td, { width: W.delivery + W.remark }]}></Text>
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text>Packing List — {po.poNumber} · {po.manufacturer?.name ?? ""}</Text>
          <Text>Generated {new Date().toLocaleDateString("en-GB")}</Text>
        </View>
      </Page>
    </Document>
  );
}
