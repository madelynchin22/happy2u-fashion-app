import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from "@react-pdf/renderer";

const S = StyleSheet.create({
  page:       { fontFamily: "Helvetica", fontSize: 9, padding: 28, color: "#1a1a1a" },
  header:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 14, borderBottom: "2pt solid #d03070", paddingBottom: 10 },
  title:      { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#d03070" },
  subtitle:   { fontSize: 10, color: "#888", marginTop: 2 },
  metaRight:  { alignItems: "flex-end" },
  metaRow:    { flexDirection: "row", gap: 4, marginBottom: 2 },
  metaLabel:  { color: "#888", width: 80, textAlign: "right" },
  metaValue:  { fontFamily: "Helvetica-Bold" },
  section:    { marginBottom: 10 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#d03070", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, borderBottom: "0.5pt solid #f6aac8", paddingBottom: 3 },
  row2:       { flexDirection: "row", gap: 10 },
  half:       { flex: 1 },
  table:      { borderTop: "0.5pt solid #e5e7eb", borderLeft: "0.5pt solid #e5e7eb" },
  tRow:       { flexDirection: "row" },
  tHead:      { backgroundColor: "#fdf4f7" },
  tCell:      { borderBottom: "0.5pt solid #e5e7eb", borderRight: "0.5pt solid #e5e7eb", padding: "4 6" },
  tLabel:     { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555", flex: 1 },
  tValue:     { fontSize: 9, flex: 2 },
  noteBox:    { backgroundColor: "#fffbeb", border: "0.5pt solid #fbbf24", borderRadius: 3, padding: 6, marginBottom: 8 },
  noteLabel:  { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#92400e", marginBottom: 3 },
  noteText:   { fontSize: 9, color: "#78350f", lineHeight: 1.5 },
  ipBox:      { backgroundColor: "#eff6ff", border: "0.5pt solid #93c5fd", borderRadius: 3, padding: 6, marginBottom: 8 },
  priceBox:   { backgroundColor: "#f0fdf4", border: "0.5pt solid #86efac", borderRadius: 3, padding: 8 },
  priceRow:   { flexDirection: "row", gap: 10 },
  priceItem:  { flex: 1, alignItems: "center" },
  priceAmt:   { fontFamily: "Helvetica-Bold", fontSize: 14, color: "#15803d" },
  priceLabel: { fontSize: 7, color: "#166534", marginTop: 2 },
  photoRow:   { flexDirection: "row", gap: 6 },
  photoBox:   { flex: 1, alignItems: "center" },
  photoLabel: { fontSize: 7, color: "#888", marginBottom: 3, fontFamily: "Helvetica-Bold" },
  photoImg:   { width: 70, height: 70, objectFit: "contain", border: "0.5pt solid #e5e7eb" },
  photoNote:  { fontSize: 7, color: "#555", marginTop: 3, textAlign: "center" },
  photoPlaceholder: { width: 70, height: 70, backgroundColor: "#f3f4f6", border: "0.5pt solid #e5e7eb" },
  footer:     { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#aaa", borderTop: "0.5pt solid #e5e7eb", paddingTop: 5 },
  versionBadge: { backgroundColor: "#fdf4f7", border: "0.5pt solid #f6aac8", borderRadius: 10, padding: "2 8", alignSelf: "flex-start" },
  versionText:  { color: "#d03070", fontFamily: "Helvetica-Bold", fontSize: 8 },
});

export function SampleOrderPDF({ sample }: { sample: any }) {
  const specRows = [
    ["Upper (鞋面)",    sample.materialUpper],
    ["Lining (内里)",   sample.materialLining],
    ["Midsole (中底)",  sample.materialMidsole],
    ["Outsole (大底)",  sample.materialOutsole],
    ["Hardware (五金)", sample.hardware],
    ["Heel (鞋跟)",    sample.heelSpec],
    ["Platform",        sample.platformSpec],
    ["Logo",            sample.logoSpec],
  ].filter(([, v]) => v);

  const views = [
    { label: "A — Side",     url: sample.photoSideUrl,     notes: sample.notesA },
    { label: "B — Back",     url: sample.photoBackUrl,     notes: sample.notesB },
    { label: "C — Front",    url: sample.photoFrontUrl,    notes: sample.notesC },
    { label: "D — Platform", url: sample.photoPlatformUrl, notes: sample.notesD },
    { label: "E — Heel",     url: sample.photoHeelUrl,     notes: sample.notesE },
  ];

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.title}>Happy2U</Text>
            <Text style={S.subtitle}>SAMPLE ORDER SPEC SHEET</Text>
          </View>
          <View style={S.metaRight}>
            <View style={S.versionBadge}><Text style={S.versionText}>v{sample.version} — {sample.orderNumber}</Text></View>
            <View style={[S.metaRow, { marginTop: 6 }]}>
              <Text style={S.metaLabel}>Manufacturer:</Text>
              <Text style={S.metaValue}>{sample.manufacturer?.name}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Date Sent:</Text>
              <Text style={S.metaValue}>{sample.dateSent ? new Date(sample.dateSent).toLocaleDateString("en-MY") : "-"}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Deadline:</Text>
              <Text style={S.metaValue}>{sample.deadline ? new Date(sample.deadline).toLocaleDateString("en-MY") : "-"}</Text>
            </View>
          </View>
        </View>

        {/* Product Info + SKU */}
        <View style={S.row2}>
          <View style={[S.section, S.half]}>
            <Text style={S.sectionTitle}>Product Information</Text>
            <View style={S.table}>
              {[
                ["Product Name",   sample.productName],
                ["Product Number", sample.productNumber],
                ["Brand",          sample.brand],
                ["Season",         sample.season],
                ["Sample Size",    sample.sampleSize ? `EU ${sample.sampleSize}` : "-"],
                ["Last Model",     sample.lastModel],
              ].map(([l, v]) => (
                <View key={l} style={[S.tRow]}>
                  <Text style={[S.tCell, S.tLabel]}>{l}</Text>
                  <Text style={[S.tCell, S.tValue]}>{v || "—"}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[S.section, S.half]}>
            <Text style={S.sectionTitle}>SKU & Color</Text>
            <View style={S.table}>
              {[
                ["Supplier SKU", sample.supplierSku],
                ["H2U SKU",      sample.h2uSku],
                ["Color Name",   sample.colorName],
                ["Color Code",   sample.colorCode],
              ].map(([l, v]) => (
                <View key={l} style={S.tRow}>
                  <Text style={[S.tCell, S.tLabel]}>{l}</Text>
                  <Text style={[S.tCell, S.tValue]}>{v || "—"}</Text>
                </View>
              ))}
            </View>

            <Text style={[S.sectionTitle, { marginTop: 8 }]}>Material Specifications</Text>
            <View style={S.table}>
              {specRows.map(([l, v]) => (
                <View key={l} style={S.tRow}>
                  <Text style={[S.tCell, S.tLabel]}>{l}</Text>
                  <Text style={[S.tCell, S.tValue]}>{v || "—"}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Product Views */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Product Views</Text>
          <View style={S.photoRow}>
            {views.map(v => (
              <View key={v.label} style={S.photoBox}>
                <Text style={S.photoLabel}>{v.label}</Text>
                {v.url
                  ? <Image src={v.url} style={S.photoImg} />
                  : <View style={S.photoPlaceholder} />
                }
                {v.notes && <Text style={S.photoNote}>{v.notes}</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Amendment Notes */}
        {sample.amendmentNotes && (
          <View style={S.noteBox}>
            <Text style={S.noteLabel}>AMENDMENT INSTRUCTIONS TO MANUFACTURER</Text>
            <Text style={S.noteText}>{sample.amendmentNotes}</Text>
          </View>
        )}

        {/* IP Notes */}
        {sample.ipNotes && (
          <View style={S.ipBox}>
            <Text style={[S.noteLabel, { color: "#1e40af" }]}>DESIGN ORIGIN (IP RECORD — HAPPY2U INTERNAL)</Text>
            <Text style={[S.noteText, { color: "#1e3a8a" }]}>{sample.ipNotes}</Text>
          </View>
        )}

        {/* General Notes */}
        {sample.generalNotes && (
          <View style={[S.noteBox, { backgroundColor: "#f9fafb", borderColor: "#d1d5db" }]}>
            <Text style={[S.noteLabel, { color: "#374151" }]}>GENERAL NOTES</Text>
            <Text style={[S.noteText, { color: "#374151" }]}>{sample.generalNotes}</Text>
          </View>
        )}

        {/* Pricing */}
        {sample.costRm && (
          <View style={S.priceBox}>
            <Text style={[S.sectionTitle, { borderBottom: "none", marginBottom: 6 }]}>Cost & Pricing</Text>
            <View style={S.priceRow}>
              <View style={S.priceItem}>
                <Text style={[S.priceAmt, { color: "#374151" }]}>¥ {sample.costRmb?.toFixed(2)}</Text>
                <Text style={S.priceLabel}>Supplier Cost (RMB)</Text>
              </View>
              <View style={S.priceItem}>
                <Text style={[S.priceAmt, { color: "#374151" }]}>RM {sample.costRm?.toFixed(2)}</Text>
                <Text style={S.priceLabel}>Cost (RM)</Text>
              </View>
              <View style={S.priceItem}>
                <Text style={S.priceAmt}>RM {sample.suggestedRetailLow?.toFixed(2)}</Text>
                <Text style={S.priceLabel}>Suggested Retail (75%)</Text>
              </View>
              <View style={S.priceItem}>
                <Text style={S.priceAmt}>RM {sample.suggestedRetailHigh?.toFixed(2)}</Text>
                <Text style={S.priceLabel}>Suggested Retail (80%)</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text>Happy2U Fashion Management System</Text>
          <Text>{sample.orderNumber} · v{sample.version} · {new Date().toLocaleDateString("en-MY")}</Text>
        </View>
      </Page>
    </Document>
  );
}
