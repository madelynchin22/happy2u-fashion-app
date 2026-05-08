import React from "react";
import { Document, Page, Text, View, StyleSheet, Image, Font } from "@react-pdf/renderer";
import { join } from "path";

Font.register({
  family: "NotoSansSC",
  fonts: [
    { src: join(process.cwd(), "public/fonts/NotoSansSC-Regular.otf"), fontWeight: "normal" },
    { src: join(process.cwd(), "public/fonts/NotoSansSC-Bold.otf"),    fontWeight: "bold"   },
  ],
});

// A3 landscape — usable width ~1150pt (padding 18L + 22R)
const PL_SIZES = ["36","37","38","39","40","41"] as const;

const S = StyleSheet.create({
  page:     { fontFamily: "NotoSansSC", fontSize: 7.5, padding: "16 22 26 18", color: "#1a1a1a" },
  header:   { flexDirection: "row", justifyContent: "space-between", borderBottom: "2pt solid #d03070", paddingBottom: 6, marginBottom: 8 },
  logoText: { fontSize: 18, fontFamily: "NotoSansSC", fontWeight: "bold", color: "#d03070" },
  docTitle: { fontSize: 11, fontFamily: "NotoSansSC", fontWeight: "bold", color: "#374151", marginTop: 2 },
  metaSub:  { fontSize: 7, color: "#888", marginTop: 2 },
  // Summary table (top-right)
  summaryBox:  { alignItems: "flex-end" },
  summaryTable:{ border: "0.5pt solid #e5e7eb" },
  stRow:       { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb" },
  stHead:      { backgroundColor: "#fdf4f7" },
  stCell:      { padding: "2 5", fontSize: 7 },
  // Main table
  thead:    { flexDirection: "row", backgroundColor: "#1a1a1a" },
  th:       { padding: "3 2", fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 6.5, color: "white", borderRight: "0.5pt solid #555" },
  tr:       { flexDirection: "row", borderBottom: "0.5pt solid #e5e7eb" },
  trAlt:    { backgroundColor: "#fdf4f7" },
  trSub:    { flexDirection: "row", backgroundColor: "#f0f0f0", borderBottom: "1pt solid #d1d5db" },
  td:       { padding: "3 2", fontSize: 7, borderRight: "0.5pt solid #e5e7eb" },
  // Columns
  cPhoto:   { width: 58 },
  cSku:     { width: 78 },
  cH2u:     { width: 78 },
  cColor:   { width: 78 },
  cMark:    { width: 100 },
  cSize:    { width: 24, textAlign: "center" },
  cPairs:   { width: 30, textAlign: "center", fontFamily: "NotoSansSC", fontWeight: "bold" },
  cDel:     { width: 62 },
  cRem:     { flex: 1 },
  // Photo cell
  photoImg: { width: 48, height: 48, objectFit: "contain" },
  photoSup: { fontSize: 6, color: "#555", marginTop: 2, textAlign: "center" },
  footer:   { position: "absolute", bottom: 12, left: 18, right: 22, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: "#aaa", borderTop: "0.5pt solid #e5e7eb", paddingTop: 3 },
});

export function GroupPackingListPDF({ pos, groupCode, supplier }: { pos: any[]; groupCode: string; supplier: string }) {
  // Build outlet totals for the summary table
  const outletTotals: Record<string, number> = {};
  for (const po of pos) {
    for (const item of po.items ?? []) {
      for (const alloc of item.outletAllocations ?? []) {
        const marking = alloc.outlet?.marking ?? alloc.outletId;
        const qty = PL_SIZES.reduce((s, sz) => s + ((alloc as any)[`qty${sz}`] || 0), 0);
        outletTotals[marking] = (outletTotals[marking] ?? 0) + qty;
      }
    }
  }
  const grandTotal = Object.values(outletTotals).reduce((s, v) => s + v, 0);
  // Sort by pairs descending, zero-qty outlets last
  const sortedOutlets = Object.entries(outletTotals).sort((a, b) => b[1] - a[1]);

  const date = pos[0]?.date ?? pos[0]?.createdAt ?? new Date().toISOString();

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={S.page}>

        {/* ── Page header ── */}
        <View style={S.header}>
          <View>
            <Text style={S.logoText}>Happy2U</Text>
            <Text style={S.docTitle}>PACKING LIST</Text>
            <Text style={S.metaSub}>
              {groupCode} · {supplier} · {new Date(date).toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </Text>
          </View>

          {/* Summary table: outlet marking → total pairs */}
          <View style={S.summaryBox}>
            <View style={S.summaryTable}>
              <View style={[S.stRow, S.stHead]}>
                <Text style={[S.stCell, { width: 100, fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 7, color: "#d03070" }]}>H2U SKU / Marking</Text>
                <Text style={[S.stCell, { width: 44, fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 7, textAlign: "right", color: "#d03070" }]}>Pairs</Text>
              </View>
              {sortedOutlets.map(([marking, pairs]) => (
                <View key={marking} style={S.stRow}>
                  <Text style={[S.stCell, { width: 100 }]}>{marking}</Text>
                  <Text style={[S.stCell, { width: 44, textAlign: "right", fontFamily: "NotoSansSC", fontWeight: "bold" }]}>{pairs}</Text>
                </View>
              ))}
              <View style={[S.stRow, { backgroundColor: "#1a1a1a" }]}>
                <Text style={[S.stCell, { width: 100, color: "white", fontFamily: "NotoSansSC", fontWeight: "bold" }]}>TOTAL</Text>
                <Text style={[S.stCell, { width: 44, textAlign: "right", color: "white", fontFamily: "NotoSansSC", fontWeight: "bold" }]}>{grandTotal}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Table header ── */}
        <View style={S.thead}>
          <Text style={[S.th, S.cPhoto]}> </Text>
          <Text style={[S.th, S.cSku]}>SUPPLIER SKU</Text>
          <Text style={[S.th, S.cH2u]}>H2U SKU</Text>
          <Text style={[S.th, S.cColor]}>COLOR</Text>
          <Text style={[S.th, S.cMark]}>MARKING</Text>
          {PL_SIZES.map(s => <Text key={s} style={[S.th, S.cSize]}>{s}</Text>)}
          <Text style={[S.th, S.cPairs]}>Pair</Text>
          <Text style={[S.th, S.cDel]}>Delivery date</Text>
          <Text style={[S.th, S.cRem]}>REMARK</Text>
        </View>

        {/* ── Per-item blocks (photo spans all alloc rows via flex-row) ── */}
        {pos.flatMap((po: any) =>
          (po.items ?? []).map((item: any) => {
            const allocs: any[] = item.outletAllocations ?? [];
            const itemTotal = PL_SIZES.reduce((s, sz) =>
              s + allocs.reduce((as: number, a: any) => as + ((a as any)[`qty${sz}`] || 0), 0), 0);

            return (
              <View key={item.id} style={{ flexDirection: "row", borderBottom: "1pt solid #d1d5db" }} wrap={false}>

                {/* ── Photo column — naturally spans all rows ── */}
                <View style={[S.cPhoto, { borderRight: "0.5pt solid #e5e7eb", alignItems: "center", justifyContent: "center", padding: "4 2" }]}>
                  {item.photoUrl
                    ? <Image src={item.photoUrl} style={S.photoImg} />
                    : <View style={[S.photoImg, { backgroundColor: "#f3f4f6" }]} />}
                  <Text style={S.photoSup}>{supplier}</Text>
                </View>

                {/* ── Data section ── */}
                <View style={{ flex: 1 }}>

                  {allocs.length === 0 ? (
                    <View style={S.tr}>
                      <Text style={[S.td, S.cSku]}>{item.supplierSku || po.productName || ""}</Text>
                      <Text style={[S.td, S.cH2u]}>
                        {item.mainSku && item.colorCode ? `${item.mainSku}${item.colorCode}` : item.h2uSku || ""}
                      </Text>
                      <Text style={[S.td, S.cColor]}>{item.colorName || ""}</Text>
                      <Text style={[S.td, S.cMark, { color: "#aaa" }]}>No allocations</Text>
                      {PL_SIZES.map(s => <Text key={s} style={[S.td, S.cSize]}>—</Text>)}
                      <Text style={[S.td, S.cPairs]}>0</Text>
                      <Text style={[S.td, S.cDel]}></Text>
                      <Text style={[S.td, S.cRem]}></Text>
                    </View>
                  ) : (
                    <>
                      {allocs.map((alloc: any, aIdx: number) => {
                        const marking = alloc.outlet?.marking ?? alloc.outletId;
                        const allocPairs = PL_SIZES.reduce((s, sz) => s + ((alloc as any)[`qty${sz}`] || 0), 0);
                        const isFirst = aIdx === 0;
                        return (
                          <View key={aIdx} style={[S.tr, aIdx % 2 === 1 ? S.trAlt : {}]}>
                            <Text style={[S.td, S.cSku]}>{isFirst ? (item.supplierSku || po.productName || "") : ""}</Text>
                            <Text style={[S.td, S.cH2u]}>
                              {isFirst
                                ? (item.mainSku && item.colorCode ? `${item.mainSku}${item.colorCode}` : item.h2uSku || "")
                                : ""}
                            </Text>
                            <Text style={[S.td, S.cColor]}>{isFirst ? (item.colorName || "") : ""}</Text>
                            <Text style={[S.td, S.cMark]}>{marking}</Text>
                            {PL_SIZES.map(s => (
                              <Text key={s} style={[S.td, S.cSize]}>{(alloc as any)[`qty${s}`] || ""}</Text>
                            ))}
                            <Text style={[S.td, S.cPairs]}>{allocPairs || ""}</Text>
                            <Text style={[S.td, S.cDel]}>
                              {isFirst && item.deliveryDate
                                ? new Date(item.deliveryDate).toLocaleDateString("en-MY")
                                : ""}
                            </Text>
                            <Text style={[S.td, S.cRem]}>{isFirst ? (item.remark || "") : ""}</Text>
                          </View>
                        );
                      })}

                      {/* Subtotal row */}
                      <View style={S.trSub}>
                        <Text style={[S.td, S.cSku, { fontFamily: "NotoSansSC", fontWeight: "bold" }]}>
                          {item.supplierSku || po.productName || ""}
                        </Text>
                        <Text style={[S.td, S.cH2u]}></Text>
                        <Text style={[S.td, S.cColor, { fontFamily: "NotoSansSC", fontWeight: "bold", color: "#888", fontSize: 6.5 }]}>
                          {item.colorName || ""}
                        </Text>
                        <Text style={[S.td, S.cMark]}></Text>
                        {PL_SIZES.map(s => {
                          const t = allocs.reduce((as: number, a: any) => as + ((a as any)[`qty${s}`] || 0), 0);
                          return <Text key={s} style={[S.td, S.cSize, { fontFamily: "NotoSansSC", fontWeight: "bold" }]}>{t || ""}</Text>;
                        })}
                        <Text style={[S.td, S.cPairs, { fontFamily: "NotoSansSC", fontWeight: "bold", color: "#d03070" }]}>{itemTotal}</Text>
                        <Text style={[S.td, S.cDel]}></Text>
                        <Text style={[S.td, S.cRem]}></Text>
                      </View>
                    </>
                  )}

                </View>
              </View>
            );
          })
        )}

        <View style={S.footer} fixed>
          <Text>Happy2U Fashion Management System</Text>
          <Text>Packing List — {groupCode} · {supplier} · Generated {new Date().toLocaleDateString("en-MY")}</Text>
        </View>
      </Page>
    </Document>
  );
}
