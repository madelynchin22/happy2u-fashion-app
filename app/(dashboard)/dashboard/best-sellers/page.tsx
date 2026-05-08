"use client";
import React, { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { ArrowUpRight, CheckCircle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

type PLItem = {
  id: string;
  libNumber: string;
  productName: string;
  h2uSku?: string;
  category?: string;
  colorName?: string;
  sellingPrice?: number;
  costRm?: number;
  inventoryTotal?: number;
  warehouseQty?: number;
  status?: string;
  sizeRange?: string;
  shoePhotoUrl?: string;
  compareAtPrice?: number;
  // Velocity (from Apr 6 → May 5 comparison)
  unitsSold?: number;
  daysTracked?: number;
  aprInventory?: number;
};

// ── PPS formula ───────────────────────────────────────────────────────────────
// Two-factor: velocity + margin  (sell-through excluded — no launch-inventory data)
// velScore  = min(100, pairsPerDay / 1.5 × 100)   — 1.5 pairs/day = velScore 100
// marScore  = min(100, grossMargin% × 1.5)         — 67%+ margin = 100
// pps       = round(velScore × 0.5 + marScore × 0.5)
// unitsSold = max(0, aprInventory − mayInventory)  — inventory decrease only
function computePPS(item: PLItem) {
  const hasMargin = !!(item.sellingPrice && item.costRm && item.sellingPrice > 0);
  const hasVel    = item.unitsSold != null && item.daysTracked != null && item.daysTracked > 0;

  const pairsPerDay = hasVel ? (item.unitsSold! / item.daysTracked!) : 0;
  const velScore    = Math.min(100, Math.round((pairsPerDay / 1.5) * 100));

  const margin   = hasMargin ? ((item.sellingPrice! - item.costRm!) / item.sellingPrice!) * 100 : null;
  const marScore = margin != null ? Math.min(100, Math.round(margin * 1.5)) : null;

  let pps  = 0;
  let mode: "both" | "margin" | "velocity" | "none" = "none";

  if (hasVel && hasMargin) {
    pps  = Math.min(99, Math.max(0, Math.round(velScore * 0.5 + marScore! * 0.5)));
    mode = "both";
  } else if (hasMargin) {
    pps  = Math.min(99, Math.max(0, marScore!));
    mode = "margin";
  } else if (hasVel) {
    pps  = Math.min(99, Math.max(0, velScore));
    mode = "velocity";
  }

  return {
    pps, velScore, marScore: marScore ?? 0,
    margin: margin != null ? Math.round(margin * 10) / 10 : null,
    pairsPerDay: Math.round(pairsPerDay * 100) / 100,
    mode, hasVel, hasMargin,
  };
}

function ppsLabel(pps: number): { label: string; dot: string; ring: string; bg: string; text: string; bar: string } {
  if (pps >= 80) return { label: "Hero",       dot: "bg-teal-500",  ring: "ring-teal-300",  bg: "bg-teal-50",  text: "text-teal-700",  bar: "bg-teal-400"  };
  if (pps >= 60) return { label: "Healthy",    dot: "bg-blue-500",  ring: "ring-blue-300",  bg: "bg-blue-50",  text: "text-blue-700",  bar: "bg-blue-400"  };
  if (pps >= 40) return { label: "Borderline", dot: "bg-amber-400", ring: "ring-amber-300", bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-400" };
  return           { label: "Archive",     dot: "bg-red-400",   ring: "ring-red-300",   bg: "bg-red-50",   text: "text-red-600",   bar: "bg-red-400"   };
}

function ppsCircle(pps: number) {
  const { dot, ring } = ppsLabel(pps);
  return `w-9 h-9 rounded-full inline-flex items-center justify-center text-xs font-bold text-white ring-2 ring-offset-1 ${dot} ${ring}`;
}

const COLOR_HEX: Record<string, string> = {
  black: "#1a1a1a", nude: "#C4956A", cream: "#F5EDD8", navy: "#1B2A4A",
  beige: "#D4B896", white: "#F4F4F4", pink: "#F4A0B0", red: "#C0392B",
  brown: "#7B5230", grey: "#9E9E9E", gray: "#9E9E9E", camel: "#C19A6B",
  tan: "#D2B48C", taupe: "#B5A595", khaki: "#C3B091", gold: "#D4AF37",
  silver: "#C0C0C0", espresso: "#3C1414", "sandy tan": "#C2A87A",
  "light brown": "#C8956C",
};
function colorHex(name?: string) { return name ? (COLOR_HEX[name.toLowerCase()] ?? "#CBD5E1") : "#CBD5E1"; }

const STATUS_DOT: Record<string, string> = {
  active: "bg-teal-500", low_stock: "bg-amber-400",
  out_of_stock: "bg-gray-400", clearance: "bg-red-400",
};

const PAGE_SIZE = 50;

type BandFilter = "all" | "hero" | "healthy" | "borderline" | "archive";

export default function BestSellersPage() {
  const [list, setList]         = useState<PLItem[]>([]);
  const [catF, setCatF]         = useState("");
  const [bandF, setBandF]       = useState<BandFilter>("all");
  const [sortBy, setSortBy]     = useState("pps");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage]         = useState(1);

  useEffect(() => {
    fetch("/api/product-library").then(r => r.json()).then(setList).catch(() => setList([]));
  }, []);

  const cats = useMemo(() =>
    [...new Set(list.map(i => i.category).filter(Boolean) as string[])].sort(),
  [list]);

  const catCounts = useMemo(() => {
    const m: Record<string,number> = {};
    for (const i of list) { const k = i.category ?? "other"; m[k] = (m[k] ?? 0) + 1; }
    return m;
  }, [list]);

  // All items with PPS computed
  const scored = useMemo(() =>
    list.map(item => ({ ...item, ...computePPS(item) })),
  [list]);

  // Ranked + filtered list
  const ranked = useMemo(() => {
    return [...scored]
      .filter(r => {
        if (catF && r.category !== catF) return false;
        if (bandF === "hero")       return r.pps >= 80;
        if (bandF === "healthy")    return r.pps >= 60 && r.pps < 80;
        if (bandF === "borderline") return r.pps >= 40 && r.pps < 60;
        if (bandF === "archive")    return r.pps < 40;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "velocity") return b.pairsPerDay - a.pairsPerDay;
        if (sortBy === "margin")   return (b.margin ?? -1) - (a.margin ?? -1);
        if (sortBy === "units")    return (b.unitsSold ?? 0) - (a.unitsSold ?? 0);
        if (sortBy === "name")     return a.productName.localeCompare(b.productName);
        return b.pps - a.pps;
      })
      .map((item, i) => ({ ...item, rank: i + 1 }));
  }, [scored, catF, bandF, sortBy]);

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const paginated  = ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); setExpandedId(null); }, [catF, bandF, sortBy]);

  // Summary stats (always from full scored list, not filtered)
  const heroCount      = useMemo(() => scored.filter(r => r.pps >= 80).length, [scored]);
  const healthyCount   = useMemo(() => scored.filter(r => r.pps >= 60 && r.pps < 80).length, [scored]);
  const borderlineCount = useMemo(() => scored.filter(r => r.pps >= 40 && r.pps < 60).length, [scored]);
  const archiveCount   = useMemo(() => scored.filter(r => r.pps < 40).length, [scored]);
  const totalUnitsSold  = useMemo(() => list.reduce((s, i) => s + (i.unitsSold ?? 0), 0), [list]);
  const soldSkuCount    = useMemo(() => list.filter(i => (i.unitsSold ?? 0) > 0).length, [list]);
  const allMargins     = useMemo(() => scored.map(r => r.margin).filter((m): m is number => m !== null), [scored]);
  const avgMargin      = allMargins.length ? Math.round(allMargins.reduce((s,m)=>s+m,0)/allMargins.length*10)/10 : null;
  const daysWindow     = list.find(i => i.daysTracked)?.daysTracked ?? 29;

  const catBreakdown = useMemo(() => {
    const m: Record<string,{n:number;sold:number}> = {};
    for (const i of list) if (i.category) {
      if (!m[i.category]) m[i.category] = {n:0,sold:0};
      m[i.category].n++;
      m[i.category].sold += i.unitsSold ?? 0;
    }
    return Object.entries(m).map(([cat,v]) => ({ cat, ...v }))
      .sort((a,b) => b.sold - a.sold).slice(0, 5);
  }, [list]);

  const colorBreakdown = useMemo(() => {
    const m: Record<string,{n:number;sold:number}> = {};
    for (const i of list) if (i.colorName) {
      const k = i.colorName.toLowerCase();
      if (!m[k]) m[k] = {n:0,sold:0};
      m[k].n++;
      m[k].sold += i.unitsSold ?? 0;
    }
    return Object.entries(m).map(([color,v]) => ({ color, ...v }))
      .sort((a,b) => b.sold - a.sold).slice(0, 5);
  }, [list]);

  function exportXLSX() {
    const data = ranked.map(r => ({
      Rank: r.rank, LibRef: r.libNumber, Product: r.productName,
      Category: r.category ?? "", Color: r.colorName ?? "", SKU: r.h2uSku ?? "",
      "Apr 6 Inventory": r.aprInventory ?? "",
      "May 5 Inventory": r.inventoryTotal ?? "",
      "Units Sold (29d)": r.unitsSold ?? 0,
      "Pairs/Day": r.pairsPerDay,
      "Velocity Score": r.velScore,
      "Cost (RM)": r.costRm ?? "",
      "Price (RM)": r.sellingPrice ?? "",
      "Margin %": r.margin ?? "",
      "Margin Score": r.marScore,
      PPS: r.pps,
      "PPS Band": ppsLabel(r.pps).label,
      Status: r.status ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PPS Ranking");
    XLSX.writeFile(wb, "pps-ranking-29d.xlsx");
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Best Sellers · PPS Ranking</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Velocity (Apr 6 → May 5, {daysWindow} days) + Margin · {list.length} SKUs
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={exportXLSX}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Export <ArrowUpRight size={13} />
          </button>
          <Link href="/dashboard/product-library"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors">
            Edit in Library
          </Link>
        </div>
      </div>

      {/* PPS legend — clickable to filter */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { key: "hero"       as BandFilter, range: "80–99", label: "Hero",       desc: "Reorder aggressively",  bg: "bg-teal-50",  activeBg: "bg-teal-100",  border: "border-teal-200",  activeBorder: "border-teal-500",  dot: "bg-teal-500",  text: "text-teal-700",  count: heroCount       },
          { key: "healthy"    as BandFilter, range: "60–79", label: "Healthy",    desc: "Standard reorder",      bg: "bg-blue-50",  activeBg: "bg-blue-100",  border: "border-blue-200",  activeBorder: "border-blue-500",  dot: "bg-blue-500",  text: "text-blue-700",  count: healthyCount    },
          { key: "borderline" as BandFilter, range: "40–59", label: "Borderline", desc: "Sell down, no reorder", bg: "bg-amber-50", activeBg: "bg-amber-100", border: "border-amber-200", activeBorder: "border-amber-500", dot: "bg-amber-400", text: "text-amber-700", count: borderlineCount },
          { key: "archive"    as BandFilter, range: "0–39",  label: "Archive",    desc: "Move to clearance",     bg: "bg-red-50",   activeBg: "bg-red-100",   border: "border-red-200",   activeBorder: "border-red-500",   dot: "bg-red-400",   text: "text-red-600",   count: archiveCount    },
        ].map(b => {
          const isActive = bandF === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setBandF(isActive ? "all" : b.key)}
              className={`rounded-xl p-3 text-left border-2 transition-all ${
                isActive
                  ? `${b.activeBg} ${b.activeBorder} shadow-md scale-[1.02]`
                  : `${b.bg} ${b.border} hover:shadow-sm hover:scale-[1.01]`
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${b.dot}`} />
                  <span className={`text-sm font-semibold ${b.text}`}>{b.range} · {b.label}</span>
                </div>
                <span className={`text-sm font-bold ${b.text}`}>{b.count}</span>
              </div>
              <p className="text-xs text-gray-500">{b.desc}</p>
              {isActive && <div className={`h-0.5 rounded-full mt-2 ${b.dot}`} />}
            </button>
          );
        })}
      </div>

      {/* Formula banner */}
      <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
        <div className="flex items-start gap-3">
          <CheckCircle size={18} className="text-teal-600 mt-0.5 shrink-0" />
          <p className="text-sm text-teal-800">
            <span className="font-semibold">PPS = velocity × 50% + margin × 50%.</span>{"  "}
            Velocity from inventory drop Apr 6→May 5 ({daysWindow} days) · benchmark 1.5 pairs/day = score 100 ·{" "}
            <span className="font-semibold text-teal-900">{totalUnitsSold.toLocaleString()} units sold</span> across {soldSkuCount} SKUs
          </p>
        </div>
        <Link href="/dashboard/ai-suggestions"
          className="text-xs text-teal-700 font-medium hover:underline flex items-center gap-1 shrink-0 ml-4">
          AI Suggestions <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Units sold</p>
          <p className="text-2xl font-bold text-teal-700">{totalUnitsSold.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{soldSkuCount} SKUs · Apr 6 → May 5 ({daysWindow}d)</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Hero SKUs (PPS 80+)</p>
          <p className="text-2xl font-bold text-gray-900">{heroCount}</p>
          <p className="text-xs text-gray-400 mt-1">{list.length ? Math.round(heroCount/list.length*100) : 0}% of catalog</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">Avg gross margin</p>
          <p className="text-2xl font-bold text-gray-900">{avgMargin != null ? `${avgMargin}%` : "—"}</p>
          <p className={`text-xs mt-1 ${(avgMargin ?? 0) >= 40 ? "text-teal-600" : (avgMargin ?? 0) >= 25 ? "text-amber-600" : "text-red-500"}`}>
            {(avgMargin ?? 0) >= 40 ? "Healthy" : (avgMargin ?? 0) >= 25 ? "Moderate" : "Needs attention"}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Ranking table */}
        <div className="lg:col-span-3 card overflow-hidden">

          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">
                {bandF === "all" ? "PPS Ranking" : `${bandF.charAt(0).toUpperCase() + bandF.slice(1)} SKUs`}
              </h2>
              <span className="text-xs text-gray-400">— {ranked.length} SKUs</span>
              {bandF !== "all" && (
                <button onClick={() => setBandF("all")}
                  className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 ml-1">
                  Show all
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs text-gray-400 mr-1">
                <Info size={12}/><span>Click row for breakdown</span>
              </div>
              <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
                value={catF} onChange={e => setCatF(e.target.value)}>
                <option value="">All categories</option>
                {cats.map(c => <option key={c} value={c}>{c} ({catCounts[c]})</option>)}
              </select>
              <select className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
                value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="pps">Sort: PPS ↓</option>
                <option value="velocity">Sort: Velocity ↓</option>
                <option value="units">Sort: Units sold ↓</option>
                <option value="margin">Sort: Margin ↓</option>
                <option value="name">Sort: Name A–Z</option>
              </select>
            </div>
          </div>

          {/* Pagination top */}
          {totalPages > 1 && (
            <div className="px-5 py-2 border-b border-gray-50 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, ranked.length)} of {ranked.length}
              </p>
              <Paginator page={page} totalPages={totalPages} setPage={setPage} />
            </div>
          )}

          {list.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">Loading SKUs…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="pl-5 pr-2 py-3 text-left text-[10px] font-semibold tracking-widest text-gray-400 w-8">#</th>
                  <th className="px-1 py-3 w-10"></th>
                  <th className="px-2 py-3 text-left text-[10px] font-semibold tracking-widest text-gray-400">PRODUCT</th>
                  <th className="px-2 py-3 text-left text-[10px] font-semibold tracking-widest text-gray-400 w-20">COLOR</th>
                  <th className="px-2 py-3 text-right text-[10px] font-semibold tracking-widest text-gray-400 w-20">SOLD (29d)</th>
                  <th className="px-2 py-3 text-right text-[10px] font-semibold tracking-widest text-gray-400 w-20">MARGIN</th>
                  <th className="px-2 py-3 text-center text-[10px] font-semibold tracking-widest text-gray-400 w-20">PPS</th>
                  <th className="pr-5 pl-2 py-3 text-right text-[10px] font-semibold tracking-widest text-gray-400 w-20">STOCK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.map(r => {
                  const expanded = expandedId === r.id;
                  const band = ppsLabel(r.pps);
                  const MEDALS = ["🥇","🥈","🥉"];

                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                      >
                        <td className="pl-5 pr-2 py-3">
                          <span className="text-sm">{r.rank <= 3 ? MEDALS[r.rank-1] : <span className="text-gray-400 text-xs font-mono">{r.rank}</span>}</span>
                        </td>
                        <td className="px-1 py-2">
                          {r.shoePhotoUrl ? (
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-gray-100">
                              <Image src={r.shoePhotoUrl} alt={r.productName} width={36} height={36} className="object-cover w-full h-full"/>
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-lg border border-dashed border-gray-200 bg-gray-50"/>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <p className="font-medium text-gray-900 leading-tight text-sm">{r.productName}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 capitalize">
                            {r.category ?? "—"}{r.h2uSku ? <span className="font-mono text-brand-600"> · {r.h2uSku}</span> : ""}
                          </p>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-sm border border-gray-200 shrink-0"
                              style={{ backgroundColor: colorHex(r.colorName) }}/>
                            <span className="text-xs text-gray-600 truncate max-w-[70px]">{r.colorName ?? "—"}</span>
                          </div>
                        </td>
                        {/* Sold column */}
                        <td className="px-2 py-3 text-right">
                          {r.unitsSold != null ? (
                            <div>
                              <p className={`text-sm font-bold ${
                                (r.unitsSold as number) >= 30 ? "text-teal-700"
                                : (r.unitsSold as number) >= 10 ? "text-blue-700"
                                : (r.unitsSold as number) >= 1 ? "text-amber-700"
                                : "text-gray-400"
                              }`}>{r.unitsSold as number}</p>
                              {(r.unitsSold as number) > 0 && (
                                <p className="text-[10px] text-gray-400">{r.pairsPerDay.toFixed(2)}/day</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {r.margin != null ? (
                            <span className={`text-sm font-bold ${
                              r.margin >= 60 ? "text-teal-700"
                              : r.margin >= 40 ? "text-blue-700"
                              : r.margin >= 25 ? "text-amber-700"
                              : "text-red-600"
                            }`}>{r.margin}%</span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {r.mode !== "none" ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={ppsCircle(r.pps)}>{r.pps}</span>
                              <span className={`text-[9px] font-semibold ${band.text}`}>{band.label}</span>
                            </div>
                          ) : <span className="text-[10px] text-gray-300">—</span>}
                        </td>
                        <td className="pr-5 pl-2 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.status && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[r.status] ?? "bg-gray-300"}`}/>}
                            <span className="text-xs text-gray-700 font-medium">{r.inventoryTotal ?? "—"}</span>
                          </div>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={8} className="px-5 py-4">
                            <div className={`rounded-xl p-4 border ${band.bg} ring-1 ${band.ring} border-transparent`}>

                              {/* PPS header */}
                              <div className="flex items-center gap-3 mb-4">
                                <span className={`text-2xl font-black ${band.text}`}>{r.pps}</span>
                                <div>
                                  <span className={`text-sm font-bold ${band.text}`}>{band.label}</span>
                                  {r.mode !== "both" && r.mode !== "none" && (
                                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-200 text-gray-500">
                                      {r.mode === "margin"   ? "margin-only (no sales data)" :
                                       r.mode === "velocity" ? "velocity-only (no cost data)" : ""}
                                    </span>
                                  )}
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {band.label === "Hero"       && "Reorder aggressively · strong velocity + healthy margin"}
                                    {band.label === "Healthy"    && "Standard reorder · good balance of velocity and margin"}
                                    {band.label === "Borderline" && "Watch closely · low velocity or thin margin — sell down first"}
                                    {band.label === "Archive"    && "Low performance · move to clearance · don't reorder"}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-3 text-sm">

                                {/* Velocity component */}
                                <div className="rounded-lg p-3 bg-white">
                                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 mb-2">⚡ VELOCITY · 50%</p>
                                  <p className="text-lg font-bold text-gray-900">{r.velScore}<span className="text-xs text-gray-400">/100</span></p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {r.unitsSold != null
                                      ? <>{r.unitsSold as number} units · {r.pairsPerDay.toFixed(2)} pairs/day</>
                                      : "No sales data"}
                                  </p>
                                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${r.velScore}%` }}/>
                                  </div>
                                  <p className="text-[10px] text-gray-400 mt-1.5">
                                    Apr 6: {r.aprInventory ?? "?"} → May 5: {r.inventoryTotal ?? "?"} · benchmark 1.5/day
                                  </p>
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    Score × 0.5 = <strong className="text-gray-700">{Math.round(r.velScore * 0.5)}</strong>
                                  </p>
                                </div>

                                {/* Margin component */}
                                <div className="bg-white rounded-lg p-3">
                                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 mb-2">💰 MARGIN · 50%</p>
                                  <p className="text-lg font-bold text-gray-900">{r.marScore}<span className="text-xs text-gray-400">/100</span></p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {r.margin != null
                                      ? <>{r.margin}% gross margin</>
                                      : "No cost/price data"}
                                  </p>
                                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${r.marScore}%` }}/>
                                  </div>
                                  {r.costRm && r.sellingPrice && (
                                    <p className="text-[10px] text-gray-400 mt-1.5">
                                      RM {r.costRm.toFixed(0)} → RM {r.sellingPrice.toFixed(0)} · {r.margin}% × 1.5
                                    </p>
                                  )}
                                  <p className="text-[10px] text-gray-400 mt-1">
                                    Score × 0.5 = <strong className="text-gray-700">{Math.round(r.marScore * 0.5)}</strong>
                                  </p>
                                </div>

                                {/* Combined + inventory */}
                                <div className="bg-white rounded-lg p-3">
                                  <p className="text-[10px] font-semibold tracking-widest text-gray-400 mb-2">📊 COMBINED</p>
                                  <p className="text-xs text-gray-500 mb-2">
                                    {Math.round(r.velScore * 0.5)} + {Math.round(r.marScore * 0.5)} = {r.pps}
                                  </p>
                                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-3">
                                    <div className={`h-full rounded-full ${band.bar}`} style={{ width: `${r.pps}%` }}/>
                                  </div>
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Status</span>
                                      <span className="capitalize font-medium text-gray-800">{r.status?.replace("_"," ") ?? "—"}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-gray-500">Current stock</span>
                                      <span className="font-bold text-gray-900">{r.inventoryTotal ?? "—"}</span>
                                    </div>
                                    {(r.warehouseQty ?? 0) > 0 && (
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Warehouse</span>
                                        <span className="text-gray-700">{r.warehouseQty}</span>
                                      </div>
                                    )}
                                    {r.aprInventory != null && r.unitsSold != null && r.aprInventory > 0 && (
                                      <div className="flex justify-between pt-1 border-t border-gray-100">
                                        <span className="text-gray-500">Sell-through</span>
                                        <span className="font-semibold text-gray-800">
                                          {Math.round(r.unitsSold / r.aprInventory * 100)}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, ranked.length)} of {ranked.length}
              </p>
              <Paginator page={page} totalPages={totalPages} setPage={setPage} />
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="lg:col-span-1 space-y-4">

          {/* PPS distribution */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">Score Distribution</h3>
            {[
              { key: "hero"       as BandFilter, label: "Hero 80+",         count: heroCount,       bar: "bg-teal-400",  text: "text-teal-700"  },
              { key: "healthy"    as BandFilter, label: "Healthy 60–79",    count: healthyCount,    bar: "bg-blue-400",  text: "text-blue-700"  },
              { key: "borderline" as BandFilter, label: "Borderline 40–59", count: borderlineCount, bar: "bg-amber-400", text: "text-amber-700" },
              { key: "archive"    as BandFilter, label: "Archive <40",      count: archiveCount,    bar: "bg-red-400",   text: "text-red-600"   },
              { key: "all"        as BandFilter, label: "No data",          count: scored.filter(r=>r.mode==="none").length, bar: "bg-gray-200", text: "text-gray-400" },
            ].map(b => (
              <button key={b.label}
                onClick={() => b.key !== "all" ? setBandF(bandF === b.key ? "all" : b.key) : undefined}
                className={`w-full flex items-center gap-2 mb-2 rounded ${b.key !== "all" ? "hover:bg-gray-50 cursor-pointer" : "cursor-default"} ${bandF === b.key ? "opacity-100" : ""}`}>
                <span className="text-[10px] text-gray-500 w-28 shrink-0 text-left">{b.label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${b.bar}`}
                    style={{ width: list.length ? `${b.count/list.length*100}%` : "0%" }}/>
                </div>
                <span className={`text-[10px] font-bold w-7 text-right shrink-0 ${b.text}`}>{b.count}</span>
              </button>
            ))}
          </div>

          {/* Top categories by units sold */}
          {catBreakdown.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Top Categories</h3>
              <div className="space-y-2">
                {catBreakdown.map(c => (
                  <button key={c.cat}
                    onClick={() => setCatF(catF === c.cat ? "" : c.cat)}
                    className={`w-full flex items-center justify-between text-xs rounded-lg px-2 py-1.5 transition-colors ${catF === c.cat ? "bg-gray-900 text-white" : "hover:bg-gray-50 text-gray-700"}`}>
                    <span className="capitalize font-medium">{c.cat}</span>
                    <div className="flex gap-2 items-center">
                      <span className={`${catF === c.cat ? "text-gray-300" : "text-gray-400"}`}>{c.sold} sold</span>
                      <span className={`font-semibold ${catF === c.cat ? "text-white" : "text-gray-600"}`}>{c.n}</span>
                    </div>
                  </button>
                ))}
                {catF && (
                  <button onClick={() => setCatF("")} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
                    ← All categories
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Top colors by units sold */}
          {colorBreakdown.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Top Colors</h3>
              <div className="space-y-2">
                {colorBreakdown.map(c => (
                  <div key={c.color} className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-sm shrink-0 border border-gray-200"
                      style={{ backgroundColor: colorHex(c.color) }}/>
                    <span className="text-xs text-gray-700 capitalize flex-1">{c.color}</span>
                    <span className="text-xs font-semibold text-gray-600">{c.sold}</span>
                    <span className="text-xs text-gray-400">{c.n} SKUs</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formula guide */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">PPS Formula</h3>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="bg-gray-50 rounded-lg p-2 font-mono text-[11px] space-y-1">
                <p>velScore = pairsPerDay / 1.5 × 100</p>
                <p>marScore = margin% × 1.5</p>
                <p className="font-bold text-gray-800">pps = vel×0.5 + mar×0.5</p>
              </div>
              <div className="pt-1 space-y-1">
                {[
                  { label: "1.5+/day + 67%+ margin", res: "99 Hero",      col: "text-teal-700"  },
                  { label: "1.0/day + 53% margin",   res: "80+ Hero",     col: "text-teal-700"  },
                  { label: "0.7/day + 50% margin",   res: "~68 Healthy",  col: "text-blue-700"  },
                  { label: "0.3/day + 45% margin",   res: "~47 Borderline", col: "text-amber-700" },
                  { label: "0/day + any margin",     res: "≤37 Archive",  col: "text-red-600"   },
                ].map(g => (
                  <div key={g.label} className="flex justify-between">
                    <span className="text-gray-400 text-[10px]">{g.label}</span>
                    <span className={`font-semibold text-[10px] ${g.col}`}>{g.res}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function Paginator({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button disabled={page===1} onClick={() => setPage(page-1)}
        className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronLeft size={14}/>
      </button>
      {Array.from({length: Math.min(totalPages,7)},(_,i)=>{
        let p: number;
        if (totalPages<=7) p=i+1;
        else if (page<=4) p=i+1;
        else if (page>=totalPages-3) p=totalPages-6+i;
        else p=page-3+i;
        return (
          <button key={p} onClick={()=>setPage(p)}
            className={`w-7 h-7 rounded text-xs font-semibold ${p===page?"bg-gray-900 text-white":"text-gray-600 hover:bg-gray-100"}`}>
            {p}
          </button>
        );
      })}
      <button disabled={page===totalPages} onClick={() => setPage(page+1)}
        className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
        <ChevronRight size={14}/>
      </button>
    </div>
  );
}
