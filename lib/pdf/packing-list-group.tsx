import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, Font } from "@react-pdf/renderer";
import { join } from "path";

Font.register({
  family: "NotoSansSC",
  fonts: [
    { src: join(process.cwd(), "public/fonts/NotoSansSC-Regular.otf"), fontWeight: "normal" },
    { src: join(process.cwd(), "public/fonts/NotoSansSC-Bold.otf"),    fontWeight: "bold"   },
  ],
});

const SIZES = ["36","37","38","39","40","41"] as const;
const PHOTO_W = 62;

const W = {
  supSku:  72,
  h2uSku:  54,
  color:   44,
  marking: 82,
  size:    22,
  pair:    28,
  delivery:52,
  remark:  62,
};

const S = StyleSheet.create({
  page:     { fontFamily: "NotoSansSC", fontSize: 7.5, padding: "16 20 24 20", color: "#111" },
  // Header
  headerRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  docTitle:    { fontSize: 18, fontFamily: "NotoSansSC", fontWeight: "bold", color: "#111", marginBottom: 2 },
  poInfo:      { fontSize: 8, color: "#555", marginBottom: 1 },
  // Outlet summary table (top-right)
  summaryTable: { border: "0.75pt solid #aaa", fontSize: 7.5 },
  smHead:       { flexDirection: "row", backgroundColor: "#e5e5e5", borderBottom: "0.5pt solid #aaa" },
  smRow:        { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  smTotal:      { flexDirection: "row", backgroundColor: "#FFFF00", borderTop: "0.75pt solid #aaa" },
  smCell:       { padding: "2 4" },
  // Main table
  table:      { marginTop: 6 },
  sizeHeader: { flexDirection: "row", backgroundColor: "#f0f0f0", borderBottom: "0.5pt solid #ccc" },
  sgLabel:    { fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 7, padding: "2 3", color: "#333" },
  thead:      { flexDirection: "row", backgroundColor: "#e5e5e5", borderTop: "0.75pt solid #aaa", borderBottom: "0.75pt solid #aaa" },
  th:         { padding: "3 2", fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 6.5, borderRight: "0.5pt solid #bbb", color: "#111" },
  // Block layout (photo + rows side-by-side)
  block:      { flexDirection: "row", borderBottom: "0.75pt solid #888" },
  photoCol:   { width: PHOTO_W, borderRight: "0.75pt solid #888", padding: "4 3", alignItems: "center", justifyContent: "center" },
  photoImg:   { width: PHOTO_W - 10, height: 52, objectFit: "contain" },
  photoSub:   { fontSize: 5.5, color: "#666", marginTop: 2, textAlign: "center" },
  dataCol:    { flex: 1 },
  tr:         { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  trFirst:    { borderTop: "0.75pt solid #aaa" },
  td:         { padding: "3 2", fontSize: 7.5, borderRight: "0.5pt solid #ddd" },
  tdBold:     { fontFamily: "NotoSansSC", fontWeight: "bold" },
  tdCenter:   { textAlign: "center" },
  totalRow:   { flexDirection: "row", backgroundColor: "#f9f9f9", borderBottom: "0.75pt solid #999" },
  poSeparator:{ backgroundColor: "#e5e5e5", padding: "3 6", marginTop: 6, marginBottom: 2 },
  footer:     { position: "absolute", bottom: 12, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: "#aaa", borderTop: "0.5pt solid #ddd", paddingTop: 3 },
});

function fmtDate(d?: string | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"2-digit", year:"numeric" });
}

export function GroupPackingListPDF({
  pos, groupCode, supplier, allOutlets,
}: {
  pos: any[];
  groupCode: string;
  supplier: string;
  allOutlets?: { id: string; marking: string; name: string }[];
}) {
  // Build outlet totals across all POs
  const outletTotals: Record<string, number> = {};
  if (allOutlets) {
    for (const o of allOutlets) outletTotals[o.marking] = 0;
  }
  for (const po of pos) {
    for (const item of po.items ?? []) {
      for (const alloc of item.outletAllocations ?? []) {
        const marking = alloc.outlet?.marking ?? alloc.outletId ?? "—";
        const qty = SIZES.reduce((s, sz) => s + ((alloc as any)[`qty${sz}`] || 0), 0);
        outletTotals[marking] = (outletTotals[marking] ?? 0) + qty;
      }
    }
  }
  const outletEntries: [string, number][] = allOutlets
    ? allOutlets.map(o => [o.marking, outletTotals[o.marking] ?? 0])
    : Object.entries(outletTotals).sort((a, b) => a[0].localeCompare(b[0]));
  const grandTotal = outletEntries.reduce((s, [,v]) => s + v, 0);

  const firstDate = pos[0]?.date ?? pos[0]?.createdAt ?? new Date().toISOString();
  const isMulti = pos.length > 1;

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={S.page}>

        {/* Header */}
        <View style={S.headerRow}>
          <View>
            <Text style={S.docTitle}>PACKING LIST</Text>
            <Text style={S.poInfo}>
              {isMulti ? groupCode : pos[0]?.poNumber ?? groupCode}
              {supplier ? `  ·  ${supplier}` : ""}
              {"  ·  "}{fmtDate(firstDate)}
            </Text>
            {!isMulti && pos[0]?.productName && (
              <Text style={S.poInfo}>{pos[0].productName}</Text>
            )}
          </View>

          {/* Outlet summary */}
          <View style={S.summaryTable}>
            <View style={S.smHead}>
              <Text style={[S.smCell, { width: 108, fontFamily:"NotoSansSC", fontWeight:"bold", fontSize:6.5 }]}>MARKING</Text>
              <Text style={[S.smCell, { width: 42, fontFamily:"NotoSansSC", fontWeight:"bold", fontSize:6.5, textAlign:"right" }]}>PAIRS</Text>
            </View>
            {outletEntries.map(([marking, pairs]) => (
              <View key={marking} style={S.smRow}>
                <Text style={[S.smCell, { width: 108 }]}>{marking}</Text>
                <Text style={[S.smCell, { width: 42, textAlign:"right", fontFamily:"NotoSansSC", fontWeight:"bold" }]}>{pairs}</Text>
              </View>
            ))}
            <View style={S.smTotal}>
              <Text style={[S.smCell, { width: 108, fontFamily:"NotoSansSC", fontWeight:"bold" }]}>TOTAL</Text>
              <Text style={[S.smCell, { width: 42, textAlign:"right", fontFamily:"NotoSansSC", fontWeight:"bold" }]}>{grandTotal}</Text>
            </View>
          </View>
        </View>

        {/* Table */}
        <View style={S.table}>
          {/* Size group label */}
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: PHOTO_W + W.supSku + W.h2uSku + W.color + W.marking }} />
            <View style={[S.sizeHeader, { flex: 0 }]}>
              <Text style={S.sgLabel}>尺码 / SIZE</Text>
            </View>
          </View>

          {/* Column headers */}
          <View style={S.thead}>
            <View style={{ width: PHOTO_W, borderRight: "0.5pt solid #bbb" }} />
            <Text style={[S.th, { width: W.supSku }]}>SUPPLIER SKU</Text>
            <Text style={[S.th, { width: W.h2uSku }]}>H2U SKU</Text>
            <Text style={[S.th, { width: W.color }]}>COLOR</Text>
            <Text style={[S.th, { width: W.marking }]}>MARKING</Text>
            {SIZES.map(s => <Text key={s} style={[S.th, { width: W.size, textAlign:"center" }]}>{s}</Text>)}
            <Text style={[S.th, { width: W.pair, textAlign:"center" }]}>Pair</Text>
            <Text style={[S.th, { width: W.delivery }]}>Delivery date</Text>
            <Text style={[S.th, { width: W.remark }]}>REMARK</Text>
          </View>

          {/* Data: per PO → per item block (photo + outlet rows) */}
          {pos.flatMap((po: any) => {
            const blocks: React.ReactNode[] = [];

            if (isMulti) {
              blocks.push(
                <View key={`sep-${po.id}`} style={S.poSeparator}>
                  <Text style={{ fontFamily:"NotoSansSC", fontWeight:"bold", fontSize:7 }}>
                    {po.poNumber} · {po.manufacturer?.name ?? supplier}
                    {po.productName ? `  —  ${po.productName}` : ""}
                  </Text>
                </View>
              );
            }

            (po.items ?? []).forEach((item: any) => {
              const allocs: any[] = item.outletAllocations ?? [];
              const allocByOutletId = new Map<string, any>(allocs.map((a: any) => [a.outletId, a]));

              const outletRows: { marking: string; alloc: any }[] = allOutlets
                ? allOutlets.map(o => ({
                    marking: o.marking,
                    alloc: allocByOutletId.get(o.id) ?? { outletId: o.id },
                  }))
                : allocs
                    .filter((a: any) => SIZES.reduce((s, sz) => s + ((a as any)[`qty${sz}`] || 0), 0) > 0)
                    .map((a: any) => ({ marking: a.outlet?.marking ?? a.outletId ?? "—", alloc: a }));

              if (outletRows.length === 0) return;

              blocks.push(
                <View key={item.id} style={S.block} wrap={false}>

                  {/* Photo column — spans all outlet rows naturally */}
                  <View style={S.photoCol}>
                    {item.photoUrl
                      ? <Image src={item.photoUrl} style={S.photoImg} />
                      : <View style={[S.photoImg, { backgroundColor: "#f3f4f6" }]} />}
                    <Text style={S.photoSub}>{item.supplierSku ?? item.h2uSku ?? ""}</Text>
                  </View>

                  {/* Data column: outlet rows + subtotal */}
                  <View style={S.dataCol}>
                    {outletRows.map(({ marking, alloc }, oIdx) => {
                      const allocPairs = SIZES.reduce((s, sz) => s + ((alloc as any)[`qty${sz}`] || 0), 0);
                      const isFirst = oIdx === 0;
                      return (
                        <View key={`${item.id}-${oIdx}`} style={[S.tr, isFirst ? S.trFirst : {}]}>
                          <Text style={[S.td, S.tdBold, { width: W.supSku }]}>
                            {isFirst ? (item.supplierSku ?? "") : ""}
                          </Text>
                          <Text style={[S.td, { width: W.h2uSku }]}>
                            {isFirst ? (item.h2uSku ?? "") : ""}
                          </Text>
                          <Text style={[S.td, { width: W.color }]}>
                            {isFirst ? (item.colorName ?? "") : ""}
                          </Text>
                          <Text style={[S.td, { width: W.marking }]}>{marking}</Text>
                          {SIZES.map(s => (
                            <Text key={s} style={[S.td, S.tdCenter, { width: W.size }]}>
                              {(alloc as any)[`qty${s}`] || ""}
                            </Text>
                          ))}
                          <Text style={[S.td, S.tdBold, S.tdCenter, { width: W.pair }]}>
                            {allocPairs || ""}
                          </Text>
                          <Text style={[S.td, { width: W.delivery }]}>
                            {isFirst ? fmtDate(item.deliveryDate) : ""}
                          </Text>
                          <Text style={[S.td, { width: W.remark }]}>
                            {isFirst ? (item.remark ?? "") : ""}
                          </Text>
                        </View>
                      );
                    })}

                    {/* Sub-total row */}
                    {(() => {
                      const colourTotal = SIZES.reduce((s, sz) =>
                        s + allocs.reduce((as: number, a: any) => as + ((a as any)[`qty${sz}`] || 0), 0), 0);
                      return (
                        <View key={`${item.id}-sub`} style={S.totalRow}>
                          <Text style={[S.td, S.tdBold, { width: W.supSku }]}>{item.supplierSku ?? ""}</Text>
                          <Text style={[S.td, S.tdBold, { width: W.h2uSku }]}>{item.h2uSku ?? ""}</Text>
                          <Text style={[S.td, S.tdBold, { width: W.color }]}>{item.colorName ?? ""}</Text>
                          <Text style={[S.td, S.tdBold, { width: W.marking }]}>TOTAL</Text>
                          {SIZES.map(s => {
                            const t = allocs.reduce((sum: number, a: any) => sum + ((a as any)[`qty${s}`] || 0), 0);
                            return <Text key={s} style={[S.td, S.tdBold, S.tdCenter, { width: W.size }]}>{t || ""}</Text>;
                          })}
                          <Text style={[S.td, S.tdBold, S.tdCenter, { width: W.pair }]}>{colourTotal || ""}</Text>
                          <Text style={[S.td, { width: W.delivery }]}></Text>
                          <Text style={[S.td, { width: W.remark }]}></Text>
                        </View>
                      );
                    })()}
                  </View>

                </View>
              );
            });

            return blocks;
          })}

          {/* Grand total */}
          <View style={[S.tr, { backgroundColor: "#fffde7", borderTop: "1pt solid #888" }]}>
            <View style={{ width: PHOTO_W }} />
            <Text style={[S.td, S.tdBold, { width: W.supSku + W.h2uSku + W.color + W.marking }]}>GRAND TOTAL</Text>
            {SIZES.map(s => {
              const st = pos.reduce((sum, po) =>
                sum + (po.items ?? []).reduce((is: number, item: any) =>
                  is + (item.outletAllocations ?? []).reduce((as: number, a: any) =>
                    as + ((a as any)[`qty${s}`] || 0), 0), 0), 0);
              return <Text key={s} style={[S.td, S.tdBold, S.tdCenter, { width: W.size }]}>{st || ""}</Text>;
            })}
            <Text style={[S.td, S.tdBold, S.tdCenter, { width: W.pair }]}>{grandTotal}</Text>
            <Text style={[S.td, { width: W.delivery + W.remark }]}></Text>
          </View>
        </View>

        <View style={S.footer} fixed>
          <Text>Packing List — {isMulti ? groupCode : (pos[0]?.poNumber ?? groupCode)} · {supplier}</Text>
          <Text>Generated {new Date().toLocaleDateString("en-GB")}</Text>
        </View>
      </Page>
    </Document>
  );
}
