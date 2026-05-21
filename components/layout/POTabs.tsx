"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingCart, CreditCard, AlertTriangle, Store } from "lucide-react";

const TABS = [
  { href: "/dashboard/purchase-orders",                   label: "Orders",           icon: ShoppingCart  },
  { href: "/dashboard/purchase-orders/payment-tracking",  label: "Payment Tracking", icon: CreditCard    },
  { href: "/dashboard/purchase-orders/defect-list",       label: "Defect List",      icon: AlertTriangle },
  { href: "/dashboard/purchase-orders/outlet-receipt",    label: "Outlet Receipt",   icon: Store         },
];

export function POTabs() {
  const pathname = usePathname();
  const active = TABS.slice().reverse().find(t => pathname === t.href || pathname.startsWith(t.href + "/"));

  return (
    <div className="flex gap-1 border-b border-gray-200 mb-6">
      {TABS.map(tab => {
        const isActive = active?.href === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              isActive
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
            }`}
          >
            <Icon size={14} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
