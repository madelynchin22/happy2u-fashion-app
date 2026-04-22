import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ClipboardList, ShoppingCart, Container, PackageCheck, TrendingUp, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  const [sampleCount, poCount, shipmentCount, pendingDeliveries, flaggedItems] = await Promise.all([
    prisma.sampleOrder.count({ where: { status: { in: ["draft", "sent"] } } }),
    prisma.purchaseOrder.count({ where: { status: { in: ["draft", "confirmed", "in_production"] } } }),
    prisma.shipment.count({ where: { status: { in: ["in_transit", "customs"] } } }),
    prisma.delivery.count({ where: { status: "pending" } }),
    prisma.deliveryItem.count({ where: { isFlagged: true } }),
  ]);

  const cards = [
    { label: "Active Samples",       value: sampleCount,       icon: ClipboardList, href: "/dashboard/samples",         color: "bg-blue-50 text-blue-600" },
    { label: "Open Purchase Orders", value: poCount,            icon: ShoppingCart,  href: "/dashboard/purchase-orders", color: "bg-purple-50 text-purple-600" },
    { label: "Shipments In Transit", value: shipmentCount,      icon: Container,     href: "/dashboard/shipments",       color: "bg-amber-50 text-amber-600" },
    { label: "Pending Deliveries",   value: pendingDeliveries,  icon: PackageCheck,  href: "/dashboard/deliveries",      color: "bg-green-50 text-green-600" },
    { label: "Flagged QC Issues",    value: flaggedItems,       icon: AlertTriangle, href: "/dashboard/deliveries",      color: "bg-red-50 text-red-600" },
  ];

  const recentSamples = await prisma.sampleOrder.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { manufacturer: { select: { name: true } } },
  });

  const recentPOs = await prisma.purchaseOrder.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { manufacturer: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Welcome back, {session?.user?.name}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(c => (
          <Link key={c.label} href={c.href} className="card p-4 hover:shadow-md transition-shadow">
            <div className={`w-9 h-9 rounded-lg ${c.color} flex items-center justify-center mb-3`}>
              <c.icon size={18} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Samples */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Sample Orders</h2>
            <Link href="/dashboard/samples" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {recentSamples.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No sample orders yet</p>
          ) : (
            <div className="space-y-3">
              {recentSamples.map(s => (
                <Link key={s.id} href={`/dashboard/samples/${s.id}`} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.orderNumber} — {s.productName}</p>
                    <p className="text-xs text-gray-400">{s.manufacturer.name} · v{s.version}</p>
                  </div>
                  <span className={`badge-${s.status}`}>{s.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent POs */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Purchase Orders</h2>
            <Link href="/dashboard/purchase-orders" className="text-xs text-brand-600 hover:underline">View all</Link>
          </div>
          {recentPOs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No purchase orders yet</p>
          ) : (
            <div className="space-y-3">
              {recentPOs.map(p => (
                <Link key={p.id} href={`/dashboard/purchase-orders/${p.id}`} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-lg transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.poNumber} — {p.brand}</p>
                    <p className="text-xs text-gray-400">{p.manufacturer.name} · {p.totalPairs} pairs</p>
                  </div>
                  <span className={`badge-${p.status}`}>{p.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
