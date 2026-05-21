"use client";
import { useEffect, useState, useMemo } from "react";
import { Plus, Plane, Ship, ArrowUpRight, AlertTriangle, X, ExternalLink } from "lucide-react";
import { format, differenceInDays, addDays, isWithinInterval } from "date-fns";

type ShipmentEvent = { id: string; eventType: string; eventDate: string; location?: string; notes?: string };
type Shipment = {
  id: string; shipmentNumber: string; containerNumber?: string; vesselName?: string;
  blNumber?: string; portOrigin?: string; portDestination?: string;
  shipDate?: string; estimatedArrival?: string; actualArrival?: string;
  status: string; notes?: string;
  destination?: { name: string; marking: string; country: string; address?: string };
  items: { totalPairs?: number; po: { poNumber: string; productName?: string; manufacturer?: { name: string } } }[];
  events: ShipmentEvent[];
  _count: { events: number };
};

// ── helpers ───────────────────────────────────────────────────────────────────

function detectMode(s: Shipment): "air" | "sea" {
  const text = `${s.vesselName ?? ""} ${s.blNumber ?? ""} ${s.containerNumber ?? ""}`.toLowerCase();
  if (/dhl|fedex|ups|tnt|airway|awb|\bair\b/.test(text)) return "air";
  return "sea";
}

function daysLate(s: Shipment, now: Date): number | null {
  if (!s.estimatedArrival) return null;
  const eta = new Date(s.estimatedArrival);
  if (s.status === "delivered" && s.actualArrival) {
    return Math.round(differenceInDays(new Date(s.actualArrival), eta));
  }
  if (s.status !== "delivered") {
    return differenceInDays(now, eta);
  }
  return null;
}

function isDelayed(s: Shipment, now: Date): boolean {
  const late = daysLate(s, now);
  return late != null && late > 0 && s.status !== "delivered";
}

function isArrivingThisWeek(s: Shipment, now: Date): boolean {
  if (!s.estimatedArrival) return false;
  if (!["in_transit","customs"].includes(s.status)) return false;
  const eta = new Date(s.estimatedArrival);
  return isWithinInterval(eta, { start: now, end: addDays(now, 7) });
}

const STATUS_PILL: Record<string, string> = {
  preparing:  "bg-gray-100 text-gray-600",
  in_transit: "bg-blue-100 text-blue-700",
  customs:    "bg-amber-100 text-amber-700",
  arrived:    "bg-teal-100 text-teal-700",
  delivered:  "bg-green-100 text-green-700",
};
const STATUS_LABEL: Record<string, string> = {
  preparing:  "Awaiting pickup", in_transit: "In transit",
  customs:    "Customs", arrived: "Arriving soon", delivered: "Delivered",
};

const TIMELINE_STEPS = [
  { key: "ready",    label: "Ready" },
  { key: "picked_up", label: "Picked up" },
  { key: "departed", label: "Departed origin" },
  { key: "customs",  label: "Customs" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

function currentStep(status: string): number {
  if (status === "preparing")  return 0;
  if (status === "in_transit") return 2;
  if (status === "customs")    return 3;
  if (status === "arrived")    return 4;
  if (status === "delivered")  return 5;
  return 0;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy");
}

function fmtShort(d?: string) {
  if (!d) return "—";
  return format(new Date(d), "dd/MM");
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
  const [now, setNow]             = useState(() => new Date());
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

    // Tick every minute so days-late counters stay accurate
    const tick = setInterval(() => setNow(new Date()), 60_000);
    // Refresh shipment data every 5 minutes
    const poll = setInterval(loadShipments, 300_000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, []);

  const inTransit       = shipments.filter(s => s.status === "in_transit").length;
  const awaitingPickup  = shipments.filter(s => s.status === "preparing").length;
  const arrivingWeek    = shipments.filter(s => isArrivingThisWeek(s, now)).length;
  const delayedList     = shipments.filter(s => isDelayed(s, now));
  const deliveredOnTime = shipments.filter(s => s.status === "delivered" && (daysLate(s, now) ?? 0) <= 0).length;
  const totalDelivered  = shipments.filter(s => s.status === "delivered").length;
  const onTimeRate      = totalDelivered > 0 ? Math.round(deliveredOnTime / totalDelivered * 100) : 0;

  const filtered = useMemo(() => shipments.filter(s => {
    if (filter === "awaiting")  return s.status === "preparing";
    if (filter === "in_transit") return s.status === "in_transit";
    if (filter === "customs")   return s.status === "customs";
    if (filter === "delivered") return s.status === "delivered";
    if (filter === "delayed")   return isDelayed(s, now);
    if (modeFilter === "air")   return detectMode(s) === "air";
    if (modeFilter === "sea")   return detectMode(s) === "sea";
    return true;
  }), [shipments, filter, modeFilter, now]);

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

  async function updateStatus(s: Shipment, status: string) {
    const extra = status === "delivered" ? { actualArrival: new Date().toISOString() } : {};
    await fetch(`/api/shipments/${s.id}`, {
      method:"PATCH", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ status, ...extra }),
    });
    fetch("/api/shipments").then(r => r.json()).then(d => { setShipments(d); setSelected(d.find((x: Shipment) => x.id === s.id) ?? null); });
  }

  const STATUS_NEXT: Record<string, { status: string; label: string }[]> = {
    preparing:  [{ status: "in_transit", label: "Mark in transit" }],
    in_transit: [{ status: "customs",    label: "Mark at customs" }, { status: "arrived", label: "Mark arrived" }],
    customs:    [{ status: "arrived",    label: "Mark arrived" }],
    arrived:    [{ status: "delivered",  label: "Mark delivered" }],
  };

  const selMode = selected ? detectMode(selected) : "sea";
  const selLate = selected ? daysLate(selected, now) : null;
  const selStep = selected ? currentStep(selected.status) : 0;
  const selTrack = selected ? trackingUrl(selected) : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {shipments.length} shipments · {inTransit} in transit
            {delayedList.length > 0 && ` · ${delayedList.length} delayed`}
            {arrivingWeek > 0 && ` · arriving this week: ${arrivingWeek}`}
          </p>
        </div>
        <button onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Plus size={14} /> New shipment
        </button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Awaiting pickup</p>
          <p className="text-3xl font-bold text-gray-900">{awaitingPickup}</p>
          <p className="text-xs text-gray-400 mt-1">Ready at factory</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">In transit</p>
          <p className="text-3xl font-bold text-gray-900">{inTransit}</p>
          <p className="text-xs text-gray-400 mt-1">
            {shipments.filter(s => s.status === "in_transit" && detectMode(s) === "air").length} air ·{" "}
            {shipments.filter(s => s.status === "in_transit" && detectMode(s) === "sea").length} sea
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Arriving this week</p>
          <p className="text-3xl font-bold text-gray-900">{arrivingWeek}</p>
          <p className="text-xs text-gray-400 mt-1">Prep receiving</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Delayed</p>
          <p className={`text-3xl font-bold ${delayedList.length > 0 ? "text-red-600" : "text-gray-900"}`}>
            {delayedList.length}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {delayedList.length > 0
              ? `${delayedList[0].shipmentNumber} · ${daysLate(delayedList[0], now)} days`
              : "All on schedule"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">On-time rate</p>
          <p className="text-3xl font-bold text-gray-900">{totalDelivered > 0 ? `${onTimeRate}%` : "—"}</p>
          <p className="text-xs text-gray-400 mt-1">Last 90 days</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key:"all",       label:"All" },
          { key:"awaiting",  label:"Awaiting pickup" },
          { key:"in_transit",label:"In transit" },
          { key:"customs",   label:"Customs" },
          { key:"delivered", label:"Delivered" },
          { key:"delayed",   label:"Delayed" },
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
                {["LINKED PO","PRODUCT","MODE","CARRIER · TRACKING","SHIP DATE","ETA","STATUS","DAYS LATE"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest text-gray-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => {
                const late   = daysLate(s, now);
                const mode   = detectMode(s);
                const isSelected = selected?.id === s.id;
                const batch  = isBatch(s);
                const totalPairs = s.items.reduce((t, i) => t + (i.totalPairs ?? 0), 0);
                const poNumbers  = s.items.map(i => i.po.poNumber);
                const manufacturers = [...new Set(s.items.map(i => i.po.manufacturer?.name).filter(Boolean))];
                return (
                  <tr key={s.id} onClick={() => setSelected(isSelected ? null : s)}
                    className={`cursor-pointer transition-colors ${isSelected ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                    <td className="px-4 py-3.5">
                      {poNumbers.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {poNumbers.map(pn => (
                            <span key={pn} className="text-brand-600 text-xs font-medium flex items-center gap-0.5">
                              {pn} <ArrowUpRight size={10} />
                            </span>
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
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {late == null ? "—"
                        : late === 0 ? <span className="text-xs text-gray-500">on time</span>
                        : late > 0   ? <span className="text-xs text-red-600 font-medium flex items-center gap-1">{late} days <AlertTriangle size={11} /></span>
                        : <span className="text-xs text-green-600 font-medium">{Math.abs(late)} days early</span>}
                    </td>
                  </tr>
                );
              })}
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
        const late = selLate;
        const isLate = late != null && late > 0 && selected.status !== "delivered";
        const isCustoms = selected.status === "customs";
        const batch = isBatch(selected);
        const selPoNumbers = selected.items.map(i => i.po.poNumber);
        const selLabel = batch ? batchLabel(selected) : (selected.items[0]?.po.productName ?? "Shipment");
        return (
          <div className="card p-5 space-y-5">
            {/* Detail header */}
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-bold text-gray-900 text-lg">{selected.shipmentNumber} · {selLabel}</h2>
                  {isCustoms && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex items-center gap-1">
                      <AlertTriangle size={10} /> Customs hold
                    </span>
                  )}
                  {isLate && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                      {late} days late
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {selPoNumbers.length > 0 && (
                    <span className="text-brand-600">{selPoNumbers.join(" · ")} ↗ · </span>
                  )}
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
                {(STATUS_NEXT[selected.status] ?? []).map(n => (
                  <button key={n.status} onClick={() => updateStatus(selected, n.status)}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    {n.label}
                  </button>
                ))}
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
                {isLate && (
                  <p className="text-xs text-red-600 mt-0.5">+{late} days delay</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-1">Ship date</p>
                <p className="text-sm font-medium text-gray-800">{fmtDate(selected.shipDate)}</p>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-3">Shipment timeline</p>
              <div className="relative">
                <div className="flex items-center justify-between relative">
                  {/* connector line */}
                  <div className="absolute left-0 right-0 top-3 h-0.5 bg-gray-100" />
                  <div className="absolute left-0 top-3 h-0.5 bg-teal-500 transition-all"
                    style={{ width: `${(selStep / (TIMELINE_STEPS.length - 1)) * 100}%` }} />
                  {TIMELINE_STEPS.map((step, i) => {
                    const done    = i < selStep;
                    const current = i === selStep;
                    const isAlert = step.key === "customs" && isCustoms;
                    return (
                      <div key={step.key} className="flex flex-col items-center relative z-10" style={{ minWidth: 60 }}>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
                          isAlert  ? "bg-red-100 border-red-400 text-red-600" :
                          done     ? "bg-teal-500 border-teal-500 text-white" :
                          current  ? "bg-white border-teal-500" :
                                     "bg-white border-gray-200"
                        }`}>
                          {isAlert ? "!" : done ? "✓" : ""}
                        </div>
                        <p className={`text-[10px] mt-1.5 text-center leading-tight ${current ? "text-gray-900 font-semibold" : "text-gray-400"}`}>
                          {step.label}
                        </p>
                        {i === 0 && selected.shipDate && (
                          <p className="text-[9px] text-gray-400">{fmtShort(selected.shipDate)}</p>
                        )}
                        {i === selStep && i > 0 && (
                          <p className="text-[9px] text-gray-400">now</p>
                        )}
                        {i === TIMELINE_STEPS.length - 1 && selected.estimatedArrival && (
                          <p className="text-[9px] text-gray-400">{fmtShort(selected.estimatedArrival)}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
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
            {isCustoms && selected.events.length === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">Shipment is currently held at customs. Add a shipment event to track progress.</p>
              </div>
            )}

            {/* Cargo details */}
            {selected.items.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase mb-2">Cargo details</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["LINKED PO","PRODUCT","PAIRS"].map(h => (
                        <th key={h} className="pb-2 text-left text-[10px] font-semibold tracking-widest text-gray-400">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selected.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2.5 text-brand-600 text-xs font-medium">{item.po.poNumber}</td>
                        <td className="py-2.5 text-gray-800">{item.po.productName ?? "—"}</td>
                        <td className="py-2.5 text-gray-700">{item.totalPairs ?? (item.po as any).totalPairs ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
