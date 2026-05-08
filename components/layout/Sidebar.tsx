"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Building2, Layers, ClipboardList, ShoppingCart,
  Container, PackageCheck, TrendingUp, Settings, LogOut, ChevronRight,
  Sparkles, Star, PackageSearch, BookOpen, CreditCard, AlertTriangle, Store,
} from "lucide-react";

type NavChild = { href: string; label: string };
type NavItem =
  | { divider: true }
  | { href: string; label: string; icon: any; children?: NavChild[] };

const nav: NavItem[] = [
  { href: "/dashboard",            label: "Dashboard",       icon: LayoutDashboard },
  { href: "/dashboard/trends",     label: "Trend Board",     icon: TrendingUp },
  { href: "/dashboard/competitors",    label: "Competitor Monitor", icon: PackageSearch },
  { href: "/dashboard/ai-suggestions", label: "AI Suggestions", icon: Sparkles },
  { href: "/dashboard/best-sellers",   label: "Best Sellers",   icon: Star },
  { href: "/dashboard/samples",    label: "Sample Orders",   icon: ClipboardList },
  {
    href: "/dashboard/purchase-orders",
    label: "Purchase Orders",
    icon: ShoppingCart,
    children: [
      { href: "/dashboard/purchase-orders/payment-tracking", label: "Payment Tracking" },
      { href: "/dashboard/purchase-orders/defect-list",      label: "Defect List" },
      { href: "/dashboard/purchase-orders/outlet-receipt",   label: "Outlet Receipt Submit" },
    ],
  },
  { href: "/dashboard/shipments",  label: "Shipments",       icon: Container },
  { href: "/dashboard/deliveries", label: "Deliveries & QC", icon: PackageCheck },
  { divider: true },
  { href: "/dashboard/product-library", label: "Product Library", icon: BookOpen },
  { href: "/dashboard/manufacturers", label: "Manufacturers", icon: Building2 },
  { href: "/dashboard/materials",  label: "Materials Library", icon: Layers },
  { href: "/dashboard/settings",   label: "Settings",        icon: Settings },
];

const CHILD_ICONS: Record<string, any> = {
  "/dashboard/purchase-orders/payment-tracking": CreditCard,
  "/dashboard/purchase-orders/defect-list":      AlertTriangle,
  "/dashboard/purchase-orders/outlet-receipt":   Store,
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "";

  // Auto-expand Purchase Orders if on any of its sub-routes
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => ({
    "/dashboard/purchase-orders": pathname.startsWith("/dashboard/purchase-orders"),
  }));

  // Keep expanded in sync when navigating directly via URL
  useEffect(() => {
    if (pathname.startsWith("/dashboard/purchase-orders")) {
      setExpanded(prev => ({ ...prev, "/dashboard/purchase-orders": true }));
    }
  }, [pathname]);

  function toggleExpand(href: string) {
    setExpanded(prev => ({ ...prev, [href]: !prev[href] }));
  }

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
          const isParent = !!item.children;
          const isExpanded = expanded[item.href];
          const active = pathname === item.href || (!isParent && item.href !== "/dashboard" && pathname.startsWith(item.href));
          const childActive = isParent && pathname.startsWith(item.href);

          return (
            <div key={item.href}>
              {/* Parent row */}
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                  active || (childActive && !isExpanded)
                    ? "bg-white text-brand-700 font-medium shadow-sm"
                    : childActive
                    ? "bg-white/60 text-brand-700 font-medium"
                    : "text-gray-600 hover:bg-white/60 hover:text-gray-900"
                }`}
                onClick={() => isParent ? toggleExpand(item.href) : undefined}
              >
                {isParent ? (
                  <>
                    <Icon size={16} />
                    <Link href={item.href} className="flex-1" onClick={e => e.stopPropagation()}>
                      {item.label}
                    </Link>
                    <ChevronRight
                      size={14}
                      className={`text-brand-400 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </>
                ) : (
                  <Link href={item.href} className="flex items-center gap-3 flex-1">
                    <Icon size={16} />
                    <span className="flex-1">{item.label}</span>
                    {active && <ChevronRight size={14} className="text-brand-400" />}
                  </Link>
                )}
              </div>

              {/* Sub-items */}
              {isParent && isExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l-2 border-brand-100 pl-3">
                  {item.children!.map(child => {
                    const childIsActive = pathname === child.href || pathname.startsWith(child.href);
                    const ChildIcon = CHILD_ICONS[child.href];
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          childIsActive
                            ? "bg-white text-brand-700 font-medium shadow-sm"
                            : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
                        }`}
                      >
                        {ChildIcon && <ChildIcon size={13} />}
                        <span>{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
