"use client";
import { useEffect, useState } from "react";
import { Plus, Container, MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";

type Shipment = {
  id: string; shipmentNumber: string; containerNumber?: string; vesselName?: string;
  status: string; shipDate?: string; estimatedArrival?: string; actualArrival?: string;
  destination?: { name: string; marking: string; country: string };
  items: { po: { poNumber: string } }[];
};

const STATUS_COLORS: Record<string, string> = {
  preparing:  "bg-gray-100 text-gray-700",
  in_transit: "bg-blue-100 text-blue-700",
  customs:    "bg-amber-100 text-amber-700",
  arrived:    "bg-green-100 text-green-700",
  delivered:  "bg-brand-100 text-brand-700",
};

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [modal, setModal]   = useState(false);
  const [outlets, setOutlets] = useState<{id:string;name:string;marking:string}[]>([]);
  const [pos, setPos]       = useState<{id:string;poNumber:string}[]>([]);
  const [form, setForm]     = useState({
    containerNumber:"", vesselName:"", blNumber:"", portOrigin:"", portDestination:"",
    shipDate:"", estimatedArrival:"", destinationId:"", notes:"", poIds:[] as string[],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/shipments").then(r => r.json()).then(setShipments);
    fetch("/api/outlets").then(r => r.json()).then(setOutlets).catch(() => {});
    fetch("/api/purchase-orders").then(r => r.json()).then(setPos).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/shipments", {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) { const d = await res.json(); setShipments(s => [d, ...s]); setModal(false); }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/shipments/${id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status, ...(status === "arrived" ? { actualArrival: new Date().toISOString() } : {}) }),
    });
    fetch("/api/shipments").then(r => r.json()).then(setShipments);
  }

  const statusOrder = ["preparing","in_transit","customs","arrived","delivered"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-500 text-sm">{shipments.length} total</p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Shipment
        </button>
      </div>

      <div className="space-y-3">
        {shipments.map(s => (
          <div key={s.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <Container size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{s.shipmentNumber}</h3>
                    {s.containerNumber && (
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                        {s.containerNumber}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {s.status.replace("_"," ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    {s.vesselName && <span>Vessel: {s.vesselName}</span>}
                    {s.destination && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {s.destination.name} ({s.destination.marking})
                      </span>
                    )}
                    {s.items.length > 0 && (
                      <span>POs: {s.items.map(i => i.po.poNumber).join(", ")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                    {s.shipDate && <span>Shipped: {formatDate(s.shipDate)}</span>}
                    {s.estimatedArrival && <span>ETA: {formatDate(s.estimatedArrival)}</span>}
                    {s.actualArrival && <span className="text-green-600">Arrived: {formatDate(s.actualArrival)}</span>}
                  </div>
                </div>
              </div>
              {/* Status progression */}
              <div className="flex gap-1">
                {statusOrder.filter(st => st !== s.status).map(st => (
                  <button key={st} onClick={() => updateStatus(s.id, st)}
                    className="text-xs bg-white border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded text-gray-600 capitalize transition-colors">
                    → {st.replace("_"," ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
        {shipments.length === 0 && (
          <div className="card p-16 text-center text-gray-400">No shipments recorded yet.</div>
        )}
      </div>

      {/* New Shipment Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-4">New Shipment</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Container Number</label>
                  <input className="input" value={form.containerNumber} onChange={e => setForm(f=>({...f,containerNumber:e.target.value}))} placeholder="ABCD1234567" />
                </div>
                <div>
                  <label className="label">Vessel Name</label>
                  <input className="input" value={form.vesselName} onChange={e => setForm(f=>({...f,vesselName:e.target.value}))} />
                </div>
                <div>
                  <label className="label">B/L Number</label>
                  <input className="input" value={form.blNumber} onChange={e => setForm(f=>({...f,blNumber:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Ship Date</label>
                  <input className="input" type="date" value={form.shipDate} onChange={e => setForm(f=>({...f,shipDate:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Est. Arrival</label>
                  <input className="input" type="date" value={form.estimatedArrival} onChange={e => setForm(f=>({...f,estimatedArrival:e.target.value}))} />
                </div>
                <div>
                  <label className="label">Destination Outlet</label>
                  <select className="input" value={form.destinationId} onChange={e => setForm(f=>({...f,destinationId:e.target.value}))}>
                    <option value="">Select outlet…</option>
                    {outlets.map(o => <option key={o.id} value={o.id}>{o.name} ({o.marking})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Port of Origin</label>
                  <input className="input" value={form.portOrigin} onChange={e => setForm(f=>({...f,portOrigin:e.target.value}))} placeholder="Guangzhou, CN" />
                </div>
                <div>
                  <label className="label">Port of Destination</label>
                  <input className="input" value={form.portDestination} onChange={e => setForm(f=>({...f,portDestination:e.target.value}))} placeholder="Port Klang, MY" />
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} className="btn-primary flex-1" disabled={saving}>{saving?"Saving…":"Create Shipment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
