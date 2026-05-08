"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2, Save, X, Search, PackageSearch, BookOpen, FileDown } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Manufacturer = { id: string; name: string; leadTimeDays?: number; rating?: number };

type LineItem = {
  id?: string;
  sampleOrderId?: string;
  supplierSku: string; h2uSku: string; brand: string;
  colorName: string; colorCode: string;
  materialUpper: string; materialLining: string; materialMidsole: string;
  materialOutsole: string; hardware: string; logoSpec: string;
  remark: string; photoUrl: string; deliveryDate: string;
  qty35: number; qty36: number; qty37: number; qty38: number;
  qty39: number; qty40: number; qty41: number; qty42: number;
  totalPairs: number; discountPrice: string; lineTotal: number;
};

type Allocation = { name: string; pairs: number; pct: number; note: string };

type SampleOption = {
  id: string; orderNumber: string; brand: string; colorName?: string;
  productName: string; status: string; supplierSku?: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string;
  manufacturer: { name: string };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BRANDS   = ["Happy2U", "Blissfit", "Latex", "Cloudfeet", "Bunny"];
const SIZES    = ["35","36","37","38","39","40","41","42"];
const STATUSES = [
  { value: "draft",         label: "Draft" },
  { value: "sent",          label: "Sent" },
  { value: "in_production", label: "In production" },
  { value: "shipped",       label: "Shipped" },
  { value: "closed",        label: "Closed" },
];
const PO_TYPES = [
  { value: "",        label: "— No type —" },
  { value: "test",    label: "Test" },
  { value: "reorder", label: "Reorder" },
  { value: "replen",  label: "Replen" },
  { value: "clear",   label: "Clear" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyLine(): LineItem {
  return {
    supplierSku: "", h2uSku: "", brand: "", colorName: "", colorCode: "",
    materialUpper: "", materialLining: "", materialMidsole: "",
    materialOutsole: "", hardware: "", logoSpec: "", remark: "", photoUrl: "", deliveryDate: "",
    qty35:0, qty36:0, qty37:0, qty38:0, qty39:0, qty40:0, qty41:0, qty42:0,
    totalPairs: 0, discountPrice: "", lineTotal: 0,
  };
}

function calcLine(item: LineItem): LineItem {
  const totalPairs = SIZES.reduce((s, sz) => s + (Number((item as any)[`qty${sz}`]) || 0), 0);
  return { ...item, totalPairs, lineTotal: totalPairs * (parseFloat(item.discountPrice) || 0) };
}

function toDateInput(d?: string | null): string {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function POEditPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [mfrs, setMfrs]     = useState<Manufacturer[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [items, setItems]   = useState<LineItem[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  const [header, setHeader] = useState({
    poNumber: "", status: "draft", poType: "", productName: "", brand: "Happy2U",
    manufacturerId: "", sampleOrderId: "", parentPoNumber: "", destination: "",
    fxRate: "0.62", paymentTerms: "", paymentIncoterm: "",
    deliveryDate: "", productionStartDate: "", qcDate: "", shipDate: "",
    sizeCurveInsight: "", notes: "",
  });

  // Picker modal
  const [pickerOpen, setPickerOpen] = useState<null | { mode: "sample"; idx: number }>(null);
  const [samples, setSamples]   = useState<SampleOption[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");

  // Load PO
  useEffect(() => {
    fetch("/api/manufacturers").then(r => r.json()).then(setMfrs);
    fetch(`/api/purchase-orders/${id}`).then(r => r.json()).then((po: any) => {
      if (!po || po.error) return;
      setHeader({
        poNumber:            po.poNumber ?? "",
        status:              po.status ?? "draft",
        poType:              po.poType ?? "",
        productName:         po.productName ?? "",
        brand:               po.brand ?? "Happy2U",
        manufacturerId:      po.manufacturer?.id ?? "",
        sampleOrderId:       po.sampleOrderId ?? "",
        parentPoNumber:      po.parentPoNumber ?? "",
        destination:         po.destination ?? "",
        fxRate:              po.fxRate != null ? String(po.fxRate) : "0.62",
        paymentTerms:        po.paymentTerms ?? "",
        paymentIncoterm:     po.paymentIncoterm ?? "",
        deliveryDate:        toDateInput(po.deliveryDate),
        productionStartDate: toDateInput(po.productionStartDate),
        qcDate:              toDateInput(po.qcDate),
        shipDate:            toDateInput(po.shipDate),
        sizeCurveInsight:    po.sizeCurveInsight ?? "",
        notes:               po.notes ?? "",
      });

      // Map existing items
      const loadedItems: LineItem[] = (po.items ?? []).map((item: any) => ({
        id:              item.id,
        sampleOrderId:   item.sampleOrderId ?? undefined,
        supplierSku:     item.supplierSku ?? "",
        h2uSku:          item.h2uSku ?? "",
        brand:           item.brand ?? "",
        colorName:       item.colorName ?? "",
        colorCode:       item.colorCode ?? "",
        materialUpper:   item.materialUpper ?? "",
        materialLining:  item.materialLining ?? "",
        materialMidsole: item.materialMidsole ?? "",
        materialOutsole: item.materialOutsole ?? "",
        hardware:        item.hardware ?? "",
        logoSpec:        item.logoSpec ?? "",
        remark:          item.remark ?? "",
        photoUrl:        item.photoUrl ?? "",
        deliveryDate:    toDateInput(item.deliveryDate),
        qty35: item.qty35 ?? 0, qty36: item.qty36 ?? 0,
        qty37: item.qty37 ?? 0, qty38: item.qty38 ?? 0,
        qty39: item.qty39 ?? 0, qty40: item.qty40 ?? 0,
        qty41: item.qty41 ?? 0, qty42: item.qty42 ?? 0,
        totalPairs:   item.totalPairs ?? 0,
        discountPrice: item.discountPrice != null ? String(item.discountPrice) : "",
        lineTotal:    item.lineTotal ?? 0,
      }));
      setItems(loadedItems.length > 0 ? loadedItems : [emptyLine()]);

      // Parse allocations
      try {
        const parsed = JSON.parse(po.allocations ?? "[]");
        setAllocations(Array.isArray(parsed) ? parsed.map((a: any) => ({
          name: a.name ?? "", pairs: a.pairs ?? 0, pct: a.pct ?? 0, note: a.note ?? "",
        })) : []);
      } catch { setAllocations([]); }
    });
  }, [id]);

  function setH(field: string, value: string) {
    setHeader(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function setItemField(idx: number, field: string, value: string | number) {
    setItems(prev => {
      const n = [...prev];
      n[idx] = calcLine({ ...n[idx], [field]: value } as LineItem);
      return n;
    });
    setSaved(false);
  }

  function setAlloc(idx: number, field: keyof Allocation, value: string | number) {
    setAllocations(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], [field]: value };
      return n;
    });
    setSaved(false);
  }

  function openPicker(idx: number) {
    setPickerSearch("");
    setPickerOpen({ mode: "sample", idx });
    if (samples.length === 0)
      fetch("/api/samples").then(r => r.json()).then(setSamples);
  }

  function pickSample(s: SampleOption) {
    if (!pickerOpen) return;
    setItems(prev => {
      const n = [...prev];
      n[pickerOpen.idx] = calcLine({
        ...emptyLine(), sampleOrderId: s.id,
        brand:           s.brand ?? "",
        colorName:       s.colorName ?? "",
        materialUpper:   s.materialUpper ?? "",
        materialLining:  s.materialLining ?? "",
        materialMidsole: s.materialMidsole ?? "",
        materialOutsole: s.materialOutsole ?? "",
        hardware:        s.hardware ?? "",
        logoSpec:        s.logoSpec ?? "",
        supplierSku:     s.supplierSku ?? "",
      });
      return n;
    });
    setPickerOpen(null);
    setSaved(false);
  }

  const totalPairs = items.reduce((s, i) => s + i.totalPairs, 0);
  const totalPrice = items.reduce((s, i) => s + i.lineTotal,  0);
  const totalRm    = totalPrice * (parseFloat(header.fxRate) || 0.62);

  async function save() {
    if (!header.manufacturerId) { alert("Please select a Manufacturer."); return; }
    setSaving(true);
    const res = await fetch(`/api/purchase-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status:              header.status,
        poType:              header.poType || null,
        productName:         header.productName || null,
        brand:               header.brand,
        manufacturerId:      header.manufacturerId,
        sampleOrderId:       header.sampleOrderId || null,
        parentPoNumber:      header.parentPoNumber || null,
        destination:         header.destination || null,
        fxRate:              parseFloat(header.fxRate) || null,
        paymentTerms:        header.paymentTerms || null,
        paymentIncoterm:     header.paymentIncoterm || null,
        deliveryDate:        header.deliveryDate || null,
        productionStartDate: header.productionStartDate || null,
        qcDate:              header.qcDate || null,
        shipDate:            header.shipDate || null,
        sizeCurveInsight:    header.sizeCurveInsight || null,
        notes:               header.notes || null,
        allocations:         allocations.length > 0 ? JSON.stringify(allocations) : null,
        items: items.map(i => ({
          sampleOrderId:   i.sampleOrderId ?? null,
          supplierSku:     i.supplierSku   || null,
          h2uSku:          i.h2uSku        || null,
          brand:           i.brand         || null,
          colorName:       i.colorName     || null,
          colorCode:       i.colorCode     || null,
          materialUpper:   i.materialUpper   || null,
          materialLining:  i.materialLining  || null,
          materialMidsole: i.materialMidsole || null,
          materialOutsole: i.materialOutsole || null,
          hardware:        i.hardware      || null,
          logoSpec:        i.logoSpec      || null,
          remark:          i.remark        || null,
          photoUrl:        i.photoUrl      || null,
          deliveryDate:    i.deliveryDate  || null,
          qty35: i.qty35, qty36: i.qty36, qty37: i.qty37, qty38: i.qty38,
          qty39: i.qty39, qty40: i.qty40, qty41: i.qty41, qty42: i.qty42,
          totalPairs:    i.totalPairs,
          discountPrice: parseFloat(i.discountPrice) || null,
          lineTotal:     i.lineTotal,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); }
    else { let m = `HTTP ${res.status}`; try { const j = await res.json(); m = j.error || m; } catch {} alert(`Save failed: ${m}`); }
  }

  const q = pickerSearch.toLowerCase();
  const DONE = ["delivered","received","approved","ready","used"];
  const filteredSamples = samples.filter(s =>
    DONE.includes(s.status) &&
    (!q || s.orderNumber.toLowerCase().includes(q) ||
     (s.colorName ?? "").toLowerCase().includes(q) ||
     s.productName.toLowerCase().includes(q))
  );

  if (!header.poNumber) {
    return <div className="py-20 text-center text-gray-400">Loading…</div>;
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/purchase-orders" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-1">
            <ChevronLeft size={14} /> Back to purchase orders
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{header.poNumber}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{header.productName || header.brand}</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/purchase-orders/${id}/pdf`} target="_blank"
            className="btn-secondary flex items-center gap-2">
            <FileDown size={14} /> Download PDF
          </a>
          <button onClick={save} disabled={saving}
            className="btn-primary flex items-center gap-2 min-w-[110px]">
            <Save size={14} />
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
          </button>
        </div>
      </div>

      {/* ── Section 1: PO Details ──────────────────────────────────────────── */}
      <div className="card p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">PO Details</h2>

        <div className="grid grid-cols-4 gap-4">
          {/* Status */}
          <div>
            <label className="label">Status</label>
            <select className="input" value={header.status} onChange={e => setH("status", e.target.value)}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* PO Type */}
          <div>
            <label className="label">Type</label>
            <select className="input" value={header.poType} onChange={e => setH("poType", e.target.value)}>
              {PO_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="label">Brand</label>
            <select className="input" value={header.brand} onChange={e => setH("brand", e.target.value)}>
              {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Manufacturer */}
          <div>
            <label className="label">Manufacturer *</label>
            <select className="input" value={header.manufacturerId} onChange={e => setH("manufacturerId", e.target.value)}>
              <option value="">Select…</option>
              {mfrs.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Product name */}
          <div className="col-span-2">
            <label className="label">Product Name</label>
            <input className="input" value={header.productName} onChange={e => setH("productName", e.target.value)} placeholder="e.g. Mary Jane Beige" />
          </div>

          {/* Destination */}
          <div>
            <label className="label">Destination</label>
            <input className="input" value={header.destination} onChange={e => setH("destination", e.target.value)} placeholder="e.g. Melaka HQ" />
          </div>

          {/* FX Rate */}
          <div>
            <label className="label">FX Rate (¥/RM)</label>
            <input className="input" type="number" step="0.01" value={header.fxRate} onChange={e => setH("fxRate", e.target.value)} placeholder="0.62" />
          </div>

          {/* Linked SR */}
          <div>
            <label className="label">Linked Sample Order</label>
            <input className="input" value={header.sampleOrderId} onChange={e => setH("sampleOrderId", e.target.value)} placeholder="SR-2026-001" />
          </div>

          {/* Parent PO */}
          <div>
            <label className="label">Parent PO (reorder/replen)</label>
            <input className="input" value={header.parentPoNumber} onChange={e => setH("parentPoNumber", e.target.value)} placeholder="PO-2025-098" />
          </div>

          {/* Payment terms */}
          <div>
            <label className="label">Payment Terms</label>
            <input className="input" value={header.paymentTerms} onChange={e => setH("paymentTerms", e.target.value)} placeholder="30% deposit / 70% pre-ship" />
          </div>

          {/* Incoterm */}
          <div>
            <label className="label">Incoterm</label>
            <input className="input" value={header.paymentIncoterm} onChange={e => setH("paymentIncoterm", e.target.value)} placeholder="FOB Guangzhou" />
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input className="input" value={header.notes} onChange={e => setH("notes", e.target.value)} placeholder="Additional instructions…" />
          </div>
        </div>
      </div>

      {/* ── Section 2: Timeline ───────────────────────────────────────────── */}
      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Production Timeline</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Expected Arrival (ETA)", key: "deliveryDate" },
            { label: "Production Start",       key: "productionStartDate" },
            { label: "QC at Factory",          key: "qcDate" },
            { label: "Ship Date",              key: "shipDate" },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input className="input" type="date" value={(header as any)[key]}
                onChange={e => setH(key, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3: Line Items ─────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-900">Line Items</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalPairs} pairs · ¥{totalPrice.toFixed(0)} · RM {totalRm.toFixed(0)}
            </p>
          </div>
          <button onClick={() => setItems(i => [...i, emptyLine()])}
            className="btn-secondary flex items-center gap-2 text-xs">
            <Plus size={13} /> Add row
          </button>
        </div>

        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-xs min-w-[1400px]">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-2 py-2 text-left w-6">#</th>
                <th className="px-2 py-2 text-left">Src</th>
                <th className="px-2 py-2 text-left">Color</th>
                <th className="px-2 py-2 text-left">Code</th>
                <th className="px-2 py-2 text-left">Supplier SKU</th>
                <th className="px-2 py-2 text-left">H2U SKU</th>
                <th className="px-2 py-2 text-left">Upper</th>
                <th className="px-2 py-2 text-left">Lining</th>
                <th className="px-2 py-2 text-left">Insole</th>
                <th className="px-2 py-2 text-left">Outsole</th>
                <th className="px-2 py-2 text-left">Hardware</th>
                <th className="px-2 py-2 text-left">LOGO</th>
                <th className="px-2 py-2 text-left">备注</th>
                <th className="px-2 py-2 text-left">交货日期</th>
                {SIZES.map(s => <th key={s} className="px-1 py-2 text-center">{s}</th>)}
                <th className="px-2 py-2 text-center">Pairs</th>
                <th className="px-2 py-2 text-right">Price ¥</th>
                <th className="px-2 py-2 text-right">Total ¥</th>
                <th className="px-2 py-2 text-right">RM</th>
                <th className="px-1 py-2 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 1 ? "bg-gray-50" : "bg-white"}`}>
                  <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>

                  {/* Source picker */}
                  <td className="px-1 py-1.5">
                    <button onClick={() => openPicker(idx)}
                      className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap">
                      <PackageSearch size={10} /> SR
                    </button>
                    {item.sampleOrderId && (
                      <span className="text-[9px] text-blue-400 block mt-0.5">linked</span>
                    )}
                  </td>

                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-20" value={item.colorName}
                      onChange={e => setItemField(idx, "colorName", e.target.value)} placeholder="Color" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-12" value={item.colorCode}
                      onChange={e => setItemField(idx, "colorCode", e.target.value)} placeholder="Code" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-20" value={item.supplierSku}
                      onChange={e => setItemField(idx, "supplierSku", e.target.value)} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-20" value={item.h2uSku}
                      onChange={e => setItemField(idx, "h2uSku", e.target.value)} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-24" value={item.materialUpper}
                      onChange={e => setItemField(idx, "materialUpper", e.target.value)} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-20" value={item.materialLining}
                      onChange={e => setItemField(idx, "materialLining", e.target.value)} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-20" value={item.materialMidsole}
                      onChange={e => setItemField(idx, "materialMidsole", e.target.value)} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-24" value={item.materialOutsole}
                      onChange={e => setItemField(idx, "materialOutsole", e.target.value)} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-20" value={item.hardware}
                      onChange={e => setItemField(idx, "hardware", e.target.value)} />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-24" value={item.logoSpec}
                      onChange={e => setItemField(idx, "logoSpec", e.target.value)} placeholder="Logo spec" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input className="input text-xs w-28" value={item.remark}
                      onChange={e => setItemField(idx, "remark", e.target.value)} placeholder="Remark" />
                  </td>
                  <td className="px-1 py-1.5">
                    <input type="date" className="input text-xs w-32" value={item.deliveryDate}
                      onChange={e => setItemField(idx, "deliveryDate", e.target.value)} />
                  </td>

                  {/* Size quantities */}
                  {SIZES.map(s => (
                    <td key={s} className="px-1 py-1.5">
                      <input type="number" min="0" className="input text-xs w-10 text-center px-1"
                        value={(item as any)[`qty${s}`] || ""}
                        onChange={e => setItemField(idx, `qty${s}`, parseInt(e.target.value) || 0)} />
                    </td>
                  ))}

                  {/* Totals */}
                  <td className="px-2 py-1.5 text-center font-semibold text-brand-700">
                    {item.totalPairs || "—"}
                  </td>
                  <td className="px-1 py-1.5">
                    <input type="number" min="0" step="0.01" className="input text-xs w-16 text-right"
                      value={item.discountPrice}
                      onChange={e => setItemField(idx, "discountPrice", e.target.value)} />
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold text-gray-800">
                    {item.lineTotal > 0 ? `¥${item.lineTotal.toFixed(0)}` : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-gray-500">
                    {item.lineTotal > 0
                      ? `${(item.lineTotal * (parseFloat(header.fxRate) || 0.62)).toFixed(0)}`
                      : "—"}
                  </td>

                  {/* Delete */}
                  <td className="px-1 py-1.5 text-center">
                    <button onClick={() => { setItems(i => i.filter((_, j) => j !== idx)); setSaved(false); }}
                      className="text-gray-300 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={16} className="px-4 py-2.5 text-right font-semibold text-gray-600 text-xs uppercase tracking-wide">Total</td>
                <td className="px-2 py-2.5 text-center font-bold text-brand-700">{totalPairs} pairs</td>
                <td></td>
                <td className="px-2 py-2.5 text-right font-bold text-gray-800">¥{totalPrice.toFixed(0)}</td>
                <td className="px-2 py-2.5 text-right font-bold text-gray-600">RM {totalRm.toFixed(0)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Section 4: Size Curve Insight ────────────────────────────────── */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Size Curve Insight</h2>
        <textarea className="input w-full" rows={3} value={header.sizeCurveInsight}
          onChange={e => setH("sizeCurveInsight", e.target.value)}
          placeholder="e.g. Sizes 37–39 take 67% of the order based on historical bestseller mix…" />
      </div>

      {/* ── Section 5: Allocation by Destination ─────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Allocation by Destination</h2>
          <button onClick={() => { setAllocations(a => [...a, { name: "", pairs: 0, pct: 0, note: "" }]); setSaved(false); }}
            className="btn-secondary flex items-center gap-2 text-xs">
            <Plus size={13} /> Add destination
          </button>
        </div>
        {allocations.length === 0 ? (
          <p className="text-sm text-gray-400">No allocations set — click "Add destination" to define where stock goes.</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide px-1">
              <div className="col-span-4">Destination</div>
              <div className="col-span-2">Pairs</div>
              <div className="col-span-2">%</div>
              <div className="col-span-3">Note</div>
              <div></div>
            </div>
            {allocations.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input className="input text-sm col-span-4" value={a.name}
                  onChange={e => setAlloc(i, "name", e.target.value)} placeholder="e.g. Melaka HQ" />
                <input className="input text-sm col-span-2" type="number" value={a.pairs || ""}
                  onChange={e => setAlloc(i, "pairs", parseInt(e.target.value) || 0)} placeholder="0" />
                <input className="input text-sm col-span-2" type="number" value={a.pct || ""}
                  onChange={e => setAlloc(i, "pct", parseInt(e.target.value) || 0)} placeholder="0" />
                <input className="input text-sm col-span-3" value={a.note}
                  onChange={e => setAlloc(i, "note", e.target.value)} placeholder="online + warehouse" />
                <button onClick={() => { setAllocations(a => a.filter((_, j) => j !== i)); setSaved(false); }}
                  className="text-gray-300 hover:text-red-500 flex justify-center">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">
              Total allocated: {allocations.reduce((s, a) => s + a.pairs, 0)} pairs
              ({allocations.reduce((s, a) => s + a.pct, 0)}%)
            </p>
          </div>
        )}
      </div>

      {/* Save footer */}
      <div className="flex justify-end gap-3">
        <Link href="/dashboard/purchase-orders" className="btn-secondary">Back to list</Link>
        <button onClick={save} disabled={saving}
          className="btn-primary px-8 flex items-center gap-2">
          <Save size={14} />
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
        </button>
      </div>

      {/* Sample picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <PackageSearch size={16} className="text-blue-600" /> Pick from Sample Orders
              </h2>
              <button onClick={() => setPickerOpen(null)} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="px-6 py-3 border-b">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-8 text-sm w-full" placeholder="Search samples…"
                  value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredSamples.length === 0
                ? <p className="text-center text-gray-400 py-12 text-sm">No approved sample orders found.</p>
                : <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {["Ref No.", "Product", "Color", "Manufacturer"].map(h => (
                          <th key={h} className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredSamples.map(s => (
                        <tr key={s.id} onClick={() => pickSample(s)} className="hover:bg-blue-50 cursor-pointer">
                          <td className="px-4 py-2.5 font-mono text-xs font-semibold text-brand-700">{s.orderNumber}</td>
                          <td className="px-4 py-2.5 text-gray-900">{s.productName}</td>
                          <td className="px-4 py-2.5 text-gray-600">{s.colorName || "—"}</td>
                          <td className="px-4 py-2.5 text-gray-500">{s.manufacturer?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
            <div className="px-6 py-3 border-t text-xs text-gray-400">
              Click a row to fill line item #{(pickerOpen.idx) + 1}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
