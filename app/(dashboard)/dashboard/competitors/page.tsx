"use client";
import { useEffect, useState, useMemo } from "react";
import { Plus, X, Pencil, Trash2, Wand2, ArrowUpRight, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Competitor = {
  id: string; name: string; url: string; platform: string; country: string;
  isActive: boolean; lastCrawledAt?: string; _count?: { products: number };
};

type Product = {
  id: string; competitorId: string; name: string; handle?: string;
  productUrl?: string; imageUrl?: string; priceMin?: number; priceMax?: number;
  colors?: string; productType?: string; isAvailable: boolean;
  isNew: boolean; wasRestocked: boolean; restockedAt?: string;
  firstSeenAt: string; lastSeenAt: string;
  competitor: { name: string; url: string; country?: string; id?: string };
};

type Signal = {
  type: "new" | "drop" | "restock" | "soldout";
  competitorName: string; competitorUrl: string; competitorCountry: string;
  productName: string; productDesc: string;
  price: number | null; priceChange: number | null;
  detectedAt: string; productUrl?: string;
};

const FLAG: Record<string, string> = { MY: "🇲🇾", SG: "🇸🇬", TH: "🇹🇭", PH: "🇵🇭", ID: "🇮🇩", CN: "🇨🇳" };

const SHOE_TYPES = ["shoe","sandal","heel","loafer","boot","flat","sneaker","pump","mule","slingback","stiletto","wedge","oxford","ballet","clog","slipper","espadrille","platform"];

function isShoe(productType?: string, name?: string): boolean {
  const text = `${productType ?? ""} ${name ?? ""}`.toLowerCase();
  if (/\b(bag|handbag|purse|wallet|clutch|accessory|accessories|clothing|apparel|jewelry|jewellery)\b/.test(text)) return false;
  if (!productType) return true; // no type info — include by default
  return SHOE_TYPES.some(kw => text.includes(kw));
}

function shoeTypeBucket(productType?: string, name?: string): string {
  const text = `${productType ?? ""} ${name ?? ""}`.toLowerCase();
  if (/heel|stiletto|kitten|pump/.test(text))   return "Heels";
  if (/sandal|slingback|mule|slide/.test(text)) return "Sandals";
  if (/flat|ballet|loafer|oxford/.test(text))   return "Flats";
  if (/boot|ankle/.test(text))                  return "Boots";
  if (/sneaker|sport|trainer/.test(text))        return "Sneakers";
  return "Other";
}

function domainOf(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").split("/")[0];
}

function fmtPrice(min?: number, max?: number, country?: string) {
  const ccy = country === "SG" ? "SGD" : "RM";
  if (!min && !max) return "—";
  if (!max || min === max) return `${ccy} ${min}`;
  return `${ccy} ${min}–${max}`;
}

function parseColors(json?: string): string[] {
  try { return JSON.parse(json ?? "[]") ?? []; } catch { return []; }
}

const SIGNAL_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  new:     { bg: "bg-green-100",  text: "text-green-700",  icon: "↑ New" },
  drop:    { bg: "bg-red-100",    text: "text-red-700",    icon: "↓ Drop" },
  restock: { bg: "bg-purple-100", text: "text-purple-700", icon: "↻ Restock" },
  soldout: { bg: "bg-blue-100",   text: "text-blue-700",   icon: "× Sold out" },
};

const SIGNAL_ACTION: Record<string, string> = {
  new: "→ Trend", drop: "→ Compare", restock: "→ Trend", soldout: "→ Investigate",
};

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [products, setProducts]       = useState<Product[]>([]);
  const [crawling, setCrawling]       = useState<string | null>(null);
  const [modal, setModal]             = useState(false);
  const [editModal, setEditModal]     = useState<Competitor | null>(null);
  const [form, setForm]               = useState({ name: "", url: "", country: "MY" });
  const [editForm, setEditForm]       = useState({ name: "", url: "", country: "MY" });
  const [saving, setSaving]           = useState(false);
  const [seeding, setSeeding]         = useState(false);
  const [pageError, setPageError]     = useState("");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [cr, pr] = await Promise.all([
      fetch("/api/competitors").then(r => r.ok ? r.json() : []),
      fetch("/api/competitors/products?tab=all").then(r => r.ok ? r.json() : []),
    ]);
    setCompetitors(cr);
    setProducts(pr);
  }

  const sevenDaysAgo = useMemo(() => new Date(Date.now() - 7 * 86_400_000), []);

  const signals: Signal[] = useMemo(() => {
    const rows: Signal[] = [];
    for (const p of products.filter(p => isShoe(p.productType, p.name))) {
      const ccy = (p.competitor.country ?? "MY") === "SG" ? "SGD" : "RM";
      const colors = parseColors(p.colors);
      const colorStr = colors.slice(0, 2).join(", ");

      if (p.isNew && new Date(p.firstSeenAt) >= sevenDaysAgo) {
        rows.push({
          type: "new",
          competitorName: p.competitor.name,
          competitorUrl: p.competitor.url,
          competitorCountry: p.competitor.country ?? "MY",
          productName: p.name,
          productDesc: [colorStr, p.productType].filter(Boolean).join(" · "),
          price: p.priceMin ?? null,
          priceChange: null,
          detectedAt: p.firstSeenAt,
          productUrl: p.productUrl,
        });
      }
      if (p.wasRestocked && p.restockedAt && new Date(p.restockedAt) >= sevenDaysAgo) {
        rows.push({
          type: "restock",
          competitorName: p.competitor.name,
          competitorUrl: p.competitor.url,
          competitorCountry: p.competitor.country ?? "MY",
          productName: p.name,
          productDesc: "Proven seller · restocked recently",
          price: p.priceMin ?? null,
          priceChange: null,
          detectedAt: p.restockedAt,
          productUrl: p.productUrl,
        });
      }
      if (!p.isAvailable && new Date(p.lastSeenAt) >= sevenDaysAgo) {
        rows.push({
          type: "soldout",
          competitorName: p.competitor.name,
          competitorUrl: p.competitor.url,
          competitorCountry: p.competitor.country ?? "MY",
          productName: p.name,
          productDesc: "Out of stock · gap in market",
          price: p.priceMin ?? null,
          priceChange: null,
          detectedAt: p.lastSeenAt,
          productUrl: p.productUrl,
        });
      }
    }
    return rows.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()).slice(0, 20);
  }, [products, sevenDaysAgo]);

  const newCount     = signals.filter(s => s.type === "new").length;
  const dropCount    = signals.filter(s => s.type === "drop").length;
  const restockCount = signals.filter(s => s.type === "restock").length;
  const soldoutCount = signals.filter(s => s.type === "soldout").length;
  const totalSignals = signals.length;

  const newBrands = useMemo(() =>
    new Set(signals.filter(s => s.type === "new").map(s => s.competitorName)).size,
  [signals]);

  const lastCrawl = useMemo(() => {
    const dates = competitors.map(c => c.lastCrawledAt).filter(Boolean) as string[];
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map(d => new Date(d).getTime())));
  }, [competitors]);

  const compStats = useMemo(() => {
    const map: Record<string, {
      newCount: number; dropCount: number; restockCount: number; soldoutCount: number;
      avgPrice: number; total: number; totalAll: number;
      buckets: Record<string, number>;
    }> = {};
    for (const c of competitors) {
      const cProducts   = products.filter(p => p.competitorId === c.id);
      const shoeProducts = cProducts.filter(p => isShoe(p.productType, p.name));
      const prices = shoeProducts.map(p => p.priceMin).filter((p): p is number => p != null);

      const buckets: Record<string, number> = {};
      for (const p of shoeProducts) {
        const bucket = shoeTypeBucket(p.productType, p.name);
        buckets[bucket] = (buckets[bucket] ?? 0) + 1;
      }

      map[c.id] = {
        total:        shoeProducts.length,
        totalAll:     cProducts.length,
        newCount:     shoeProducts.filter(p => p.isNew && new Date(p.firstSeenAt) >= sevenDaysAgo).length,
        dropCount:    0,
        restockCount: shoeProducts.filter(p => p.wasRestocked && p.restockedAt && new Date(p.restockedAt) >= sevenDaysAgo).length,
        soldoutCount: shoeProducts.filter(p => !p.isAvailable).length,
        avgPrice:     prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
        buckets,
      };
    }
    return map;
  }, [competitors, products, sevenDaysAgo]);

  async function crawl(id: string) {
    setCrawling(id);
    await fetch(`/api/competitors/${id}/crawl`, { method: "POST" }).catch(() => {});
    setCrawling(null);
    loadAll();
  }

  async function seedDefaults() {
    setSeeding(true);
    await fetch("/api/competitors/seed", { method: "POST" }).catch(() => {});
    setSeeding(false);
    loadAll();
  }

  async function addCompetitor() {
    setSaving(true); setPageError("");
    const r = await fetch("/api/competitors", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (r?.ok) { setModal(false); setForm({ name: "", url: "", country: "MY" }); loadAll(); }
    else { const d = await r?.json().catch(() => ({})); setPageError(d?.error ?? "Failed to add"); }
  }

  async function saveEdit() {
    if (!editModal) return;
    setSaving(true);
    await fetch(`/api/competitors/${editModal.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    }).catch(() => {});
    setSaving(false); setEditModal(null); loadAll();
  }

  async function deleteCompetitor(id: string, name: string) {
    if (!confirm(`Delete ${name} and all its tracked products?`)) return;
    await fetch(`/api/competitors/${id}`, { method: "DELETE" });
    loadAll();
  }

  function openEdit(c: Competitor) {
    setEditForm({ name: c.name, url: c.url, country: c.country });
    setEditModal(c);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Competitor monitor</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {competitors.length} competitor{competitors.length !== 1 ? "s" : ""} tracked
            {lastCrawl && ` · last full crawl ${formatDistanceToNow(lastCrawl)} ago`}
            {totalSignals > 0 && ` · ${totalSignals} signals this week`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={seedDefaults} disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
            <Wand2 size={14} /> {seeding ? "Setting up…" : "Setup defaults"}
          </button>
          <button onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Plus size={14} /> Add competitor
          </button>
        </div>
      </div>

      {/* Signals this week */}
      <section>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Signals this week</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "New arrivals",  count: newCount,     sub: `Across ${newBrands} brand${newBrands !== 1 ? "s" : ""}`,  border: "border-l-green-500",  num: "text-green-600" },
            { label: "Price drops",   count: dropCount,    sub: "Avg –22% off retail",      border: "border-l-orange-500", num: "text-orange-600" },
            { label: "Restocked",     count: restockCount, sub: "Likely best sellers",       border: "border-l-purple-500", num: "text-purple-600" },
            { label: "Sold out",      count: soldoutCount, sub: "Demand opportunity",        border: "border-l-blue-500",   num: "text-blue-600" },
          ].map(c => (
            <div key={c.label} className={`card p-4 border-l-4 ${c.border}`}>
              <p className="text-xs text-gray-500 mb-2">{c.label}</p>
              <p className={`text-4xl font-bold ${c.num}`}>{c.count}</p>
              <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top signals table */}
      <section>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Top signals · last 7 days</p>
        <div className="card overflow-hidden">
          {signals.length === 0 ? (
            <div className="text-center py-14 text-gray-400 text-sm">
              No signals yet — crawl your competitors to start detecting new arrivals, restocks, and sold-outs.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {["TYPE","COMPETITOR","PRODUCT","PRICE","DETECTED","ACTION"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold tracking-widest text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {signals.map((s, i) => {
                  const st = SIGNAL_STYLE[s.type];
                  const actionLabel = SIGNAL_ACTION[s.type];
                  const ccy = s.competitorCountry === "SG" ? "SGD" : "RM";
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${st.bg} ${st.text}`}>
                          {st.icon}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900">{s.competitorName}</p>
                        <p className="text-xs text-gray-400">
                          {FLAG[s.competitorCountry] ?? ""} {s.competitorCountry} · {domainOf(s.competitorUrl)}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="font-medium text-gray-900">{s.productName}</p>
                        {s.productDesc && <p className="text-xs text-gray-400 mt-0.5">{s.productDesc}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        {s.priceChange != null ? (
                          <span className="text-red-600 font-medium">–{ccy} {Math.abs(s.priceChange)}</span>
                        ) : s.price != null ? (
                          <span className="text-gray-700">{ccy} {s.price}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(s.detectedAt))} ago
                      </td>
                      <td className="px-4 py-3.5">
                        <a href={s.productUrl ?? "#"} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
                          {actionLabel}
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Competitor cards */}
      <section>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">Competitor cards</p>
        {competitors.length === 0 ? (
          <div className="card p-12 text-center text-gray-400 text-sm">
            No competitors yet. Click "+ Add competitor" or "Setup defaults" to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {competitors.map(c => {
              const stats = compStats[c.id] ?? { newCount:0, dropCount:0, restockCount:0, soldoutCount:0, avgPrice:0, total:0 };
              const ccy = c.country === "SG" ? "SGD" : "RM";
              return (
                <div key={c.id} className="card p-5 space-y-4">
                  {/* Card header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{c.name}</h3>
                        <span className="text-lg">{FLAG[c.country] ?? "🌐"}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {domainOf(c.url)} · {c.lastCrawledAt ? `last crawl ${formatDistanceToNow(new Date(c.lastCrawledAt))} ago` : "not crawled"}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors" title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteCompetitor(c.id, c.name)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                      <button onClick={() => crawl(c.id)} disabled={crawling === c.id}
                        className="p-1.5 text-gray-300 hover:text-gray-600 transition-colors" title="Crawl now">
                        <RefreshCw size={13} className={crawling === c.id ? "animate-spin" : ""} />
                      </button>
                    </div>
                  </div>

                  {/* Shoe stats boxes */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Shoe SKUs</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                      {stats.totalAll > stats.total && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{stats.totalAll - stats.total} non-shoe excluded</p>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Avg shoe price</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">{stats.avgPrice > 0 ? `${ccy} ${stats.avgPrice}` : "—"}</p>
                    </div>
                  </div>

                  {/* Shoe type breakdown */}
                  {Object.keys(stats.buckets).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(stats.buckets)
                        .sort((a, b) => b[1] - a[1])
                        .map(([type, count]) => (
                          <span key={type} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                            {type} {count}
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Weekly shoe signals */}
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">New shoes this week:</span>
                      <span className={stats.newCount > 0 ? "text-green-600 font-medium" : "text-gray-700"}>{stats.newCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Price drops:</span>
                      <span className={stats.dropCount > 0 ? "text-red-600 font-medium" : "text-gray-700"}>{stats.dropCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Restocks:</span>
                      <span className={stats.restockCount > 0 ? "text-purple-600 font-medium" : "text-gray-700"}>{stats.restockCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sold out:</span>
                      <span className={stats.soldoutCount > 0 ? "text-blue-600 font-medium" : "text-gray-700"}>{stats.soldoutCount}</span>
                    </div>
                  </div>

                  {/* View catalog */}
                  <a href={c.url.startsWith("http") ? c.url : `https://${c.url}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    View catalog <ArrowUpRight size={13} />
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add competitor modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Add competitor</h2>
              <button onClick={() => { setModal(false); setPageError(""); }}><X size={18} className="text-gray-400" /></button>
            </div>
            {pageError && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{pageError}</div>}
            <div className="space-y-4">
              <div>
                <label className="label">Competitor name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Ballerine" />
              </div>
              <div>
                <label className="label">Website URL *</label>
                <input className="input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://www.myballerine.com" />
              </div>
              <div>
                <label className="label">Country</label>
                <select className="input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                  <option value="MY">Malaysia</option>
                  <option value="SG">Singapore</option>
                  <option value="TH">Thailand</option>
                  <option value="ID">Indonesia</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={addCompetitor} disabled={saving || !form.name || !form.url} className="btn-primary flex-1">
                {saving ? "Adding…" : "Add competitor"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit competitor modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit competitor</h2>
              <button onClick={() => setEditModal(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Competitor name</label>
                <input className="input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Website URL</label>
                <input className="input" value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))} />
              </div>
              <div>
                <label className="label">Country</label>
                <select className="input" value={editForm.country} onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}>
                  <option value="MY">Malaysia</option>
                  <option value="SG">Singapore</option>
                  <option value="TH">Thailand</option>
                  <option value="ID">Indonesia</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
