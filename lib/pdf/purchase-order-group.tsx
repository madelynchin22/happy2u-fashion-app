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

// A3 landscape: 1190pt wide, padding 20+20=40 → 1150pt usable
const SIZES      = ["36","37","38","39","40","41","42"];
const PHOTO_W    = 115;   // increased from 90
const REMARK_W   = 120;   // remarks+box design spanning column
const EMPTY_ROWS = 5;

const D = {
  price: 32,
  sku:   60,
  main:  52,
  h2u:   60,
  color: 58,
  code:  22,
  mat:   42,  // ×5 = 210
  logo:  58,
  del:   52,
  sz:    20,  // ×7 = 140
  pairs: 28,
  // total: flex:1
};

const SZ_SPAN_W = D.sz * 7; // 140

const S = StyleSheet.create({
  page:      { fontFamily: "NotoSansSC", fontSize: 7, padding: "16 20 20 20", backgroundColor: "white" },

  // ── Page header ──
  pageHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 4 },
  titleArea:  { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 10 },
  titleText:  { fontSize: 13, fontFamily: "NotoSansSC", fontWeight: "bold", letterSpacing: 2, color: "#1a1a1a" },

  // PO info box (top-right)
  metaOuter:  { flexDirection: "row", alignItems: "flex-start" },
  metaBox:    { border: "0.75pt solid #555" },
  metaRow:    { flexDirection: "row", borderBottom: "0.5pt solid #555" },
  metaRowLast:{ flexDirection: "row" },
  metaLabel:  { width: 72, padding: "2 4", borderRight: "0.5pt solid #555", fontSize: 6.5, color: "#333" },
  metaVal:    { width: 54, padding: "2 4", fontSize: 7, fontFamily: "NotoSansSC", fontWeight: "bold", textAlign: "right" },
  metaYellow: { backgroundColor: "#FFF3B0" },
  metaRed:    { backgroundColor: "#FFD3DC" },

  // Total/Paid/Pending (right of meta box)
  pendingBox: { marginLeft: 8, paddingTop: 2 },
  pRow:       { flexDirection: "row", marginBottom: 1 },
  pLabel:     { width: 42, fontSize: 7, color: "#555" },
  pValue:     { width: 60, fontSize: 7, fontFamily: "NotoSansSC", fontWeight: "bold", textAlign: "right" },
  pLine:      { height: 0.5, backgroundColor: "#aaa", marginVertical: 2, width: 102 },

  // ── Main table ──
  table:      { border: "0.75pt solid #555", marginTop: 4 },

  hRow1:      { flexDirection: "row", backgroundColor: "#f2f2f2", borderBottom: "0.5pt solid #aaa" },
  hRow2:      { flexDirection: "row", backgroundColor: "#e8e8e8", borderBottom: "0.5pt solid #aaa" },
  th:         { padding: "2 1.5", fontSize: 6, fontFamily: "NotoSansSC", fontWeight: "bold", borderRight: "0.5pt solid #bbb", color: "#222", textAlign: "center" },
  thPhotoBox: { width: PHOTO_W, borderRight: "0.5pt solid #bbb" },

  // Product block: photo | [rowsSec | remarkSpan | logoSpan]
  block:      { flexDirection: "row", borderBottom: "0.75pt solid #888" },
  photoCol:   { width: PHOTO_W, borderRight: "0.75pt solid #888", padding: "5 4", alignItems: "center" },
  photoImg:   { width: 98, height: 90, objectFit: "contain" },
  photoSup:   { fontSize: 6.5, color: "#444", marginTop: 3, textAlign: "center" },
  photoRed:   { fontSize: 6.5, color: "#d03070", marginTop: 1, textAlign: "center" },

  // Inner horizontal wrapper
  innerRow:   { flex: 1, flexDirection: "row" },
  rowsSec:    { flex: 1, flexDirection: "column" },

  tr:    { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  td:    { padding: "2 1.5", fontSize: 7, borderRight: "0.5pt solid #ddd" },

  eRow:  { flexDirection: "row", height: 12, borderBottom: "0.5pt solid #ddd" },
  eCell: { borderRight: "0.5pt solid #ddd" },

  // Spanning columns
  remarkSpan: { width: REMARK_W, borderLeft: "0.75pt solid #888", padding: "3 4", flexDirection: "column" },
  logoSpan:   { width: D.logo,   borderLeft: "0.75pt solid #888", padding: "2 2", flexDirection: "column", alignItems: "center" },

  footer: { position: "absolute", bottom: 12, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between", fontSize: 6.5, color: "#aaa", borderTop: "0.5pt solid #e5e7eb", paddingTop: 3 },
});

export function GroupPurchaseOrderPDF({ pos, groupCode, supplier }: { pos: any[]; groupCode: string; supplier: string }) {
  const totalPairs = pos.reduce((s: number, p: any) => s + (p.totalPairs ?? 0), 0);
  const totalPrice = pos.reduce((s: number, p: any) => s + (p.totalPrice ?? 0), 0);
  const date = pos[0]?.date ?? pos[0]?.createdAt ?? new Date().toISOString();
  const fmtDate = new Date(date).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={S.page}>

        {/* ── Page header ── */}
        <View style={S.pageHeader}>
          <View style={S.titleArea}>
            <Text style={S.titleText}>PURCHASE ORDER</Text>
          </View>

          <View style={S.metaOuter}>
            <View style={S.metaBox}>
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>PO NO:</Text>
                <Text style={[S.metaVal, S.metaYellow]}>{groupCode}</Text>
              </View>
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>DATE:</Text>
                <Text style={S.metaVal}>{fmtDate}</Text>
              </View>
              <View style={S.metaRow}>
                <Text style={S.metaLabel}>TOTAL PAIRS:</Text>
                <Text style={S.metaVal}>{totalPairs}</Text>
              </View>
              <View style={S.metaRowLast}>
                <Text style={S.metaLabel}>TOTAL PRICE:</Text>
                <Text style={[S.metaVal, S.metaRed]}>¥{totalPrice.toFixed(0)}</Text>
              </View>
            </View>

            <View style={S.pendingBox}>
              <View style={S.pRow}>
                <Text style={S.pLabel}>Total</Text>
                <Text style={S.pValue}>¥ {totalPrice.toFixed(2)}</Text>
              </View>
              <View style={S.pLine} />
              <View style={S.pRow}>
                <Text style={S.pLabel}>Paid</Text>
                <Text style={S.pValue}></Text>
              </View>
              <View style={S.pLine} />
              <View style={S.pRow}>
                <Text style={S.pLabel}>Pending</Text>
                <Text style={S.pValue}>¥ {totalPrice.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Main table ── */}
        <View style={S.table}>

          {/* Header row 1 */}
          <View style={S.hRow1}>
            <View style={S.thPhotoBox} />
            <Text style={[S.th, { width: D.price }]}>$</Text>
            <Text style={[S.th, { width: D.sku }]}>{"供应商款号\nSupplier SKU"}</Text>
            <Text style={[S.th, { width: D.main }]}>{"主款号\nMain SKU"}</Text>
            <Text style={[S.th, { width: D.h2u }]}>{"H2U款号\nH2U SKU"}</Text>
            <Text style={[S.th, { width: D.color }]}>{"颜色\nColour"}</Text>
            <Text style={[S.th, { width: D.code }]}>{"色号\nCode"}</Text>
            <Text style={[S.th, { width: D.mat }]}>{"材料\nMaterial"}</Text>
            <Text style={[S.th, { width: D.mat }]}>{"内里\nInsole"}</Text>
            <Text style={[S.th, { width: D.mat }]}>{"中底\nMidsole"}</Text>
            <Text style={[S.th, { width: D.mat }]}>{"大底\nOutsole"}</Text>
            <Text style={[S.th, { width: D.mat }]}>{"五金\nMetal Buckle"}</Text>
            <Text style={[S.th, { width: D.del }]}>{"交货日期\nDelivery Date"}</Text>
            <Text style={[S.th, { width: SZ_SPAN_W }]}>尺码/SIZE</Text>
            <Text style={[S.th, { width: D.pairs }]}>{"双数\nPairs"}</Text>
            <Text style={[S.th, { flex: 1 }]}>{"总价\nTotal"}</Text>
            <Text style={[S.th, { width: REMARK_W }]}>{"备注\nRemarks"}</Text>
            <Text style={[S.th, { width: D.logo, borderRight: 0 }]}>LOGO</Text>
          </View>

          {/* Header row 2: individual size numbers */}
          <View style={S.hRow2}>
            <View style={S.thPhotoBox} />
            <View style={{ width: D.price,    borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.sku,      borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.main,     borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.h2u,      borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.color,    borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.code,     borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat,      borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat,      borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat,      borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat,      borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat,      borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.del,      borderRight: "0.5pt solid #bbb" }} />
            {SIZES.map(s => <Text key={s} style={[S.th, { width: D.sz }]}>{s}</Text>)}
            <View style={{ width: D.pairs,    borderRight: "0.5pt solid #bbb" }} />
            <View style={{ flex: 1,           borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: REMARK_W,   borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.logo }} />
          </View>

          {/* ── Product blocks ── */}
          {pos.flatMap((po: any) => {
            const isMulti    = pos.length > 1;
            const poSupplier = po.manufacturer?.name ?? supplier;

            const groups: { supplierSku: string; items: any[] }[] = [];
            for (const item of po.items ?? []) {
              const modelKey = item.h2uSku?.replace(/[A-Z]+$/, "") || item.supplierSku || "";
              const last = groups[groups.length - 1];
              if (last && last.supplierSku === modelKey) {
                last.items.push(item);
              } else {
                const displaySku = (item.supplierSku && /^[A-Z]\d/.test(item.supplierSku))
                  ? item.supplierSku
                  : modelKey;
                groups.push({ supplierSku: displaySku, items: [item] });
              }
            }

            const blocks: React.ReactNode[] = [];

            if (isMulti) {
              const poTotal = (po.items ?? []).reduce((s: number, i: any) => s + (i.totalPairs ?? 0), 0);
              blocks.push(
                <View key={`sep-${po.id}`} style={{ backgroundColor: "#e5e5e5", padding: "4 6", flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "NotoSansSC", fontWeight: "bold", fontSize: 7.5 }}>
                    {po.poNumber}  ·  {poSupplier}
                  </Text>
                  <Text style={{ fontSize: 7, color: "#555" }}>{poTotal} pairs</Text>
                </View>
              );
            }

            groups.forEach((grp, gIdx) => {
              const photo      = grp.items[0]?.photoUrl ?? po.photoUrl ?? null;
              const firstItem  = grp.items[0];

              blocks.push(
                <View key={`${po.id}-${gIdx}`} style={S.block} wrap={false}>

                  {/* Photo column */}
                  <View style={S.photoCol}>
                    {photo
                      ? <Image src={photo} style={S.photoImg} />
                      : <View style={[S.photoImg, { backgroundColor: "#f3f4f6" }]} />}
                    <Text style={S.photoSup}>{poSupplier}</Text>
                  </View>

                  {/* Inner: [per-color rows | remarks+box | logo] */}
                  <View style={S.innerRow}>

                    {/* Left: per-color data rows + empty filler rows */}
                    <View style={S.rowsSec}>

                      {grp.items.map((item: any, i: number) => (
                        <View key={item.id} style={S.tr}>
                          <Text style={[S.td, { width: D.price, textAlign: "right" }]}>
                            {i === 0 && item.discountPrice ? `¥${item.discountPrice}` : ""}
                          </Text>
                          <Text style={[S.td, { width: D.sku }]}>
                            {i === 0 ? (item.supplierSku || "") : ""}
                          </Text>
                          <Text style={[S.td, { width: D.main, fontFamily: "NotoSansSC", fontWeight: "bold" }]}>
                            {i === 0 ? grp.supplierSku : ""}
                          </Text>
                          <Text style={[S.td, { width: D.h2u, fontFamily: "NotoSansSC", fontWeight: "bold" }]}>
                            {item.h2uSku || ""}
                          </Text>
                          <Text style={[S.td, { width: D.color }]}>{item.colorName || ""}</Text>
                          <Text style={[S.td, { width: D.code }]}>{item.colorCode || ""}</Text>
                          <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialUpper   || "") : ""}</Text>
                          <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialLining  || "") : ""}</Text>
                          <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialMidsole || "") : ""}</Text>
                          <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialOutsole || "") : ""}</Text>
                          <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.hardware        || "") : ""}</Text>
                          <Text style={[S.td, { width: D.del }]}>
                            {i === 0 && item.deliveryDate
                              ? new Date(item.deliveryDate).toLocaleDateString("en-MY", { month: "short", year: "2-digit" }).toUpperCase()
                              : ""}
                          </Text>
                          {SIZES.map(s => (
                            <Text key={s} style={[S.td, { width: D.sz, textAlign: "center" }]}>
                              {(item as any)[`qty${s}`] || ""}
                            </Text>
                          ))}
                          <Text style={[S.td, { width: D.pairs, textAlign: "center", fontFamily: "NotoSansSC", fontWeight: "bold" }]}>
                            {item.totalPairs || ""}
                          </Text>
                          <Text style={[S.td, { flex: 1, textAlign: "right", fontFamily: "NotoSansSC", fontWeight: "bold", color: "#d03070", borderRight: 0 }]}>
                            {item.lineTotal ? `¥${Math.round(item.lineTotal)}` : ""}
                          </Text>
                        </View>
                      ))}

                      {/* Empty filler rows */}
                      {Array.from({ length: EMPTY_ROWS }).map((_, ei) => (
                        <View key={`e${ei}`} style={S.eRow}>
                          <View style={[S.eCell, { width: D.price }]} />
                          <View style={[S.eCell, { width: D.sku }]} />
                          <View style={[S.eCell, { width: D.main }]} />
                          <View style={[S.eCell, { width: D.h2u }]} />
                          <View style={[S.eCell, { width: D.color }]} />
                          <View style={[S.eCell, { width: D.code }]} />
                          <View style={[S.eCell, { width: D.mat }]} />
                          <View style={[S.eCell, { width: D.mat }]} />
                          <View style={[S.eCell, { width: D.mat }]} />
                          <View style={[S.eCell, { width: D.mat }]} />
                          <View style={[S.eCell, { width: D.mat }]} />
                          <View style={[S.eCell, { width: D.del }]} />
                          {SIZES.map(s => <View key={s} style={[S.eCell, { width: D.sz }]} />)}
                          <View style={[S.eCell, { width: D.pairs }]} />
                          <View style={{ flex: 1 }} />
                        </View>
                      ))}

                    </View>

                    {/* Remarks + box design — spans ALL colour rows and empty rows */}
                    <View style={S.remarkSpan}>
                      {firstItem?.remark ? <Text style={{ fontSize: 7 }}>{firstItem.remark}</Text> : null}
                      {firstItem?.boxDesignUri ? (
                        <Image
                          src={firstItem.boxDesignUri}
                          style={{ width: REMARK_W - 8, flex: 1, objectFit: "contain", marginTop: 2 }}
                        />
                      ) : null}
                    </View>

                    {/* LOGO — spans ALL colour rows and empty rows */}
                    <View style={S.logoSpan}>
                      {firstItem?.logoDesignUri ? (
                        <Image src={firstItem.logoDesignUri} style={{ width: D.logo - 4, height: 52, objectFit: "contain" }} />
                      ) : null}
                      {firstItem?.logoSpec ? <Text style={{ marginTop: 1, fontSize: 7 }}>{firstItem.logoSpec}</Text> : null}
                    </View>

                  </View>
                </View>
              );
            });

            return blocks;
          })}

        </View>

        <View style={S.footer} fixed>
          <Text>Happy2U Fashion Management System — CONFIDENTIAL</Text>
          <Text>{groupCode} · {supplier} · Generated {new Date().toLocaleDateString("en-MY")}</Text>
        </View>
      </Page>
    </Document>
  );
}
