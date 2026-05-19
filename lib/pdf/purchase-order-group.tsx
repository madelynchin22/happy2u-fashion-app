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
// Photo column: 90pt → data area: 1060pt
// Data columns (fixed total 811pt, remark takes flex remainder ~249pt)

const SIZES    = ["36","37","38","39","40","41","42"];
const PHOTO_W  = 90;
const EMPTY_ROWS = 5;

const D = {
  price: 32, // "$" column (unit price)
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
  total: 42,
  // remark: flex 1
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

  // Header row 1 (column labels)
  hRow1:      { flexDirection: "row", backgroundColor: "#f2f2f2", borderBottom: "0.5pt solid #aaa" },
  // Header row 2 (size numbers)
  hRow2:      { flexDirection: "row", backgroundColor: "#e8e8e8", borderBottom: "0.5pt solid #aaa" },
  th:         { padding: "2 1.5", fontSize: 6, fontFamily: "NotoSansSC", fontWeight: "bold", borderRight: "0.5pt solid #bbb", color: "#222", textAlign: "center" },
  thPhotoBox: { width: PHOTO_W, borderRight: "0.5pt solid #bbb" },

  // Product block (photo spans all rows via flex-row layout)
  block:      { flexDirection: "row", borderBottom: "0.75pt solid #888" },
  photoCol:   { width: PHOTO_W, borderRight: "0.75pt solid #888", padding: "5 4", alignItems: "center" },
  photoImg:   { width: 76, height: 68, objectFit: "contain" },
  photoSup:   { fontSize: 6.5, color: "#444", marginTop: 3, textAlign: "center" },
  photoRed:   { fontSize: 6.5, color: "#d03070", marginTop: 1, textAlign: "center" },
  dataSec:    { flex: 1 },

  // Data row
  tr:    { flexDirection: "row", borderBottom: "0.5pt solid #ddd" },
  td:    { padding: "2 1.5", fontSize: 7, borderRight: "0.5pt solid #ddd" },
  tdR:   { padding: "2 1.5", fontSize: 7 }, // last cell (no right border)

  // Empty row
  eRow:  { flexDirection: "row", height: 12, borderBottom: "0.5pt solid #ddd" },
  eCell: { borderRight: "0.5pt solid #ddd" },

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

        {/* ── Page header: title (center) + PO info box (right) ── */}
        <View style={S.pageHeader}>
          <View style={S.titleArea}>
            <Text style={S.titleText}>PURCHASE ORDER</Text>
          </View>

          <View style={S.metaOuter}>
            {/* PO info bordered box */}
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

            {/* Total / Paid / Pending */}
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

          {/* Header row 1: column names (bilingual) */}
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
            <Text style={[S.th, { flex: 1 }]}>{"备注\nRemarks"}</Text>
            <Text style={[S.th, { width: D.logo }]}>LOGO</Text>
            <Text style={[S.th, { width: D.del }]}>{"交货日期\nDelivery Date"}</Text>
            <Text style={[S.th, { width: SZ_SPAN_W }]}>尺码/SIZE</Text>
            <Text style={[S.th, { width: D.pairs }]}>{"双数\nPairs"}</Text>
            <Text style={[S.th, { width: D.total, borderRight: 0 }]}>{"总价\nTotal"}</Text>
          </View>

          {/* Header row 2: individual size numbers */}
          <View style={S.hRow2}>
            <View style={S.thPhotoBox} />
            {/* Blank cells maintaining column borders */}
            <View style={{ width: D.price, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.sku, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.main, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.h2u, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.color, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.code, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.mat, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ flex: 1, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.logo, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.del, borderRight: "0.5pt solid #bbb" }} />
            {/* Size numbers */}
            {SIZES.map(s => <Text key={s} style={[S.th, { width: D.sz }]}>{s}</Text>)}
            <View style={{ width: D.pairs, borderRight: "0.5pt solid #bbb" }} />
            <View style={{ width: D.total }} />
          </View>

          {/* ── Product blocks: one block per supplierSku group (matches Excel layout) ── */}
          {pos.flatMap((po: any) => {
            const isMulti    = pos.length > 1;
            const poSupplier = po.manufacturer?.name ?? supplier;

            // Group items by model: use h2uSku prefix (strip trailing color-code letters)
            // because supplierSku is only set on the first colour row; others have null or the manufacturer name
            const groups: { supplierSku: string; items: any[] }[] = [];
            for (const item of po.items ?? []) {
              // "S1625-2H" → "S1625-2",  "S1727BR" → "S1727",  "S1701RG" → "S1701"
              const modelKey = item.h2uSku?.replace(/[A-Z]+$/, "") || item.supplierSku || "";
              const last = groups[groups.length - 1];
              if (last && last.supplierSku === modelKey) {
                last.items.push(item);
              } else {
                // Display the real supplier SKU when the first item has one; fall back to derived key
                const displaySku = (item.supplierSku && /^[A-Z]\d/.test(item.supplierSku))
                  ? item.supplierSku
                  : modelKey;
                groups.push({ supplierSku: displaySku, items: [item] });
              }
            }

            const blocks: React.ReactNode[] = [];

            // PO separator header when printing multiple POs together
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

            // One block per supplierSku group
            groups.forEach((grp, gIdx) => {
              const photo         = grp.items[0]?.photoUrl ?? po.photoUrl ?? null;
              const deliveryDate  = grp.items[0]?.deliveryDate ?? po.deliveryDate;
              const deliveryLabel = deliveryDate
                ? new Date(deliveryDate).toLocaleDateString("en-MY", { month: "short", year: "2-digit" }).toUpperCase()
                : "";

              blocks.push(
                <View key={`${po.id}-${gIdx}`} style={S.block} wrap={false}>

                  {/* Photo column */}
                  <View style={S.photoCol}>
                    {photo
                      ? <Image src={photo} style={S.photoImg} />
                      : <View style={[S.photoImg, { backgroundColor: "#f3f4f6" }]} />}
                    <Text style={S.photoSup}>{poSupplier}</Text>
                    {deliveryLabel ? <Text style={S.photoRed}>{deliveryLabel}</Text> : null}
                  </View>

                  {/* Data section */}
                  <View style={S.dataSec}>

                    {/* Colour variant rows */}
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
                        {/* Material specs — shown only on first colour of each model group */}
                        <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialUpper   || "") : ""}</Text>
                        <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialLining  || "") : ""}</Text>
                        <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialMidsole || "") : ""}</Text>
                        <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.materialOutsole || "") : ""}</Text>
                        <Text style={[S.td, { width: D.mat }]}>{i === 0 ? (item.hardware        || "") : ""}</Text>

                        {/* REMARK: text + shoe box design image */}
                        <View style={[S.td, { flex: 1, flexDirection: "column" }]}>
                          {i === 0 && item.remark ? <Text>{item.remark}</Text> : null}
                          {i === 0 && item.boxDesignUri ? (
                            <Image src={item.boxDesignUri} style={{ width: "100%", height: 64, objectFit: "contain", marginTop: 2 }} />
                          ) : null}
                        </View>

                        {/* LOGO: logo design image + spec text */}
                        <View style={[S.td, { width: D.logo, flexDirection: "column", alignItems: "center" }]}>
                          {i === 0 && item.logoDesignUri ? (
                            <Image src={item.logoDesignUri} style={{ width: D.logo - 4, height: 52, objectFit: "contain" }} />
                          ) : null}
                          {i === 0 && item.logoSpec ? <Text style={{ marginTop: 1 }}>{item.logoSpec}</Text> : null}
                        </View>
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
                        <Text style={[S.tdR, { width: D.total, textAlign: "right", fontFamily: "NotoSansSC", fontWeight: "bold", color: "#d03070" }]}>
                          {item.lineTotal ? `¥${Math.round(item.lineTotal)}` : ""}
                        </Text>
                      </View>
                    ))}

                    {/* Empty filler rows for handwriting */}
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
                        <View style={[S.eCell, { flex: 1 }]} />
                        <View style={[S.eCell, { width: D.logo }]} />
                        <View style={[S.eCell, { width: D.del }]} />
                        {SIZES.map(s => <View key={s} style={[S.eCell, { width: D.sz }]} />)}
                        <View style={[S.eCell, { width: D.pairs }]} />
                        <View style={{ width: D.total }} />
                      </View>
                    ))}

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
