'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import { ThemeToggle } from './theme-toggle';
import {
  Search,
  Calendar,
  ChevronDown,
  Plus,
  Download,
  Bell,
  LogOut,
  Building,
  Check,
  CheckCheck,
  Package,
  AlertTriangle,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface TopbarProps {
  onOpenAddWidget?: () => void;
  activeTenant?: { id: string; name: string; slug: string } | null;
  memberships?: Array<{ tenantId: string; tenantName: string; roleName: string }>;
  userName?: string;
}

export function Topbar({
  onOpenAddWidget,
  activeTenant = { id: 'default', name: 'Apex Lifestyle Ltd', slug: 'apex' },
  memberships = [],
  userName = 'Tanvir Ahmed',
}: TopbarProps) {
  const router = useRouter();
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dateRange, setDateRange] = useState('Last 30 days');

  const fetchInApp = async () => {
    try {
      const res = await api.get('/notifications/in-app');
      if (res && res.items) {
        setNotificationsList(res.items);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch {
      // Fallback sample alerts if database has no initial in-app events
      setNotificationsList([
        {
          id: 'mock-1',
          title: 'New Customer Return',
          content: 'Return #RET-0001 initiated for order #1042.',
          createdAt: new Date().toISOString(),
          readAt: null,
        },
        {
          id: 'mock-2',
          title: 'Steadfast COD Settlement',
          content: 'Disbursement received for statement SF-STMT-OCT-01.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          readAt: null,
        },
      ]);
      setUnreadCount(2);
    }
  };

  useEffect(() => {
    fetchInApp();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/in-app/read-all');
      setUnreadCount(0);
      setNotificationsList((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
    } catch {
      setUnreadCount(0);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('active_tenant_id');
    localStorage.removeItem('demo_auth_token');
    router.push('/login');
  };

  const handleSwitchTenant = (tenantId: string) => {
    localStorage.setItem('active_tenant_id', tenantId);
    setTenantDropdownOpen(false);
    window.location.reload();
  };

  return (
    <header className="h-16 px-6 bg-white dark:bg-[#121826] border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between sticky top-0 z-20 transition-colors">
      {/* Left: Global Search Pill */}
      <div className="flex items-center gap-3 w-full max-w-sm">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search orders, SKU, customer..."
            className="w-full pl-10 pr-12 py-2 rounded-full border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
          />
          <kbd className="absolute right-3 top-2.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Controls & Utilities */}
      <div className="flex items-center gap-3">
        {/* Date Filter Pill */}
        <div className="hidden lg:flex items-center border border-slate-200/80 dark:border-slate-800 rounded-full bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
          <Calendar className="w-3.5 h-3.5 text-slate-400 mr-2" />
          <span className="font-medium mr-2">Last 30 Days</span>
          <span className="text-slate-300 dark:text-slate-700 mr-2">|</span>
          <button
            type="button"
            className="flex items-center gap-1 font-semibold text-slate-900 dark:text-white hover:text-blue-600 transition-colors"
          >
            {dateRange}
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>
        </div>

        {/* Action Button: Add Widget */}
        <button
          type="button"
          onClick={onOpenAddWidget}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          <span>Add widget</span>
        </button>

        {/* Action Button: Export */}
        <button
          type="button"
          onClick={() => alert('Exporting dashboard analytics...')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-white" />
          <span>Export</span>
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

        {/* Theme Switcher */}
        <ThemeToggle />

        {/* Live In-App Notification Bell & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center ring-2 ring-white dark:ring-[#121826]">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in duration-150">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Notifications
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {unreadCount} unread alert{unreadCount !== 1 ? 's' : ''}
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {notificationsList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                ) : (
                  notificationsList.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        !n.readAt ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Package className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {n.title || 'Notification'}
                            </span>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                              {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">
                            {n.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 text-center">
                <Link
                  href="/settings/notifications"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
                >
                  <span>Notification Settings & Message Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* User Profile & Tenant Switcher Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-semibold flex items-center justify-center text-xs shadow-sm">
              {userName.charAt(0)}
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {tenantDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800 shadow-xl py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  Active: {activeTenant?.name || 'Default Organization'}
                </p>
              </div>

              {memberships.length > 1 && (
                <div className="py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="px-4 py-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Switch Organization
                  </span>
                  {memberships.map((m) => (
                    <button
                      key={m.tenantId}
                      onClick={() => handleSwitchTenant(m.tenantId)}
                      className="w-full px-4 py-1.5 flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{m.tenantName}</span>
                      </div>
                      {m.tenantId === activeTenant?.id && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="py-1">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full px-4 py-1.5 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
