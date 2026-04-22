"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Building2, Layers, ClipboardList, ShoppingCart,
  Container, PackageCheck, TrendingUp, Settings, LogOut, ChevronRight,
  Sparkles, Star, PackageSearch, BookOpen,
} from "lucide-react";

const nav = [
  { href: "/dashboard",            label: "Dashboard",       icon: LayoutDashboard },
  { href: "/dashboard/trends",     label: "Trend Board",     icon: TrendingUp },
  { href: "/dashboard/competitors",    label: "Competitor Monitor", icon: PackageSearch },
  { href: "/dashboard/ai-suggestions", label: "AI Suggestions", icon: Sparkles },
  { href: "/dashboard/best-sellers",   label: "Best Sellers",   icon: Star },
  { href: "/dashboard/samples",    label: "Sample Orders",   icon: ClipboardList },
  { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ShoppingCart },
  { href: "/dashboard/shipments",  label: "Shipments",       icon: Container },
  { href: "/dashboard/deliveries", label: "Deliveries & QC", icon: PackageCheck },
  { divider: true },
  { href: "/dashboard/product-library", label: "Product Library", icon: BookOpen },
  { href: "/dashboard/manufacturers", label: "Manufacturers", icon: Building2 },
  { href: "/dashboard/materials",  label: "Materials Library", icon: Layers },
  { href: "/dashboard/settings",   label: "Settings",        icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "";

  return (
    <aside className="w-60 min-h-screen flex flex-col border-r border-[#e8ddd2]" style={{ backgroundColor: "#f1e8de" }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#e8ddd2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Happy2U" className="h-12 object-contain" />
        <p className="text-xs text-gray-500 mt-1">Fashion Management</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item, i) => {
          if ("divider" in item) return <div key={i} className="my-3 border-t border-gray-100" />;
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-white text-brand-700 font-medium shadow-sm"
                  : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
              }`}
            >
              <Icon size={16} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={14} className="text-brand-400" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-sm font-semibold">
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{role}</p>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  );
}
