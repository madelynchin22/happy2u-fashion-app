"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Plane, Ship, ArrowUpRight, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { Timeline, TimelinePO } from "@/components/purchase-orders/Timeline";

type ShipmentEvent = { id: string; eventType: string; eventDate: string; location?: string; notes?: string };
type Shipment = {
  id: string; shipmentNumber: string; containerNumber?: string; vesselName?: string;
  blNumber?: string; portOrigin?: string; portDestination?: string;
  shipDate?: string; estimatedArrival?: string; actualArrival?: string;
  status: string; notes?: string;
  destination?: { name: string; marking: string; country: string; address?: string };
  items: { totalPairs?: number; po: { id: string; poNumber: string; productName?: string; manufacturer?: { name: string } } }[];
  events: ShipmentEvent[];
  _count: { events: number };
};

// ── helpers ───────────────────────────────────────────────────────────────────

function detectMode(s: Shipment): "air" | "sea" {
  const text = `${s.vesselName ?? ""} ${s.blNumber ?? ""} ${s.containerNumber ?? ""}`.toLowerCase();
  if (/dhl|fedex|ups|tnt|airway|awb|\bair\b/.test(text)) return "air";
  return "sea";
}

// A shipment's status is derived entirely from its PO's shipment batches (see
// lib/po-shipment-sync.ts), not set manually: pending_ship_out (submitted, no
// colour has shipped yet), pending_arrival (something has shipped but not every
// ordered pair has arrived), completed (every colour's full quantity arrived).
const STATUS_PILL: Record<string, string> = {
  pending_ship_out: "bg-gray-100 text-gray-600",
  pending_arrival:  "bg-blue-100 text-blue-700",
  completed:        "bg-green-100 text-green-700",
};
const STATUS_LABEL: Record<string, string> = {
  pending_ship_out: "Pending Ship Out",
  pending_arrival:  "Pending Arrival",
  completed:        "Completed",
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy");
}

function isBatch(s: Shipment) { return s.shipmentNumber.startsWith("BATCH-"); }
function batchLabel(s: Shipment) {
  const dateStr = s.shipmentNumber.replace("BATCH-", "");
  return `${format(new Date(dateStr), "dd MMM yyyy")} Batch`;
}

function trackingUrl(s: Shipment): string | null {
  const ves = (s.vesselName ?? "").toLowerCase();
  const trk = s.blNumber ?? s.containerNumber ?? "";
  if (!trk) return null;
  if (/dhl/.test(ves))    return `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${trk}`;
  if (/fedex/.test(ves))  return `https://www.fedex.com/fedextrack/?trknbr=${trk}`;
  if (/maersk/.test(ves)) return `https://www.maersk.com/tracking/${trk}`;
  if (/evergreen/.test(ves)) return `https://ct.shipmentlink.com/servlet/TDB1_CargoTracking.do?BL_NO=${trk}`;
  return `https://www.track-trace.com/container?container=${trk}`;
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selected, setSelected]   = useState<Shipment | null>(null);
  const [filter, setFilter]       = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [modal, setModal]         = useState(false);
  const [outlets, setOutlets]     = useState<{id:string;name:string;marking:string}[]>([]);
  const [pos, setPos]             = useState<{id:string;poNumber:string}[]>([]);
  const [saving, setSaving]       = useState(false);
  const [poDetail, setPoDetail]   = useState<TimelinePO & { id: string } | null>(null);
  const [form, setForm]           = useState({
    containerNumber:"", vesselName:"", blNumber:"", portOrigin:"", portDestination:"",
    shipDate:"", estimatedArrival:"", destinationId:"", notes:"", poIds:[] as string[],
  });

  function loadShipments() {
    fetch("/api/shipments").then(r => r.json()).then(setShipments).catch(() => {});
  }

  useEffect(() => {
    loadShipments();
    fetch("/api/outlets").then(r => r.json()).then(setOutlets).catch(() => {});
    fetch("/api/purchase-orders").then(r => r.json()).then(setPos).catch(() => {});

    // Refresh shipment data every 5 minutes
    const poll = setInterval(loadShipments, 300_000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const poId = selected?.items[0]?.po.id;
    if (!poId) { setPoDetail(null); return; }
    fetch(`/api/purchase-orders/${poId}`).then(r => r.json()).then(setPoDetail).catch(() => {});
  }, [selected?.id]);

  async function refreshPoDetail(poId: string) {
    const fresh = await fetch(`/api/purchase-orders/${poId}`).then(r => r.json());
    if (fresh?.id) setPoDetail(fresh);
    loadShipments();
  }

  async function saveDeliveryDate(field: "shipDate" | "deliveryDate", value: string) {
    if (!poDetail) return;
    await fetch(`/api/purchase-orders/${poDetail.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    await refreshPoDetail(poDetail.id);
  }

  async function addShipmentBatch(itemId: string, initial: { pairs: number }) {
    if (!poDetail) return;
    await fetch(`/api/po-items/${itemId}/batches`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initial),
    });
    await refreshPoDetail(poDetail.id);
  }

  async function updateShipmentBatch(batchId: string, fields: { pairs?: number; shipDate?: string | null; arrivalDate?: string | null }) {
    if (!poDetail) return;
    const item = poDetail.items.find(i => i.shipmentBatches?.some(b => b.id === batchId));
    if (!item) return;
    await fetch(`/api/po-items/${item.id}/batches/${batchId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    await refreshPoDetail(poDetail.id);
  }

  async function deleteShipmentBatch(batchId: string) {
    if (!poDetail) return;
    const item = poDetail.items.find(i => i.shipmentBatches?.some(b => b.id === batchId));
    if (!item) return;
    await fetch(`/api/po-items/${item.id}/batches/${batchId}`, { method: "DELETE" });
    await refreshPoDetail(poDetail.id);
  }

  const pendingShipOut = shipments.filter(s => s.status === "pending_ship_out").length;
  const pendingArrival = shipments.filter(s => s.status === "pending_arrival").length;
  const completed      = shipments.filter(s => s.status === "completed").length;

  const filtered = useMemo(() => shipments.filter(s => {
    if (filter === "pending_ship_out") return s.status === "pending_ship_out";
    if (filter === "pending_arrival")  return s.status === "pending_arrival";
    if (filter === "completed")        return s.status === "completed";
    if (modeFilter === "air")   return detectMode(s) === "air";
    if (modeFilter === "sea")   return detectMode(s) === "sea";
    return true;
  }), [shipments, filter, modeFilter]);

  // Group by the PO each shipment belongs to — each shipping-marked PO gets its own
  // shipment now, so this is what "grouped by PO number" naturally means here.
  const groupedShipments = useMemo(() => {
    const groups: { key: string; poId: string | null; label: string; shipments: Shipment[] }[] = [];
    for (const s of filtered) {
      const po = s.items[0]?.po;
      const key = po?.poNumber ?? "__unlinked__";
      let g = groups.find(g => g.key === key);
      if (!g) { g = { key, poId: po?.id ?? null, label: po?.poNumber ?? "Not linked to a PO", shipments: [] }; groups.push(g); }
      g.shipments.push(s);
    }
    return groups;
  }, [filtered]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/shipments", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      setShipments(s => [d, ...s]);
      setModal(false);
      setForm({ containerNumber:"", vesselName:"", blNumber:"", portOrigin:"", portDestination:"", shipDate:"", estimatedArrival:"", destinationId:"", notes:"", poIds:[] });
    }
  }

  const selMode = selected ? detectMode(selected) : "sea";
  const selTrack = selected ? trackingUrl(selected) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {shipments.length} shipments · {pendingShipOut} pending ship out · {pendingArrival} pending arrival · {completed} completed
          </p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Plus size={14} /> New shipment
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Pending Ship Out</p>
          <p className="text-3xl font-bold text-gray-900">{pendingShipOut}</p>
          <p className="text-xs text-gray-400 mt-1">Submitted, not shipped yet</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Pending Arrival</p>
          <p className="text-3xl font-bold text-blue-600">{pendingArrival}</p>
          <p className="text-xs text-gray-400 mt-1">Shipping, not fully arrived</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Completed</p>
          <p className="text-3xl font-bold text-green-600">{completed}</p>
          <p className="text-xs text-gray-400 mt-1">Fully arrived</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key:"all",              label:"All" },
          { key:"pending_ship_out", label:"Pending Ship Out" },
          { key:"pending_arrival",  label:"Pending Arrival" },
          { key:"completed",        label:"Completed" },
        ].map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setModeFilter("all"); }}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f.key && modeFilter === "all"
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}>{f.label}</button>
        ))}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {[
          { key:"all", label:"All modes" },
          { key:"air", label:"Air only" },
          { key:"sea", label:"Sea only" },
        ].map(m => (
          <button key={m.key} onClick={() => { setModeFilter(m.key); if (m.key !== "all") setFilter("all"); }}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              modeFilter === m.key && (m.key === "all" ? filter === "all" : true)
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}>{m.label}</button>
        ))}
      </div>

      {/* Shipments table */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">No shipments match your filter.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["LINKED PO","PRODUCT","MODE","CARRIER · TRACKING","SHIP DATE","ETA","STATUS"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupedShipments.flatMap(g => [
                <tr key={`g-${g.key}`} className="bg-gray-900">
                  <td colSpan={7} className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      {g.poId ? (
                        <Link href={`/dashboard/purchase-orders?open=${g.poId}`}
                          className="text-white text-xs font-bold tracking-widest uppercase hover:underline flex items-center gap-1">
                          {g.label} <ArrowUpRight size={11} />
                        </Link>
                      ) : (
                        <span className="text-gray-400 text-xs font-bold tracking-widest uppercase">{g.label}</span>
                      )}
                      <span className="text-gray-400 text-[11px]">
                        {g.shipments.length} shipment{g.shipments.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </td>
                </tr>,
                ...g.shipments.map(s => {
                const mode   = detectMode(s);
                const isSelected = selected?.id === s.id;
                const batch  = isBatch(s);
                const totalPairs = s.items.reduce((t, i) => t + (i.totalPairs ?? 0), 0);
                const manufacturers = [...new Set(s.items.map(i => i.po.manufacturer?.name).filter(Boolean))];
                return (
                  <tr key={s.id} onClick={() => setSelected(isSelected ? null : s)}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3.5">
                      {s.items.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {s.items.map(item => (
                            <Link key={item.po.id} href={`/dashboard/purchase-orders?open=${item.po.id}`}
                              onClick={e => e.stopPropagation()}
                              className="text-brand-600 text-xs font-medium flex items-center gap-0.5 hover:underline w-fit">
                              {item.po.poNumber} <ArrowUpRight size={10} />
                            </Link>
                          ))}
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      {batch
                        ? <p className="font-medium text-gray-900 whitespace-nowrap">{batchLabel(s)}</p>
                        : <p className="font-medium text-gray-900 whitespace-nowrap">{s.items[0]?.po.productName ?? "—"}</p>
                      }
                      <p className="text-xs text-gray-400 mt-0.5">
                        {totalPairs} pairs
                        {manufacturers.length > 0 ? ` · ${manufacturers.join(", ")}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      {mode === "air"
                        ? <Plane size={16} className="text-blue-500" />
                        : <Ship size={16} className="text-teal-600" />}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-gray-800 whitespace-nowrap">{s.vesselName ?? "Pending pickup"}</p>
                      <p className="text-xs text-gray-400 font-mono">{s.blNumber ?? s.containerNumber ?? "Awaiting carrier"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{fmtDate(s.shipDate)}</td>
                    <td className="px-4 py-3.5 text-gray-600 whitespace-nowrap">{fmtDate(s.estimatedArrival)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_PILL[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                      </span>
                    </td>
                  </tr>
                );
                }),
              ])}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail view */}
      {!selected && (
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
          Detail view · click any shipment above
        </p>
      )}

      {selected && (() => {
        const batch = isBatch(selected);
        const selLabel = batch ? batchLabel(selected) : (selected.items[0]?.po.productName ?? "Shipment");
        return (
          <div className="card p-5 space-y-5">
            {/* Detail header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-gray-900 text-lg">{selected.shipmentNumber} · {selLabel}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_PILL[selected.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1 flex items-center flex-wrap gap-x-1">
                  {selected.items.map(item => (
                    <Link key={item.po.id} href={`/dashboard/purchase-orders?open=${item.po.id}`}
                      className="text-brand-600 hover:underline">
                      {item.po.poNumber}
                    </Link>
                  ))}
                  {selected.items.length > 0 && " · "}
                  {selected.items.reduce((t, i) => t + (i.totalPairs ?? 0), 0)} pairs
                  {[...new Set(selected.items.map(i => i.po.manufacturer?.name).filter(Boolean))].map(n => ` · ${n}`)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {selTrack && (
                  <a href={selTrack} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    Track with carrier <ArrowUpRight size={12} />
                  </a>
                )}
              </div>
            </div>

            {/* Info row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">Mode &amp; carrier</p>
                <div className="flex items-center gap-1.5">
                  {selMode === "air" ? <Plane size={14} className="text-blue-500" /> : <Ship size={14} className="text-teal-600" />}
                  <span className="text-sm font-medium text-gray-800">{selMode === "air" ? "Air" : "Sea"} · {selected.vesselName ?? "—"}</span>
                </div>
                <p className="text-xs text-gray-400 font-mono mt-1">{selected.blNumber ?? selected.containerNumber ?? "—"}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">Route</p>
                <p className="text-sm font-medium text-gray-800">
                  {selected.portOrigin ?? "Origin"} → {selected.portDestination ?? "Destination"}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">ETA</p>
                <p className="text-sm font-medium text-gray-800">{fmtDate(selected.estimatedArrival)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">Ship date</p>
                <p className="text-sm font-medium text-gray-800">{fmtDate(selected.shipDate)}</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="border border-gray-100 rounded-xl p-5">
              {poDetail ? (
                <Timeline po={poDetail} onSave={saveDeliveryDate}
                  onBatchAdd={addShipmentBatch}
                  onBatchUpdate={updateShipmentBatch}
                  onBatchDelete={deleteShipmentBatch} />
              ) : (
                <p className="text-xs text-gray-400">Loading timeline…</p>
              )}
            </div>

            {/* Events / alerts */}
            {selected.events.length > 0 && (
              <div className="space-y-2">
                {selected.events.slice(-3).map(ev => (
                  <div key={ev.id} className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
                    ev.eventType === "delay" || ev.eventType === "customs_hold"
                      ? "bg-red-50 border border-red-100" : "bg-gray-50"
                  }`}>
                    {(ev.eventType === "delay" || ev.eventType === "customs_hold") && (
                      <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-gray-800 capitalize">{ev.eventType.replace("_"," ")} · {fmtDate(ev.eventDate)}</p>
                      {ev.notes && <p className="text-gray-600 mt-0.5">{ev.notes}</p>}
                      {ev.location && <p className="text-xs text-gray-400 mt-0.5">{ev.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Destination */}
            {selected.destination && (
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">Destination</p>
                <p className="text-sm font-medium text-gray-800">{selected.destination.name}</p>
                {selected.destination.address && (
                  <p className="text-sm text-gray-500 mt-0.5">{selected.destination.address}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{selected.destination.marking} · {selected.destination.country}</p>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {selected._count.events} status update{selected._count.events !== 1 ? "s" : ""}
              </p>
              {selected.notes && <p className="text-xs text-gray-500">{selected.notes}</p>}
            </div>
          </div>
        );
      })()}

      {/* New Shipment Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New shipment</h2>
              <button onClick={() => setModal(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Carrier / vessel name</label>
                  <input className="input" value={form.vesselName} onChange={e => setForm(f=>({...f,vesselName:e.target.value}))} placeholder="DHL Express / Maersk" />
                </div>
                <div>
                  <label className="label">B/L or tracking number</label>
                  <input className="input" value={form.blNumber} onChange={e => setForm(f=>({...f,blNumber:e.target.value}))} placeholder="MAEU8901234" />
                </div>
                <div>
                  <label className="label">Container number</label>
                  <input className="input" value={form.containerNumber} onChange={e => setForm(f=>({...f,containerNumber:e.target.value}))} placeholder="ABCD1234567" />
                </div>
                <div>
                  <label className="label">Ship date</label>
                  <input className="input" type="date" value={form.shipDate} onChange={e => setForm(f=>({...f,shipDate:e.target.value}))} />
                </div>
                <div>
                  <label className="label">ETA</label>
                  <input className="input" type="date" value={form.estimatedArrival} onChange={e => setForm(f=>({...f,estimatedArrival:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Destination outlet</label>
                  <select className="input" value={form.destinationId} onChange={e => setForm(f=>({...f,destinationId:e.target.value}))}>
                    <option value="">Select outlet…</option>
                    {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.marking})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Port of origin</label>
                  <input className="input" value={form.portOrigin} onChange={e => setForm(f=>({...f,portOrigin:e.target.value}))} placeholder="Guangzhou, CN" />
                </div>
                <div>
                  <label className="label">Port of destination</label>
                  <input className="input" value={form.portDestination} onChange={e => setForm(f=>({...f,portDestination:e.target.value}))} placeholder="Port Klang, MY" />
                </div>
              </div>
              <div>
                <label className="label">Link purchase orders</label>
                <select className="input" multiple size={4} value={form.poIds}
                  onChange={e => setForm(f=>({...f, poIds: Array.from(e.target.selectedOptions, o => o.value)}))}>
                  {pos.map(p => <option key={p.id} value={p.id}>{p.poNumber}</option>)}
                </select>
                <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving?"Saving…":"Create shipment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
