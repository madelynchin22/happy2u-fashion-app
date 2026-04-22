import React from "react";
import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";

const BRAND  = "#333333";
const BEIGE  = "#f1e8de";
const BEIGE2 = "#e8ddd2";

const S = StyleSheet.create({
  page:        { fontFamily: "Helvetica", fontSize: 9, padding: 28, color: "#1a1a1a" },
  header:      { flexDirection: "row", justifyContent: "space-between", marginBottom: 14, borderBottom: "2pt solid #333333", paddingBottom: 10 },
  title:       { fontSize: 18, fontFamily: "Helvetica-Bold", color: BRAND },
  subtitle:    { fontSize: 10, color: "#888", marginTop: 2 },
  metaRight:   { alignItems: "flex-end" },
  metaRow:     { flexDirection: "row", gap: 4, marginBottom: 2 },
  metaLabel:   { color: "#888", width: 80, textAlign: "right" },
  metaValue:   { fontFamily: "Helvetica-Bold" },
  section:     { marginBottom: 10 },
  sectionTitle:{ fontSize: 8, fontFamily: "Helvetica-Bold", color: BRAND, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5, borderBottom: "0.5pt solid #e8ddd2", paddingBottom: 3 },
  row2:        { flexDirection: "row", gap: 10 },
  half:        { flex: 1 },
  table:       { borderTop: "0.5pt solid #e5e7eb", borderLeft: "0.5pt solid #e5e7eb" },
  tRow:        { flexDirection: "row" },
  tHead:       { backgroundColor: BEIGE },
  tCell:       { borderBottom: "0.5pt solid #e5e7eb", borderRight: "0.5pt solid #e5e7eb", padding: "4 6" },
  tLabel:      { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#555", flex: 1 },
  tValue:      { fontSize: 9, flex: 2 },
  noteBox:     { backgroundColor: "#fffbeb", border: "0.5pt solid #fbbf24", borderRadius: 3, padding: 6, marginBottom: 8 },
  noteLabel:   { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#92400e", marginBottom: 3 },
  noteText:    { fontSize: 9, color: "#78350f", lineHeight: 1.5 },
  ipBox:       { backgroundColor: "#eff6ff", border: "0.5pt solid #93c5fd", borderRadius: 3, padding: 6, marginBottom: 8 },
  priceBox:    { backgroundColor: "#f0fdf4", border: "0.5pt solid #86efac", borderRadius: 3, padding: 8 },
  priceRow:    { flexDirection: "row", gap: 10 },
  priceItem:   { flex: 1, alignItems: "center" },
  priceAmt:    { fontFamily: "Helvetica-Bold", fontSize: 14, color: "#15803d" },
  priceLabel:  { fontSize: 7, color: "#166534", marginTop: 2 },
  photoRow:    { flexDirection: "row", gap: 6 },
  photoBox:    { flex: 1, alignItems: "center" },
  photoLabel:  { fontSize: 7, color: "#888", marginBottom: 3, fontFamily: "Helvetica-Bold" },
  photoImg:    { width: 70, height: 70, objectFit: "contain", border: "0.5pt solid #e5e7eb" },
  photoPlaceholder: { width: 70, height: 70, backgroundColor: "#f3f4f6", border: "0.5pt solid #e5e7eb" },
  footer:      { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#aaa", borderTop: "0.5pt solid #e5e7eb", paddingTop: 5 },
  versionBadge:{ backgroundColor: BEIGE, border: "0.5pt solid #e8ddd2", borderRadius: 10, padding: "2 8", alignSelf: "flex-start" },
  versionText: { color: BRAND, fontFamily: "Helvetica-Bold", fontSize: 8 },
});

/** Safe coerce — always returns a string, never an object or undefined */
function s(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "string") return val.trim() || "—";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return "—";
}

function fmtDate(iso: any): string {
  if (!iso) return "—";
  try { return new Date(String(iso)).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return "—"; }
}

export function SampleOrderPDF({ sample }: { sample: any }) {
  const specRows: [string, string][] = [
    ["Upper (鞋面)",    sample.materialUpper],
    ["Lining (内里)",   sample.materialLining],
    ["Midsole (中底)",  sample.materialMidsole],
    ["Outsole (大底)",  sample.materialOutsole],
    ["Hardware (五金)", sample.hardware],
    ["Heel (鞋跟)",    sample.heelSpec],
    ["Platform",        sample.platformSpec],
    ["Logo",            sample.logoSpec],
  ].filter(([, v]) => v != null && v !== "") as [string, string][];

  const views = [
    { label: "A — Side",     url: sample.photoSideUrl,     notes: sample.notesA },
    { label: "B — Back",     url: sample.photoBackUrl,     notes: sample.notesB },
    { label: "C — Front",    url: sample.photoFrontUrl,    notes: sample.notesC },
    { label: "D — Platform", url: sample.photoPlatformUrl, notes: sample.notesD },
    { label: "E — Heel",     url: sample.photoHeelUrl,     notes: sample.notesE },
  ];

  const mfrName = sample.manufacturer?.name ?? sample.manufacturerName ?? "—";

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
            <View style={S.versionBadge}>
              <Text style={S.versionText}>v{s(sample.version)} — {s(sample.orderNumber)}</Text>
            </View>
            <View style={[S.metaRow, { marginTop: 6 }]}>
              <Text style={S.metaLabel}>Manufacturer:</Text>
              <Text style={S.metaValue}>{s(mfrName)}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Date Sent:</Text>
              <Text style={S.metaValue}>{fmtDate(sample.dateSent)}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>Deadline:</Text>
              <Text style={S.metaValue}>{fmtDate(sample.deadline)}</Text>
            </View>
          </View>
        </View>

        {/* Product Info + SKU side by side */}
        <View style={S.row2}>
          <View style={[S.section, S.half]}>
            <Text style={S.sectionTitle}>Product Information</Text>
            <View style={S.table}>
              {([
                ["Product Name",   sample.productName],
                ["Product Number", sample.productNumber],
                ["Brand",          sample.brand],
                ["Season",         sample.season],
                ["Sample Size",    sample.sampleSize ? `EU ${sample.sampleSize}` : null],
                ["Last Model",     sample.lastModel],
              ] as [string, any][]).map(([label, val]) => (
                <View key={label} style={S.tRow}>
                  <Text style={[S.tCell, S.tLabel]}>{label}</Text>
                  <Text style={[S.tCell, S.tValue]}>{s(val)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[S.section, S.half]}>
            <Text style={S.sectionTitle}>SKU &amp; Color</Text>
            <View style={S.table}>
              {([
                ["Supplier SKU", sample.supplierSku],
                ["H2U SKU",      sample.h2uSku],
                ["Color Name",   sample.colorName],
                ["Color Code",   sample.colorCode],
              ] as [string, any][]).map(([label, val]) => (
                <View key={label} style={S.tRow}>
                  <Text style={[S.tCell, S.tLabel]}>{label}</Text>
                  <Text style={[S.tCell, S.tValue]}>{s(val)}</Text>
                </View>
              ))}
            </View>

            {specRows.length > 0 && (
              <>
                <Text style={[S.sectionTitle, { marginTop: 8 }]}>Material Specifications</Text>
                <View style={S.table}>
                  {specRows.map(([label, val]) => (
                    <View key={label} style={S.tRow}>
                      <Text style={[S.tCell, S.tLabel]}>{label}</Text>
                      <Text style={[S.tCell, S.tValue]}>{s(val)}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
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
                  ? <Image src={String(v.url)} style={S.photoImg} />
                  : <View style={S.photoPlaceholder} />}
                {v.notes ? <Text style={S.photoNote}>{s(v.notes)}</Text> : null}
              </View>
            ))}
          </View>
        </View>

        {/* Amendment Notes */}
        {sample.amendmentNotes ? (
          <View style={S.noteBox}>
            <Text style={S.noteLabel}>AMENDMENT INSTRUCTIONS TO MANUFACTURER</Text>
            <Text style={S.noteText}>{s(sample.amendmentNotes)}</Text>
          </View>
        ) : null}

        {/* IP Notes */}
        {sample.ipNotes ? (
          <View style={S.ipBox}>
            <Text style={[S.noteLabel, { color: "#1e40af" }]}>DESIGN ORIGIN (IP RECORD)</Text>
            <Text style={[S.noteText, { color: "#1e3a8a" }]}>{s(sample.ipNotes)}</Text>
          </View>
        ) : null}

        {/* General Notes */}
        {sample.generalNotes ? (
          <View style={[S.noteBox, { backgroundColor: "#f9fafb", borderColor: "#d1d5db" }]}>
            <Text style={[S.noteLabel, { color: "#374151" }]}>GENERAL NOTES</Text>
            <Text style={[S.noteText, { color: "#374151" }]}>{s(sample.generalNotes)}</Text>
          </View>
        ) : null}

        {/* Pricing */}
        {sample.costRm ? (
          <View style={S.priceBox}>
            <Text style={[S.sectionTitle, { borderBottom: "none", marginBottom: 6 }]}>Cost &amp; Pricing</Text>
            <View style={S.priceRow}>
              <View style={S.priceItem}>
                <Text style={[S.priceAmt, { color: "#374151" }]}>¥ {sample.costRmb != null ? Number(sample.costRmb).toFixed(2) : "—"}</Text>
                <Text style={S.priceLabel}>Supplier Cost (RMB)</Text>
              </View>
              <View style={S.priceItem}>
                <Text style={[S.priceAmt, { color: "#374151" }]}>RM {sample.costRm != null ? Number(sample.costRm).toFixed(2) : "—"}</Text>
                <Text style={S.priceLabel}>Cost (RM)</Text>
              </View>
              {sample.suggestedRetailLow != null ? (
                <View style={S.priceItem}>
                  <Text style={S.priceAmt}>RM {Number(sample.suggestedRetailLow).toFixed(2)}</Text>
                  <Text style={S.priceLabel}>Suggested Retail (low)</Text>
                </View>
              ) : null}
              {sample.suggestedRetailHigh != null ? (
                <View style={S.priceItem}>
                  <Text style={S.priceAmt}>RM {Number(sample.suggestedRetailHigh).toFixed(2)}</Text>
                  <Text style={S.priceLabel}>Suggested Retail (high)</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text>Happy2U Fashion Management System</Text>
          <Text>{s(sample.orderNumber)} · v{s(sample.version)} · {new Date().toLocaleDateString("en-MY")}</Text>
        </View>

      </Page>
    </Document>
  );
}
