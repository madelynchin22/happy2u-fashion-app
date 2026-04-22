"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate, rmbToRm } from "@/lib/utils";
import { FileDown, GitBranch, PackageCheck, Send, ChevronLeft, Save, Upload, X } from "lucide-react";

type Sample = {
  id: string; orderNumber: string; productName: string; productNumber?: string;
  version: number; status: string; brand: string; season?: string; sampleSize?: string;
  lastModel?: string; dateSent?: string; deadline?: string; receivedAt?: string;
  supplierSku?: string; h2uSku?: string; colorName?: string; colorCode?: string;
  materialUpper?: string; materialLining?: string; materialMidsole?: string;
  materialOutsole?: string; hardware?: string; logoSpec?: string;
  heelSpec?: string; platformSpec?: string;
  materialUpperPhoto?: string; materialLiningPhoto?: string; materialMidsolePhoto?: string;
  materialOutsolePhoto?: string; hardwarePhoto?: string; logoSpecPhoto?: string;
  heelSpecPhoto?: string; platformSpecPhoto?: string;
  materialUpperRemark?: string; materialLiningRemark?: string; materialMidsoleRemark?: string;
  materialOutsoleRemark?: string; hardwareRemark?: string; logoSpecRemark?: string;
  heelSpecRemark?: string; platformSpecRemark?: string;
  notesA?: string; notesB?: string; notesC?: string; notesD?: string; notesE?: string;
  generalNotes?: string; amendmentNotes?: string; ipNotes?: string; designSource?: string;
  receivedRemark?: string; productCostRmb?: number; productCostRm?: number;
  costRmb?: number; costRm?: number; suggestedRetailLow?: number; suggestedRetailHigh?: number;
  photoSideUrl?: string; photoBackUrl?: string; photoFrontUrl?: string;
  photoPlatformUrl?: string; photoHeelUrl?: string;
  manufacturer: { name: string; contactName?: string; contactWechat?: string };
  parent?: { id: string; orderNumber: string; version: number };
  children: { id: string; orderNumber: string; version: number; status: string }[];
};

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await r.json();
  return d.url ?? "";
}

function PhotoThumb({ url, onChange }: { url?: string; onChange?: (u: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  if (!url && !onChange) return null;
  return (
    <div className="flex items-center gap-2">
      {url
        ? <a href={url} target="_blank" rel="noopener noreferrer">
            <img src={url} alt="" className="w-12 h-12 object-cover rounded-lg border border-gray-200 hover:opacity-80" />
          </a>
        : onChange
          ? <button onClick={() => ref.current?.click()}
              className="w-12 h-12 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-brand-300 hover:text-brand-400">
              <Upload size={14} />
            </button>
          : null
      }
      {onChange && <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={async e => { const f = e.target.files?.[0]; if (f) { const u = await uploadFile(f); onChange(u); } e.target.value = ""; }} />}
    </div>
  );
}

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [sample, setSample]         = useState<Sample | null>(null);
  const [amending, setAmending]     = useState(false);
  const [amendNotes, setAmendNotes] = useState("");
  const [saving, setSaving]         = useState(false);
  const [rmbRate]                   = useState<number>(() => parseFloat(localStorage.getItem("rmbRate") ?? "0.62"));

  // Received stage edit state
  const [rcvEdit, setRcvEdit] = useState({ supplierSku: "", productCostRmb: "", receivedRemark: "" });
  const [rcvSaving, setRcvSaving] = useState(false);

  // PO stage edit state
  const [poEdit, setPoEdit] = useState({ h2uSku: "" });
  const [poSaving, setPoSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/samples/${id}`).then(r => r.json()).then((s: Sample) => {
      setSample(s);
      setRcvEdit({
        supplierSku: s.supplierSku ?? "",
        productCostRmb: s.productCostRmb ? String(s.productCostRmb) : "",
        receivedRemark: s.receivedRemark ?? "",
      });
      setPoEdit({ h2uSku: s.h2uSku ?? "" });
    });
  }, [id]);

  async function saveReceived() {
    setRcvSaving(true);
    const costRmb = parseFloat(rcvEdit.productCostRmb) || null;
    const costRm  = costRmb ? rmbToRm(costRmb, rmbRate) : null;
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplierSku: rcvEdit.supplierSku || null, productCostRmb: costRmb, productCostRm: costRm, receivedRemark: rcvEdit.receivedRemark || null }),
    });
    setRcvSaving(false);
    fetch(`/api/samples/${id}`).then(r => r.json()).then(setSample);
  }

  async function savePOStage() {
    setPoSaving(true);
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ h2uSku: poEdit.h2uSku || null }),
    });
    setPoSaving(false);
    fetch(`/api/samples/${id}`).then(r => r.json()).then(setSample);
  }

  async function updateStatus(status: string) {
    await fetch(`/api/samples/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, ...(status === "sent" ? { sentAt: new Date().toISOString() } : {}), ...(status === "received" ? { receivedAt: new Date().toISOString() } : {}) }),
    });
    fetch(`/api/samples/${id}`).then(r => r.json()).then(setSample);
  }

  async function createAmendment() {
    if (!amendNotes.trim()) { alert("Please describe what to amend."); return; }
    setSaving(true);
    const res = await fetch(`/api/samples/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amendmentNotes: amendNotes, status: "draft" }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/dashboard/samples/${data.id}`);
    }
  }

  async function downloadPdf() {
    const res = await fetch(`/api/samples/${id}/pdf`);
    if (res.ok) {
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `${sample?.orderNumber ?? "sample"}.pdf`; a.click();
    }
  }

  if (!sample) return <div className="py-20 text-center text-gray-400">Loading…</div>;

  const specRows = [
    { label: "Upper (鞋面)",   value: sample.materialUpper },
    { label: "Lining (内里)",  value: sample.materialLining },
    { label: "Midsole (中底)", value: sample.materialMidsole },
    { label: "Outsole (大底)", value: sample.materialOutsole },
    { label: "Hardware (五金)", value: sample.hardware },
    { label: "Heel (鞋跟)",   value: sample.heelSpec },
    { label: "Platform",       value: sample.platformSpec },
    { label: "Logo",           value: sample.logoSpec },
  ];

  const viewNotes = [
    { label: "A — Side",     notes: sample.notesA, photo: sample.photoSideUrl },
    { label: "B — Back",     notes: sample.notesB, photo: sample.photoBackUrl },
    { label: "C — Front",    notes: sample.notesC, photo: sample.photoFrontUrl },
    { label: "D — Platform", notes: sample.notesD, photo: sample.photoPlatformUrl },
    { label: "E — Heel",     notes: sample.notesE, photo: sample.photoHeelUrl },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/dashboard/samples" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600 mb-2">
            <ChevronLeft size={14} /> Back to samples
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{sample.orderNumber}</h1>
            <span className={`badge-${sample.status}`}>{sample.status}</span>
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">v{sample.version}</span>
          </div>
          <p className="text-gray-500 text-sm mt-1">{sample.productName} · {sample.manufacturer.name}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {sample.status === "draft" && (
            <button onClick={() => updateStatus("sent")} className="btn-primary flex items-center gap-2">
              <Send size={14} /> Mark Sent
            </button>
          )}
          {sample.status === "sent" && (
            <button onClick={() => updateStatus("received")} className="btn-secondary flex items-center gap-2">
              <PackageCheck size={14} /> Mark Received
            </button>
          )}
          {sample.status === "received" && (
            <button onClick={() => setAmending(true)} className="btn-secondary flex items-center gap-2">
              <GitBranch size={14} /> Create Amendment (v{sample.version + 1})
            </button>
          )}
          {sample.status === "received" && (
            <button onClick={() => updateStatus("approved")} className="btn-primary flex items-center gap-2">
              Approve Sample
            </button>
          )}
          <button onClick={downloadPdf} className="btn-secondary flex items-center gap-2">
            <FileDown size={14} /> Download PDF
          </button>
        </div>
      </div>

      {/* Version chain */}
      {(sample.parent || sample.children.length > 0) && (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <p className="text-xs font-medium text-amber-800 mb-2">Sample Version History</p>
          <div className="flex items-center gap-2 flex-wrap">
            {sample.parent && (
              <Link href={`/dashboard/samples/${sample.parent.id}`}
                className="text-xs bg-white border border-amber-200 px-3 py-1 rounded-full text-amber-700 hover:bg-amber-50">
                ← v{sample.parent.version} {sample.parent.orderNumber}
              </Link>
            )}
            <span className="text-xs bg-amber-200 text-amber-900 px-3 py-1 rounded-full font-medium">
              v{sample.version} (current)
            </span>
            {sample.children.map(c => (
              <Link key={c.id} href={`/dashboard/samples/${c.id}`}
                className="text-xs bg-white border border-amber-200 px-3 py-1 rounded-full text-amber-700 hover:bg-amber-50">
                v{c.version} {c.orderNumber} →
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Spec Sheet */}
        <div className="space-y-5">
          {/* Header Info */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">Spec Sheet Header</h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Product Number", sample.productNumber],
                ["Brand", sample.brand],
                ["Season", sample.season],
                ["Sample Size", sample.sampleSize ? `EU ${sample.sampleSize}` : "-"],
                ["Last Model", sample.lastModel],
                ["Date Sent", formatDate(sample.dateSent)],
                ["Deadline", formatDate(sample.deadline)],
                ["Manufacturer", sample.manufacturer.name],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-900 text-right">{v || "-"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* SKU */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-3">SKU & Color</h2>
            <dl className="space-y-2 text-sm">
              {[
                ["Supplier SKU", sample.supplierSku],
                ["H2U SKU", sample.h2uSku],
                ["Color", sample.colorName],
                ["Color Code", sample.colorCode],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-900">{v || "-"}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Right: Materials */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Material Specifications</h2>
          <div className="space-y-3">
            {[
              { label: "Upper (鞋面)",    val: sample.materialUpper,   photo: sample.materialUpperPhoto,   remark: sample.materialUpperRemark },
              { label: "Lining (内里)",   val: sample.materialLining,  photo: sample.materialLiningPhoto,  remark: sample.materialLiningRemark },
              { label: "Midsole (中底)",  val: sample.materialMidsole, photo: sample.materialMidsolePhoto, remark: sample.materialMidsoleRemark },
              { label: "Outsole (大底)",  val: sample.materialOutsole, photo: sample.materialOutsolePhoto, remark: sample.materialOutsoleRemark },
              { label: "Hardware (五金)", val: sample.hardware,         photo: sample.hardwarePhoto,         remark: sample.hardwareRemark },
              { label: "Heel (鞋跟)",    val: sample.heelSpec,         photo: sample.heelSpecPhoto,         remark: sample.heelSpecRemark },
              { label: "Platform",        val: sample.platformSpec,     photo: sample.platformSpecPhoto,     remark: sample.platformSpecRemark },
              { label: "Logo",            val: sample.logoSpec,         photo: sample.logoSpecPhoto,         remark: sample.logoSpecRemark },
            ].map(r => (
              <div key={r.label} className="border-b border-gray-50 pb-2 last:border-0">
                <div className="flex items-start gap-2">
                  {r.photo && <img src={r.photo} alt={r.label} className="w-10 h-10 object-cover rounded border border-gray-200 flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500">{r.label}</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{r.val || "—"}</p>
                    {r.remark && <p className="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-0.5">{r.remark}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* View Notes */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Product Views & Notes</h2>
        <div className="grid grid-cols-5 gap-3">
          {viewNotes.map(v => (
            <div key={v.label} className="text-center">
              <div className="bg-gray-100 rounded-lg aspect-square flex items-center justify-center mb-2 overflow-hidden">
                {v.photo
                  ? <img src={v.photo} alt={v.label} className="w-full h-full object-cover" />
                  : <span className="text-gray-400 text-xs">{v.label}</span>
                }
              </div>
              <p className="text-xs font-medium text-gray-700">{v.label}</p>
              {v.notes && <p className="text-xs text-gray-500 mt-1">{v.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Amendment & IP Notes */}
      {(sample.amendmentNotes || sample.ipNotes) && (
        <div className="card p-5 border-l-4 border-amber-400">
          <h2 className="font-semibold text-gray-900 mb-3">Design Changes & Instructions</h2>
          {sample.designSource && <p className="text-xs text-gray-500 mb-2">Source: {sample.designSource}</p>}
          {sample.ipNotes && <div className="mb-3"><p className="text-xs font-medium text-gray-600 mb-1">IP / Design Origin</p><p className="text-sm text-gray-800">{sample.ipNotes}</p></div>}
          {sample.amendmentNotes && <div><p className="text-xs font-medium text-gray-600 mb-1">Amendment Instructions to Manufacturer</p><p className="text-sm text-gray-800 whitespace-pre-wrap">{sample.amendmentNotes}</p></div>}
        </div>
      )}

      {/* Cost & Pricing */}
      {sample.costRm && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Cost & Pricing</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div><p className="text-xs text-gray-500">Cost (RMB)</p><p className="text-xl font-bold text-gray-900">¥ {sample.costRmb?.toFixed(2) ?? "-"}</p></div>
            <div><p className="text-xs text-gray-500">Cost (RM)</p><p className="text-xl font-bold text-gray-900">RM {sample.costRm.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Retail @ 75% margin</p><p className="text-xl font-bold text-green-700">RM {sample.suggestedRetailLow?.toFixed(2) ?? "-"}</p></div>
            <div><p className="text-xs text-gray-500">Retail @ 80% margin</p><p className="text-xl font-bold text-green-700">RM {sample.suggestedRetailHigh?.toFixed(2) ?? "-"}</p></div>
          </div>
        </div>
      )}

      {/* ── After Receiving Sample section ───────────────────────── */}
      {["received","approved","rejected"].includes(sample.status) && (
        <div className="card p-5 border-l-4 border-blue-400">
          <h2 className="font-semibold text-gray-900 mb-1">After Receiving Sample</h2>
          <p className="text-xs text-gray-400 mb-4">Fill in after the physical sample arrives from supplier.</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="label">Supplier SKU</label>
              <input className="input" value={rcvEdit.supplierSku}
                onChange={e => setRcvEdit(p => ({ ...p, supplierSku: e.target.value }))}
                placeholder="e.g. S1764" />
            </div>
            <div>
              <label className="label">Product Cost (RMB ¥)</label>
              <input className="input" type="number" step="0.01" value={rcvEdit.productCostRmb}
                onChange={e => setRcvEdit(p => ({ ...p, productCostRmb: e.target.value }))}
                placeholder="0.00" />
              {rcvEdit.productCostRmb && (
                <p className="text-xs text-gray-500 mt-1">
                  ≈ RM {rmbToRm(parseFloat(rcvEdit.productCostRmb) || 0, rmbRate).toFixed(2)}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Received Remark</label>
              <textarea className="input" rows={2} value={rcvEdit.receivedRemark}
                onChange={e => setRcvEdit(p => ({ ...p, receivedRemark: e.target.value }))}
                placeholder="Quality notes, issues found, changes requested…" />
            </div>
          </div>
          <button onClick={saveReceived} disabled={rcvSaving} className="btn-secondary flex items-center gap-2">
            <Save size={14} /> {rcvSaving ? "Saving…" : "Save Received Info"}
          </button>
          {(sample.supplierSku || sample.productCostRmb) && (
            <div className="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500 flex gap-6">
              {sample.supplierSku && <span>Supplier SKU: <strong className="text-gray-900">{sample.supplierSku}</strong></span>}
              {sample.productCostRmb && <span>Cost: <strong className="text-gray-900">¥{sample.productCostRmb} ≈ RM{sample.productCostRm?.toFixed(2)}</strong></span>}
            </div>
          )}
        </div>
      )}

      {/* ── Purchase Order stage — H2U SKU ───────────────────────── */}
      {["approved"].includes(sample.status) && (
        <div className="card p-5 border-l-4 border-green-400">
          <h2 className="font-semibold text-gray-900 mb-1">Purchase Order Stage</h2>
          <p className="text-xs text-gray-400 mb-4">Assign the H2U SKU when placing a Purchase Order for this product.</p>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">H2U SKU</label>
              <input className="input" value={poEdit.h2uSku}
                onChange={e => setPoEdit(p => ({ ...p, h2uSku: e.target.value }))}
                placeholder="e.g. S1764C" />
            </div>
            <button onClick={savePOStage} disabled={poSaving} className="btn-primary flex items-center gap-2">
              <Save size={14} /> {poSaving ? "Saving…" : "Save H2U SKU"}
            </button>
          </div>
          {sample.h2uSku && <p className="text-xs text-green-700 mt-2">H2U SKU assigned: <strong>{sample.h2uSku}</strong></p>}
        </div>
      )}

      {/* Amendment modal */}
      {amending && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-2">Create Amendment — v{sample.version + 1}</h2>
            <p className="text-sm text-gray-500 mb-4">All fields from v{sample.version} will be copied. Document what changed below.</p>
            <label className="label">Amendment Notes *</label>
            <textarea className="input mb-4" rows={5} value={amendNotes} onChange={e => setAmendNotes(e.target.value)}
              placeholder="Describe all changes from this sample: e.g. Change buckle from silver to gun-black. Reduce heel height from 8cm to 6cm. Change upper material to genuine leather." />
            <div className="flex gap-3">
              <button onClick={() => setAmending(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={createAmendment} className="btn-primary flex-1" disabled={saving}>
                {saving ? "Creating…" : "Create v" + (sample.version + 1)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
