'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  FileText,
  Store,
  DollarSign,
  ChevronDown,
  BarChart3,
  Percent,
  Settings,
  HelpCircle,
  Shield,
  ShieldAlert,
  Sparkles,
  Boxes,
  Truck,
  Globe,
  RotateCcw,
  Bell,
  CreditCard,
  ShieldCheck,
  FileSpreadsheet,
  Compass,
} from 'lucide-react';

interface SidebarProps {
  activeTenantName?: string;
}

export function Sidebar({ activeTenantName = 'Growthomic Store' }: SidebarProps) {
  const pathname = usePathname();
  const [financesOpen, setFinancesOpen] = useState(true);

  const isRouteActive = (route: string) => {
    if (route === '/dashboard' && (pathname === '/dashboard' || pathname === '/')) {
      return true;
    }
    return pathname.startsWith(route);
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#121826] border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 z-30 transition-colors">
      {/* Top Header & Navigation */}
      <div className="flex flex-col flex-1 overflow-y-auto px-4 py-5 scrollbar-thin">
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 px-2 mb-6">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shadow-blue-500/20">
            <span className="text-base tracking-tighter">S</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
              Shopeers
            </span>
            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[140px]">
              {activeTenantName}
            </span>
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/dashboard')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard className={`w-4 h-4 ${isRouteActive('/dashboard') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span>Dashboard</span>
              </div>
            </Link>

            <Link
              href="/orders"
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/orders')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className={`w-4 h-4 ${isRouteActive('/orders') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span>Orders</span>
              </div>
            </Link>

            <Link
              href="/returns"
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/returns')
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <RotateCcw className={`w-4 h-4 ${isRouteActive('/returns') ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                <span>Returns</span>
              </div>
            </Link>

            <Link
              href="/products"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/products')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Package className={`w-4 h-4 ${isRouteActive('/products') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>Products</span>
            </Link>

            <Link
              href="/inventory"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/inventory')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Boxes className={`w-4 h-4 ${isRouteActive('/inventory') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>Inventory</span>
            </Link>

            <Link
              href="/customers"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/customers')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className={`w-4 h-4 ${isRouteActive('/customers') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>Customers</span>
            </Link>

            <Link
              href="/content"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Content</span>
            </Link>

            <Link
              href="/store"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <Store className="w-4 h-4 text-slate-400" />
              <span>Online Store</span>
            </Link>
          </div>

          {/* Finances Section (Collapsible) */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setFinancesOpen(!financesOpen)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <span>Finances</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${financesOpen ? 'rotate-180' : ''}`} />
            </button>

            {financesOpen && (
              <div className="pl-9 space-y-1">
                <Link
                  href="/finances"
                  className={`block px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pathname === '/finances'
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  P&L Statement
                </Link>
                <Link
                  href="/finances/ledger"
                  className={`block px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isRouteActive('/finances/ledger')
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Transaction Ledger
                </Link>
                <Link
                  href="/finances/expenses"
                  className={`block px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isRouteActive('/finances/expenses')
                      ? 'text-blue-600 dark:text-blue-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Operating Expenses
                </Link>
                <Link
                  href="/finances/settlements"
                  className={`block px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isRouteActive('/finances/settlements')
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  COD Settlements
                </Link>
              </div>
            )}
          </div>

          {/* Analytics & Tools */}
          <div className="space-y-1">
            <Link
              href="/analytics"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <span>Analytics</span>
            </Link>
            <Link
              href="/discounts"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <Percent className="w-4 h-4 text-slate-400" />
              <span>Discounts</span>
            </Link>
          </div>

          {/* System & Settings */}
          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Link
              href="/settings/couriers"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/settings/couriers')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Truck className={`w-4 h-4 ${isRouteActive('/settings/couriers') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
              <span>Couriers</span>
            </Link>
            <Link
              href="/settings/integrations"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/settings/integrations')
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className={`w-4 h-4 ${isRouteActive('/settings/integrations') ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
              <span>Store Integrations</span>
            </Link>
            <Link
              href="/settings/risk"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/settings/risk')
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldAlert className={`w-4 h-4 ${isRouteActive('/settings/risk') ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`} />
              <span>Fraud & Risk Rules</span>
            </Link>
            <Link
              href="/settings/notifications"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/settings/notifications')
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Bell className={`w-4 h-4 ${isRouteActive('/settings/notifications') ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
              <span>Notifications</span>
            </Link>
            <Link
              href="/settings/roles"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/settings/roles')
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Team & Roles</span>
            </Link>
            <Link
              href="/settings/billing"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/settings/billing')
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CreditCard className={`w-4 h-4 ${isRouteActive('/settings/billing') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
              <span>Billing & Plans</span>
            </Link>
            <Link
              href="/settings/import"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/settings/import')
                  ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileSpreadsheet className={`w-4 h-4 ${isRouteActive('/settings/import') ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400'}`} />
              <span>Data Import & CSV</span>
            </Link>
            <Link
              href="/onboarding"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/onboarding')
                  ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Compass className={`w-4 h-4 ${isRouteActive('/onboarding') ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
              <span>Setup Wizard</span>
            </Link>
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isRouteActive('/admin')
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${isRouteActive('/admin') ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span>Platform Admin</span>
            </Link>
            <Link
              href="/help"
              className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Help & Support</span>
            </Link>
          </div>
        </nav>
      </div>

      {/* Upgrade to Premium Card (Bottom banner) */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md shadow-blue-500/20 relative overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-3">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h4 className="text-xs font-bold leading-tight mb-1">
            Upgrade to Premium!
          </h4>
          <p className="text-[11px] text-blue-100/80 mb-3 leading-snug">
            Upgrade your account and unlock all of the benefits.
          </p>
          <Link
            href="/settings/billing"
            className="w-full py-2 px-3 rounded-xl bg-white/20 hover:bg-white/30 active:bg-white/40 text-white text-[11px] font-bold backdrop-blur-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-amber-300" />
            Upgrade premium
          </Link>
        </div>
      </div>
    </aside>
  );
}
