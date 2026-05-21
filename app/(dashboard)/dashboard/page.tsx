import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { format } from "date-fns";

const CAT_COLORS: Record<string, string> = {
  heels:       "bg-rose-400",
  sandals:     "bg-amber-400",
  loafers:     "bg-indigo-400",
  flats:       "bg-sky-400",
  boots:       "bg-stone-500",
  sneakers:    "bg-green-400",
  wedges:      "bg-orange-400",
  bags:        "bg-purple-400",
  accessories: "bg-teal-400",
  default:     "bg-gray-300",
};

function daysFromNow(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtShort(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const now          = new Date();
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneWeek      = new Date(now.getTime() +  7 * 86400000);
  const twoWeeks     = new Date(now.getTime() + 14 * 86400000);

  // ── Counts still needed elsewhere ───────────────────────────────────────────
  const [sampleCount, openPoCount, flaggedItems] = await Promise.all([
    prisma.sampleOrder.count({ where: { status: { in: ["draft", "sent"] } } }),
    prisma.purchaseOrder.count({ where: { status: { notIn: ["closed", "shipped"] } } }),
    prisma.deliveryItem.count({ where: { isFlagged: true } }),
  ]);

  // ── Procurement Pipeline ────────────────────────────────────────────────────
  const monthPOs = await prisma.purchaseOrder.findMany({
    where: { date: { gte: monthStart } },
    select: {
      id: true, totalPairs: true, totalPrice: true, fxRate: true,
      sampleOrderId: true, status: true,
      manufacturer: { select: { name: true } },
    },
  });
  const submittedMonthPOs = monthPOs.filter(p => p.status !== "draft");
  const purchasedPairs = submittedMonthPOs.reduce((s, p) => s + (p.totalPairs || 0), 0);
  const purchasedRm    = submittedMonthPOs.reduce((s, p) => s + (p.fxRate ? p.totalPrice * p.fxRate : p.totalPrice * 0.62), 0);

  const inFlightPOs = await prisma.purchaseOrder.findMany({
    where: { status: { in: ["submitted", "sent", "in_production"] } },
    select: { totalPairs: true, deliveryDate: true },
  });
  const pendingPairs   = inFlightPOs.reduce((s, p) => s + (p.totalPairs || 0), 0);
  const thisWeekPairs  = inFlightPOs.filter(p => p.deliveryDate && new Date(p.deliveryDate) <= oneWeek).reduce((s, p) => s + p.totalPairs, 0);
  const nextTwoWkPairs = inFlightPOs.filter(p => p.deliveryDate && new Date(p.deliveryDate) > oneWeek && new Date(p.deliveryDate) <= twoWeeks).reduce((s, p) => s + p.totalPairs, 0);
  const laterPairs     = inFlightPOs.filter(p => !p.deliveryDate || new Date(p.deliveryDate) > twoWeeks).reduce((s, p) => s + p.totalPairs, 0);

  // ── Supplier payments due ───────────────────────────────────────────────────
  const PAYMENT_DAYS = 30;
  const unpaidPOs = await prisma.purchaseOrder.findMany({
    where: { status: { in: ["shipped", "closed"] }, paymentPaidDate: null, shipDate: { not: null } },
    select: {
      id: true, poNumber: true, productName: true, totalPrice: true, fxRate: true,
      shipDate: true, paymentTerms: true,
      manufacturer: { select: { name: true } },
    },
    orderBy: { shipDate: "asc" },
  });
  const unpaidWithDue = unpaidPOs.map(p => {
    const due = new Date(p.shipDate!);
    due.setDate(due.getDate() + PAYMENT_DAYS);
    const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
    const amountRm = Math.round((p.totalPrice ?? 0) * (p.fxRate ?? 0.62));
    return { ...p, due, daysLeft, amountRm };
  });
  const totalOwed = unpaidWithDue.reduce((s, p) => s + p.amountRm, 0);

  // Category breakdown from ProductLibrary for this month's POs
  const sampleOrderNums = [...new Set(monthPOs.map(p => p.sampleOrderId).filter(Boolean))] as string[];
  const linkedSampleIds = sampleOrderNums.length
    ? (await prisma.sampleOrder.findMany({ where: { orderNumber: { in: sampleOrderNums } }, select: { id: true } })).map(s => s.id)
    : [];
  const libCats = linkedSampleIds.length
    ? await prisma.productLibrary.findMany({
        where: { sampleOrderId: { in: linkedSampleIds }, category: { not: null } },
        select: { category: true, sampleOrderId: true },
        distinct: ["sampleOrderId"],
      })
    : [];
  const catMap = new Map<string, number>();
  for (const l of libCats) if (l.category) catMap.set(l.category, (catMap.get(l.category) || 0) + 1);
  const catTotal = libCats.length || 1;
  const categoryBreakdown = [...catMap.entries()]
    .map(([raw, count]) => ({ raw, name: raw.charAt(0).toUpperCase() + raw.slice(1), pct: Math.round((count / catTotal) * 100) }))
    .sort((a, b) => b.pct - a.pct).slice(0, 4);

  // ── Supplier ship-out alerts ────────────────────────────────────────────────
  const shipAlertPOs = await prisma.purchaseOrder.findMany({
    where: { status: { in: ["submitted", "sent", "in_production"] } },
    select: {
      id: true, poNumber: true, totalPairs: true, shipDate: true, deliveryDate: true,
      date: true, productName: true, brand: true, status: true,
      manufacturer: { select: { name: true } },
    },
    orderBy: [{ shipDate: "asc" }, { deliveryDate: "asc" }],
    take: 10,
  });
  const getEstShip = (p: { shipDate: Date | null; deliveryDate: Date | null; date: Date }) => {
    if (p.shipDate) return p.shipDate;
    if (p.deliveryDate) return p.deliveryDate;
    const d = new Date(p.date); d.setDate(d.getDate() + 50); return d;
  };
  const shippingThisWeek = shipAlertPOs.filter(p => {
    const days = daysFromNow(getEstShip(p));
    return days !== null && days >= 0 && days <= 7;
  }).length;

  const monthStr = now.toLocaleString("en-US", { month: "long" }).toUpperCase() + " " + now.getFullYear();

  // ── Financial & Lifecycle ───────────────────────────────────────────────────
  const openPosForValue = await prisma.purchaseOrder.findMany({
    where: { status: { notIn: ["closed"] } },
    select: { totalPrice: true, fxRate: true },
  });
  const totalOpenValue = openPosForValue.reduce((s, p) => s + (p.fxRate ? p.totalPrice * p.fxRate : p.totalPrice * 0.62), 0);

  const [revenueMtd, deadStockSamples, allSamplesCount, approvedSamplesCount] = await Promise.all([
    prisma.bestSeller.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { revenueRm: true } }),
    prisma.sampleOrder.findMany({ where: { status: "rejected", costRm: { not: null } }, select: { costRm: true } }),
    prisma.sampleOrder.count(),
    prisma.sampleOrder.count({ where: { status: "approved" } }),
  ]);
  const deadStockValue   = deadStockSamples.reduce((s, d) => s + (d.costRm ?? 0), 0);
  const testToLaunchRate = allSamplesCount > 0 ? Math.round((approvedSamplesCount / allSamplesCount) * 100) : 0;

  // ── Top suppliers this month ────────────────────────────────────────────────
  const supplierMap = new Map<string, { name: string; pairs: number; rm: number; posCount: number }>();
  for (const po of monthPOs) {
    const name = po.manufacturer.name;
    const rm   = po.fxRate ? po.totalPrice * po.fxRate : po.totalPrice * 0.62;
    if (!supplierMap.has(name)) supplierMap.set(name, { name, pairs: 0, rm: 0, posCount: 0 });
    const g = supplierMap.get(name)!;
    g.pairs += po.totalPairs || 0; g.rm += rm; g.posCount += 1;
  }
  const topSuppliers = [...supplierMap.values()].sort((a, b) => b.rm - a.rm).slice(0, 5);

  // ── Action required ─────────────────────────────────────────────────────────
  const urgentShipPOs = shipAlertPOs.filter(p => {
    const days = daysFromNow(getEstShip(p));
    return days !== null && days >= 0 && days <= 3;
  });
  const [pendingLongSamples, marketTestsNeedVerdict] = await Promise.all([
    prisma.sampleOrder.count({ where: { status: "sent", sentAt: { lte: fourteenDaysAgo } } }),
    prisma.sampleOrder.count({ where: { launchType: "market_test", status: "received" } }),
  ]);

  const actionItems: { title: string; subtitle: string; href: string }[] = [];
  for (const p of urgentShipPOs) {
    const days = daysFromNow(getEstShip(p));
    actionItems.push({
      title: `${p.poNumber} ships${days !== null ? ` in ${days} day${days === 1 ? "" : "s"}` : " soon"}`,
      subtitle: `${p.manufacturer.name} · ${p.totalPairs} pairs · confirm with supplier`,
      href: "/dashboard/purchase-orders",
    });
  }
  if (sampleCount === 0) actionItems.push({ title: "No samples in pipeline", subtitle: "Add samples for next season planning", href: "/dashboard/samples" });
  if ((revenueMtd._sum.revenueRm ?? 0) === 0) actionItems.push({ title: "Sales data not connected", subtitle: "Set up Shopify + SiteGiant integration", href: "/dashboard/best-sellers" });
  if (pendingLongSamples > 0) actionItems.push({ title: `${pendingLongSamples} sample${pendingLongSamples > 1 ? "s" : ""} pending >14 days`, subtitle: "Awaiting factory response", href: "/dashboard/samples" });
  if (marketTestsNeedVerdict > 0) actionItems.push({ title: `${marketTestsNeedVerdict} market test${marketTestsNeedVerdict > 1 ? "s" : ""} need verdict`, subtitle: "Past decision deadline", href: "/dashboard/samples" });

  const dateStr = format(now, "EEEE, d MMMM yyyy");

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Welcome back, {session?.user?.name} · {dateStr}
        </p>
      </div>

      {/* ── Procurement Pipeline ── */}
      <section>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">
          Procurement Pipeline · {monthStr}
        </p>
        <div className="grid grid-cols-3 gap-3">

          {/* Purchased this month */}
          <div className="bg-white border border-gray-200 border-l-4 border-l-violet-500 rounded-2xl p-5">
            <p className="text-xs font-medium text-gray-500 mb-1">📦 Purchased this month</p>
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-4xl font-bold text-gray-900">{purchasedPairs.toLocaleString()}</span>
              <span className="text-sm text-gray-500">pairs</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {submittedMonthPOs.length} PO{submittedMonthPOs.length !== 1 ? "s" : ""} · RM {Math.round(purchasedRm).toLocaleString()} committed
            </p>
            {categoryBreakdown.length > 0 ? (
              <>
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-3">
                  {categoryBreakdown.map(c => (
                    <div key={c.raw} style={{ width: `${c.pct}%` }}
                      className={`${CAT_COLORS[c.raw] ?? CAT_COLORS.default} rounded-full`} />
                  ))}
                </div>
                <div className="flex gap-5">
                  {categoryBreakdown.map(c => (
                    <div key={c.raw}>
                      <p className="text-xs text-gray-500">{c.name}</p>
                      <p className="text-xs font-semibold text-gray-700">{c.pct}%</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-300 italic">No category data</p>
            )}
          </div>

          {/* Pending arrival */}
          <div className="bg-white border border-gray-200 border-l-4 border-l-amber-500 rounded-2xl p-5">
            <p className="text-xs font-medium text-gray-500 mb-1">⏳ Pending arrival</p>
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-4xl font-bold text-gray-900">{pendingPairs.toLocaleString()}</span>
              <span className="text-sm text-gray-500">pairs</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              From {inFlightPOs.length} in-flight PO{inFlightPOs.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-2">
              {[
                { label: "This week",    pairs: thisWeekPairs },
                { label: "Next 2 weeks", pairs: nextTwoWkPairs },
                { label: format(monthStart, "MMM") + "–" + format(new Date(now.getFullYear(), now.getMonth() + 1), "MMM"), pairs: laterPairs },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">{row.label}</span>
                  <span className="text-xs font-semibold text-gray-800">{row.pairs > 0 ? row.pairs.toLocaleString() : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Supplier payments due */}
          <Link href="/dashboard/purchase-orders/payment-tracking"
            className="bg-white border border-gray-200 border-l-4 border-l-red-400 rounded-2xl p-5 hover:shadow-sm transition-shadow block">
            <p className="text-xs font-medium text-gray-500 mb-1">💳 Amount owed to suppliers</p>
            <div className="flex items-baseline gap-1.5 mb-0.5">
              <span className="text-4xl font-bold text-gray-900">
                RM {totalOwed > 0 ? Math.round(totalOwed).toLocaleString("en-MY") : "0"}
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {unpaidWithDue.length} unpaid PO{unpaidWithDue.length !== 1 ? "s" : ""}
            </p>
            {unpaidWithDue.length === 0 ? (
              <p className="text-xs text-green-600 font-medium">All payments settled ✓</p>
            ) : (
              <div className="space-y-2">
                {unpaidWithDue.slice(0, 3).map(p => {
                  const isUrgent  = p.daysLeft <= 7;
                  const isOverdue = p.daysLeft < 0;
                  return (
                    <div key={p.id} className={`flex items-center justify-between rounded-lg px-2 py-1.5 -mx-2 ${
                      isOverdue ? "bg-red-50" : isUrgent ? "bg-orange-50" : ""
                    }`}>
                      <div>
                        <span className={`text-xs font-semibold ${isOverdue ? "text-red-700" : isUrgent ? "text-orange-700" : "text-gray-700"}`}>
                          {p.poNumber}
                        </span>
                        <span className="text-xs text-gray-400 ml-1.5">{p.manufacturer.name}</span>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-semibold ${isOverdue ? "text-red-700" : isUrgent ? "text-orange-700" : "text-gray-700"}`}>
                          RM {p.amountRm.toLocaleString("en-MY")}
                        </p>
                        <p className={`text-[10px] ${isOverdue ? "text-red-500 font-bold" : isUrgent ? "text-orange-500 font-semibold" : "text-gray-400"}`}>
                          {isOverdue
                            ? `${Math.abs(p.daysLeft)}d overdue ⚠`
                            : isUrgent
                            ? `due in ${p.daysLeft}d ⚠`
                            : `due ${fmtShort(p.due)}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {unpaidWithDue.length > 3 && (
                  <p className="text-xs text-gray-400 text-right">+{unpaidWithDue.length - 3} more</p>
                )}
              </div>
            )}
          </Link>
        </div>
      </section>

      {/* ── Supplier ship-out alerts ── */}
      {shipAlertPOs.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base">🚢</span>
                <h2 className="font-bold text-gray-900">Supplier ship-out alerts</h2>
              </div>
              <p className="text-xs text-amber-700 mt-0.5">
                Estimated ship dates for {monthStr} · {shipAlertPOs.length} PO{shipAlertPOs.length !== 1 ? "s" : ""} in production
              </p>
            </div>
            {shippingThisWeek > 0 && (
              <div className="bg-white border border-amber-200 rounded-xl px-4 py-2 text-center shrink-0">
                <p className="text-xl font-bold text-gray-900">{shippingThisWeek}</p>
                <p className="text-xs text-gray-500">this week</p>
              </div>
            )}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr>
                {["PO", "SUPPLIER", "PRODUCT", "PAIRS", "EST SHIP", "DAYS TO SHIP", "STATUS"].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-6">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {shipAlertPOs.map(p => {
                const refDate = getEstShip(p);
                const days    = daysFromNow(refDate);
                const isUrgent = days !== null && days <= 3;
                const isSoon   = days !== null && days <= 7;
                const daysLabel =
                  days === null   ? "—"
                  : days < 0     ? `${Math.abs(days)}d overdue`
                  : days === 0   ? "today"
                  : `in ${days} day${days === 1 ? "" : "s"}`;
                return (
                  <tr key={p.id}>
                    <td className="py-3 pr-6">
                      <Link href="/dashboard/purchase-orders"
                        className="text-blue-600 font-semibold hover:underline text-sm">
                        {p.poNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-6 text-gray-700 text-sm">{p.manufacturer.name}</td>
                    <td className="py-3 pr-6 text-gray-700 text-sm">{p.productName || p.brand || "—"}</td>
                    <td className="py-3 pr-6 text-gray-700 text-sm">{(p.totalPairs || 0).toLocaleString()}</td>
                    <td className="py-3 pr-6 text-gray-700 text-sm">{fmtShort(refDate)}</td>
                    <td className="py-3 pr-6 text-sm">
                      <span className={`font-medium ${isUrgent ? "text-orange-500" : isSoon ? "text-amber-600" : "text-gray-600"}`}>
                        {daysLabel}{isUrgent && " ⚠"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "in_production" ? "bg-gray-100 text-gray-700" :
                        p.status === "sent"          ? "bg-blue-100 text-blue-700" :
                                                       "bg-gray-100 text-gray-600"
                      }`}>
                        {p.status === "in_production" ? "Production" :
                         p.status === "sent"           ? "Confirmed"  : p.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {/* ── Financial & Lifecycle ── */}
      <section>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-3">Financial &amp; Lifecycle</p>
        <div className="grid grid-cols-4 gap-3">
          <Link href="/dashboard/purchase-orders"
            className="bg-white border border-gray-200 border-l-4 border-l-green-500 rounded-2xl p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-gray-500 mb-1">Total open PO value</p>
            <p className="text-2xl font-bold text-gray-900">RM {Math.round(totalOpenValue).toLocaleString("en-MY")}</p>
            <p className="text-xs text-gray-400 mt-1">{openPoCount} active POs</p>
          </Link>
          <div className="bg-white border border-gray-200 border-l-4 border-l-blue-500 rounded-2xl p-5">
            <p className="text-xs text-gray-500 mb-1">Revenue MTD</p>
            <p className="text-2xl font-bold text-gray-900">RM {Math.round(revenueMtd._sum.revenueRm ?? 0).toLocaleString("en-MY")}</p>
            <p className="text-xs text-gray-400 mt-1">
              {(revenueMtd._sum.revenueRm ?? 0) === 0 ? "No sales data yet" : "Best seller revenue this month"}
            </p>
          </div>
          <Link href="/dashboard/product-library"
            className="bg-white border border-gray-200 border-l-4 border-l-orange-500 rounded-2xl p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-gray-500 mb-1">Dead stock value</p>
            <p className="text-2xl font-bold text-gray-900">RM {Math.round(deadStockValue).toLocaleString("en-MY")}</p>
            <p className="text-xs text-gray-400 mt-1">{deadStockSamples.length} archived SKU{deadStockSamples.length !== 1 ? "s" : ""}</p>
          </Link>
          <Link href="/dashboard/samples"
            className="bg-white border border-gray-200 border-l-4 border-l-purple-500 rounded-2xl p-5 hover:shadow-sm transition-shadow">
            <p className="text-xs text-gray-500 mb-1">Test-to-launch rate</p>
            <p className="text-2xl font-bold text-gray-900">{testToLaunchRate}%</p>
            <p className="text-xs text-gray-400 mt-1">Samples approved for launch</p>
          </Link>
        </div>
      </section>

      {/* ── Action required + Top suppliers ── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Action required */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <h2 className="font-semibold text-gray-900">Action required</h2>
            </div>
            {actionItems.length > 0 && (
              <span className="bg-red-50 text-red-600 text-xs font-semibold px-2.5 py-1 rounded-lg">
                {actionItems.length} items
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {actionItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No pending actions</p>
            ) : actionItems.map((item, i) => (
              <Link key={i} href={item.href}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-1 px-1 rounded transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.subtitle}</p>
                </div>
                <ArrowRight size={14} className="text-gray-400 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </div>

        {/* Top suppliers this month */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <h2 className="font-semibold text-gray-900">Top suppliers this month</h2>
            </div>
            <Link href="/dashboard/purchase-orders" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {topSuppliers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No POs this month</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {topSuppliers.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-gray-400 w-4 mt-0.5 shrink-0">{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.pairs.toLocaleString()} pairs · {s.posCount} PO{s.posCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    RM {Math.round(s.rm).toLocaleString("en-MY")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
