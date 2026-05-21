"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, AlertTriangle, FileDown, Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

type DeliveryItem = {
  id: string; supplierSku?: string; h2uSku?: string; colorName?: string;
  expectedQty: number; receivedQty: number; discrepancyType?: string;
  damageDescription?: string; isFlagged: boolean;
};

type Delivery = {
  id: string; status: string; receivedAt?: string; notes?: string;
  outlet?: { name: string; marking: string };
  shipment?: {
    shipmentNumber: string; containerNumber?: string;
    items: { po: { id: string; poNumber: string; productName?: string } }[];
  };
  items: DeliveryItem[];
};

export default function DeliveriesPage() {
  const router  = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selected, setSelected]     = useState<Delivery | null>(null);
  const [editItems, setEditItems]   = useState<DeliveryItem[]>([]);
  const [saving, setSaving]         = useState(false);

  function loadDeliveries() {
    fetch("/api/deliveries").then(r => r.json()).then(setDeliveries).catch(() => {});
  }

  useEffect(() => {
    loadDeliveries();
    const poll = setInterval(loadDeliveries, 300_000);
    return () => clearInterval(poll);
  }, []);

  function openDelivery(d: Delivery) {
    setSelected(d);
    setEditItems(d.items.map(i => ({ ...i })));
  }

  async function saveQC() {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/deliveries/${selected.id}/qc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: editItems }),
    });
    setSaving(false);
    fetch("/api/deliveries").then(r => r.json()).then(setDeliveries);
    setSelected(null);
  }

  async function downloadReport(deliveryId: string) {
    const res = await fetch(`/api/deliveries/${deliveryId}/report`);
    if (res.ok) {
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `discrepancy-${deliveryId.slice(0,8)}.pdf`; a.click();
    }
  }

  const flaggedCount = deliveries.reduce((s, d) => s + d.items.filter(i => i.isFlagged).length, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliveries & QC</h1>
          <p className="text-gray-500 text-sm">{deliveries.length} deliveries · {flaggedCount} flagged items</p>
        </div>
      </div>

      {flaggedCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="text-red-500" size={20} />
          <p className="text-sm text-red-700 font-medium">{flaggedCount} discrepancy items need attention. Download the report and send to your supplier.</p>
        </div>
      )}

      <div className="space-y-3">
        {deliveries.map(d => {
          const flagged = d.items.filter(i => i.isFlagged);
          const linkedPO = d.shipment?.items[0]?.po;
          const statusColor: Record<string, string> = {
            pending: "bg-amber-100 text-amber-700",
            partial: "bg-blue-100 text-blue-700",
            complete: "bg-green-100 text-green-700",
            disputed: "bg-red-100 text-red-700",
          };
          return (
            <div key={d.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${flagged.length > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                    {flagged.length > 0 ? <AlertTriangle size={20} /> : <PackageCheck size={20} />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">
                        {linkedPO
                          ? <a href={`/dashboard/purchase-orders/${linkedPO.id}`} className="text-brand-600 hover:underline" onClick={e => e.stopPropagation()}>{linkedPO.poNumber}</a>
                          : (d.shipment?.shipmentNumber ?? "Delivery")}
                      </h3>
                      {linkedPO?.productName && <span className="text-sm text-gray-500">{linkedPO.productName}</span>}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColor[d.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {d.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                      {d.outlet && <span>{d.outlet.name} ({d.outlet.marking})</span>}
                      {d.shipment?.containerNumber && <span>Container: {d.shipment.containerNumber}</span>}
                      <span>Received: {formatDate(d.receivedAt)}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {d.items.length} colour{d.items.length !== 1 ? "s" : ""} · {flagged.length > 0 ? <span className="text-red-600 font-medium">{flagged.length} flagged</span> : <span className="text-green-600">All OK</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openDelivery(d)} className="btn-secondary text-xs">
                    Enter QC
                  </button>
                  {flagged.length > 0 && (
                    <button onClick={() => downloadReport(d.id)} className="btn-danger text-xs flex items-center gap-1">
                      <FileDown size={13} /> Discrepancy PDF
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {deliveries.length === 0 && (
          <div className="card p-16 text-center text-gray-400">No deliveries recorded yet.</div>
        )}
      </div>

      {/* QC Entry Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-lg font-semibold mb-1">QC Entry — {selected.shipment?.items[0]?.po?.poNumber ?? selected.shipment?.shipmentNumber ?? "Delivery"}</h2>
            <p className="text-sm text-gray-500 mb-4">Record actual quantities received. Flag discrepancies to generate a report.</p>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["SKU","H2U SKU","Color","Expected","Received","Diff","Type","Notes","Flag"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editItems.map((item, idx) => {
                    const diff = item.expectedQty - item.receivedQty;
                    return (
                      <tr key={item.id} className={item.isFlagged ? "bg-red-50" : ""}>
                        <td className="px-3 py-2 text-xs text-gray-500">{item.supplierSku ?? "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{item.h2uSku ?? "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{item.colorName ?? "-"}</td>
                        <td className="px-3 py-2 text-center font-medium">{item.expectedQty}</td>
                        <td className="px-2 py-1">
                          <input type="number" min="0" className="input w-16 text-center text-sm"
                            value={item.receivedQty}
                            onChange={e => {
                              const v = parseInt(e.target.value) || 0;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, receivedQty: v } : it));
                            }} />
                        </td>
                        <td className={`px-3 py-2 text-center font-bold ${diff > 0 ? "text-red-600" : diff < 0 ? "text-orange-600" : "text-green-600"}`}>
                          {diff === 0 ? "✓" : diff > 0 ? `-${diff}` : `+${Math.abs(diff)}`}
                        </td>
                        <td className="px-2 py-1">
                          <select className="input text-xs w-28"
                            value={item.discrepancyType ?? ""}
                            onChange={e => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, discrepancyType: e.target.value || undefined } : it))}>
                            <option value="">—</option>
                            <option value="shortage">Shortage</option>
                            <option value="overage">Overage</option>
                            <option value="damaged">Damaged</option>
                            <option value="wrong_item">Wrong Item</option>
                          </select>
                        </td>
                        <td className="px-2 py-1">
                          <input className="input text-xs w-32"
                            value={item.damageDescription ?? ""}
                            placeholder="Describe…"
                            onChange={e => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, damageDescription: e.target.value } : it))} />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={item.isFlagged}
                            onChange={e => setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, isFlagged: e.target.checked } : it))} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveQC} className="btn-primary flex-1" disabled={saving}>{saving?"Saving…":"Save QC"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
