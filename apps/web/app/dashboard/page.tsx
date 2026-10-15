'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { WidgetDrawer } from '../../components/widget-drawer';
import { api } from '../../lib/api';
import {
  Eye,
  LayoutGrid,
  MousePointer,
  Mail,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Star,
  Mic,
  Send,
  Headphones,
  Watch,
  Smartphone,
  Gamepad2,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const [widgetDrawerOpen, setWidgetDrawerOpen] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>('Jan 18, 2025');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to load live authenticated user profile
    api.get('/auth/me')
      .then((data) => setMe(data))
      .catch(() => {
        // Fallback demo state if running in offline preview
        setMe({
          user: { fullName: 'Tanvir Ahmed', email: 'tanvir@growthomic.com' },
          activeTenant: { id: 'demo-tenant', name: 'Apex Lifestyle Ltd', slug: 'apex' },
          memberships: [
            { tenantId: 'demo-tenant', tenantName: 'Apex Lifestyle Ltd', roleName: 'Owner' },
            { tenantId: 'demo-2', tenantName: 'Dhaka Gadget Store', roleName: 'Admin' },
          ],
        });
      });
  }, []);

  const handleAiAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setAiResponse(`Inventory OS AI: Analyzed "${aiPrompt}". Demand for wireless gadgets is predicted to rise 18% next week based on regional shipment velocity.`);
    setAiPrompt('');
  };

  const kpis = [
    {
      title: 'Page Views',
      value: '16,431',
      change: '+15.5%',
      isPositive: true,
      comparedTo: 'vs. 14,553 last period',
      icon: Eye,
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Visitors',
      value: '6,225',
      change: '+8.4%',
      isPositive: true,
      comparedTo: 'vs. 5,732 last period',
      icon: LayoutGrid,
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Click',
      value: '2,832',
      change: '-10.5%',
      isPositive: false,
      comparedTo: 'vs. 3,294 last period',
      icon: MousePointer,
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Orders',
      value: '1,224',
      change: '+4.4%',
      isPositive: true,
      comparedTo: 'vs. 1,185 last period',
      icon: Mail,
      iconBg: 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400',
    },
  ];

  const bestSellingProducts = [
    {
      id: '#83009',
      name: 'Hybrid Active Noise Cancelling Headphone',
      icon: Headphones,
      sold: '2,310 sold',
      revenue: '$124,839',
      rating: '5.0',
    },
    {
      id: '#83001',
      name: 'Casio G-Shock Shock Resistant Chrono Watch',
      icon: Watch,
      sold: '1,230 sold',
      revenue: '$92,662',
      rating: '4.8',
    },
    {
      id: '#83004',
      name: 'SAMSUNG Galaxy S25 Ultra 5G (Titanium)',
      icon: Smartphone,
      sold: '812 sold',
      revenue: '$74,048',
      rating: '4.7',
    },
    {
      id: '#83002',
      name: 'Xbox Wireless Gaming Controller Carbon',
      icon: Gamepad2,
      sold: '645 sold',
      revenue: '$62,820',
      rating: '4.5',
    },
    {
      id: '#83002',
      name: 'Timex Men\'s Easy Reader Classic Leather Watch',
      icon: Watch,
      sold: '572 sold',
      revenue: '$48,724',
      rating: '4.5',
    },
  ];

  const daysData = [
    { day: 'Sun', height: '40%', active: false },
    { day: 'Mon', height: '55%', active: false },
    { day: 'Tue', height: '92%', active: true, value: '8,162' },
    { day: 'Wed', height: '45%', active: false },
    { day: 'Thu', height: '60%', active: false },
    { day: 'Fri', height: '75%', active: false },
    { day: 'Sat', height: '50%', active: false },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] flex selection:bg-blue-500 selection:text-white transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar activeTenantName={me?.activeTenant?.name} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onOpenAddWidget={() => setWidgetDrawerOpen(true)}
          activeTenant={me?.activeTenant}
          memberships={me?.memberships}
          userName={me?.user?.fullName || 'Tanvir Ahmed'}
        />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* Header Title */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Dashboard
            </h1>
          </div>

          {/* Top 4 KPI Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.title}
                  className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {kpi.title}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${kpi.iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>

                  <div>
                    <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                      {kpi.value}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          kpi.isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {kpi.isPositive ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : (
                          <ArrowDownRight className="w-3 h-3" />
                        )}
                        {kpi.change}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {kpi.comparedTo}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main 2-Column Analytics Section */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* Left Column (8 of 12 columns / 66%) */}
            <div className="xl:col-span-8 space-y-6">
              {/* Total Profit Card */}
              <div className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Total Profit
                    </h2>
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                        $446.7K
                      </span>
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                        <ArrowUpRight className="w-3 h-3" /> 24.4%
                      </span>
                      <span className="text-xs text-slate-400">
                        vs. last period
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* SVG Area / Spline Chart */}
                <div className="relative h-64 w-full mt-6">
                  {/* Floating Tooltip Card matching Shopeers reference */}
                  <div className="absolute left-[45%] top-2 z-10 bg-white dark:bg-[#1E293B] border border-slate-200/90 dark:border-slate-700 rounded-xl px-3.5 py-2.5 shadow-lg text-xs pointer-events-none">
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white mb-1">
                      Jan 18, 2025
                    </p>
                    <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold font-mono">
                      <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                      $12,324 this month
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 font-medium font-mono text-[11px] mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
                      $5,563 last month
                    </div>
                  </div>

                  <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200">
                    <defs>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="prevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#94A3B8" stopOpacity="0.1" />
                        <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="0" y1="20" x2="700" y2="20" stroke="currentColor" strokeDasharray="3 3" className="text-slate-100 dark:text-slate-800/80" />
                    <line x1="0" y1="70" x2="700" y2="70" stroke="currentColor" strokeDasharray="3 3" className="text-slate-100 dark:text-slate-800/80" />
                    <line x1="0" y1="120" x2="700" y2="120" stroke="currentColor" strokeDasharray="3 3" className="text-slate-100 dark:text-slate-800/80" />
                    <line x1="0" y1="170" x2="700" y2="170" stroke="currentColor" strokeDasharray="3 3" className="text-slate-100 dark:text-slate-800/80" />

                    {/* Previous period line (dotted gray) */}
                    <path
                      d="M 10 140 Q 90 120 180 135 T 350 110 T 520 90 T 690 70"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      opacity="0.6"
                    />

                    {/* Current period area fill */}
                    <path
                      d="M 10 130 Q 90 145 180 120 T 350 80 T 520 115 T 690 60 L 690 180 L 10 180 Z"
                      fill="url(#profitGrad)"
                    />

                    {/* Current period smooth blue line */}
                    <path
                      d="M 10 130 Q 90 145 180 120 T 350 80 T 520 115 T 690 60"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                    />

                    {/* Active highlighted point (Jan 18) */}
                    <circle cx="350" cy="80" r="5" fill="#2563EB" stroke="#ffffff" strokeWidth="2.5" />
                    <line x1="350" y1="80" x2="350" y2="180" stroke="#2563EB" strokeDasharray="3 3" strokeWidth="1.5" opacity="0.6" />
                  </svg>

                  {/* X-Axis Labels */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-2">
                    <span>1 Jan</span>
                    <span>8 Jan</span>
                    <span>15 Jan</span>
                    <span>22 Jan</span>
                    <span>29 Jan</span>
                  </div>
                </div>

                {/* Sub-cards: Customer Segment Breakdown */}
                <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Customers Breakdown
                    </span>
                    <button type="button" className="text-slate-400 hover:text-slate-600">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-blue-600" />
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Retailers</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">2,884</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Distributors</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">1,432</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Wholesalers</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">562</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Best Selling Products Card */}
              <div className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Best Selling Products
                  </h2>
                  <button type="button" className="text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="pb-3 font-semibold">ID</th>
                        <th className="pb-3 font-semibold">NAME</th>
                        <th className="pb-3 font-semibold text-center">SOLD</th>
                        <th className="pb-3 font-semibold text-right">REVENUE</th>
                        <th className="pb-3 font-semibold text-right">RATING</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {bestSellingProducts.map((p) => {
                        const Icon = p.icon;
                        return (
                          <tr key={p.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3.5 font-mono text-slate-400 font-medium">
                              {p.id}
                            </td>
                            <td className="py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0">
                                  <Icon className="w-4 h-4" />
                                </div>
                                <span className="font-semibold text-slate-900 dark:text-white truncate max-w-xs">
                                  {p.name}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 text-center font-medium text-slate-500 dark:text-slate-400">
                              {p.sold}
                            </td>
                            <td className="py-3.5 text-right font-bold text-slate-900 dark:text-white font-mono">
                              {p.revenue}
                            </td>
                            <td className="py-3.5 text-right">
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-500 text-xs">
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                ({p.rating})
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column (4 of 12 columns / 34%) */}
            <div className="xl:col-span-4 space-y-6">
              {/* Most Day Active Card */}
              <div className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Most Day Active
                  </h2>
                  <button type="button" className="text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                <div className="h-44 flex items-end justify-between gap-3 px-2">
                  {daysData.map((d) => (
                    <div key={d.day} className="flex-1 flex flex-col items-center gap-2 group">
                      {d.active && (
                        <span className="text-[11px] font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded shadow-sm">
                          {d.value}
                        </span>
                      )}
                      <div
                        style={{ height: d.height }}
                        className={`w-full rounded-lg transition-all ${
                          d.active
                            ? 'bg-blue-600 shadow-md shadow-blue-500/30'
                            : 'bg-slate-200/80 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700'
                        }`}
                      />
                      <span
                        className={`text-[11px] font-medium ${
                          d.active
                            ? 'font-bold text-blue-600 dark:text-blue-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {d.day}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Repeat Customer Rate Card */}
              <div className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col items-center text-center">
                <div className="w-full flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Repeat Customer Rate
                  </h2>
                  <button type="button" className="text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Radial Semi-Circle Gauge */}
                <div className="relative w-48 h-28 flex items-end justify-center overflow-hidden my-2">
                  <svg className="w-44 h-44 overflow-visible" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="currentColor"
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="8"
                      strokeDasharray="125 125"
                      strokeDashoffset="0"
                      transform="rotate(-180 50 50)"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="8"
                      strokeDasharray="125 125"
                      strokeDashoffset="40"
                      strokeLinecap="round"
                      transform="rotate(-180 50 50)"
                    />
                  </svg>
                  <div className="absolute bottom-1 text-center">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono">
                      68%
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2">
                  On track for 80% target
                </p>

                <button
                  type="button"
                  className="mt-4 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                >
                  Show details
                </button>
              </div>

              {/* AI Assistant Card (Orb + Prompt) */}
              <div className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    AI Assistant
                  </h2>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </div>

                {/* Glowing 3D Orb Visual */}
                <div className="my-6 flex flex-col items-center justify-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-blue-500/20 dark:bg-blue-600/30 blur-xl animate-pulse" />
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-700 via-blue-500 to-sky-300 shadow-lg shadow-blue-500/50 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-white/40 blur-[2px] -mt-4 -ml-4" />
                    </div>
                  </div>

                  {aiResponse && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed text-center">
                      {aiResponse}
                    </div>
                  )}
                </div>

                {/* Prompt Input Form */}
                <form onSubmit={handleAiAsk} className="relative mt-2">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Ask me anything..."
                    className="w-full pl-4 pr-16 py-2.5 rounded-full border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                  />
                  <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="submit"
                      className="w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Slide-over Drawer for Add Widget */}
      <WidgetDrawer
        isOpen={widgetDrawerOpen}
        onClose={() => setWidgetDrawerOpen(false)}
      />
    </div>
  );
}
