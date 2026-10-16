'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { api } from '../../lib/api';
import {
  TrendingUp,
  DollarSign,
  Truck,
  Package,
  RotateCcw,
  Receipt,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  PieChart,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function FinancesPnLPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [pnlData, setPnlData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPnL = async (selectedPeriod: string) => {
    try {
      setLoading(true);
      setError(null);

      let startDate: string | undefined;
      const now = new Date();
      if (selectedPeriod === 'today') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        startDate = d.toISOString();
      } else if (selectedPeriod === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (selectedPeriod === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (selectedPeriod === '90d') {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      }

      const queryParam = startDate ? `?startDate=${encodeURIComponent(startDate)}` : '';
      const res = await api.get(`/finance/pnl${queryParam}`);
      setPnlData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load P&L statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL(period);
  }, [period]);

  const formatTaka = (minorAmount: number | undefined) => {
    if (minorAmount == null) return '৳0.00';
    const taka = minorAmount / 100;
    return `৳${taka.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0c111d] text-slate-900 dark:text-slate-100 antialiased overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Finance & Profit/Loss Statement
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                  PRD R.3
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Deterministic accrual accounting. Revenue recognized upon delivery, COGS & direct order costs snapshot.
              </p>
            </div>

            {/* Quick Actions & Period Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1 shadow-sm">
                {(['today', '7d', '30d', '90d', 'all'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      period === p
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {p === 'today'
                      ? 'Today'
                      : p === '7d'
                      ? '7 Days'
                      : p === '30d'
                      ? '30 Days'
                      : p === '90d'
                      ? '90 Days'
                      : 'All Time'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => fetchPnL(period)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm"
                title="Refresh Report"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2">
            <Link
              href="/finances"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
            >
              P&L Overview
            </Link>
            <Link
              href="/finances/ledger"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Transaction Ledger
            </Link>
            <Link
              href="/finances/expenses"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Operating Expenses
            </Link>
            <Link
              href="/finances/settlements"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              COD Settlements
            </Link>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Net Product Sales */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Net Product Sales</span>
                <span className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                  <DollarSign className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formatTaka(pnlData?.revenue?.netProductSalesMinor)}
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>Gross: {formatTaka(pnlData?.revenue?.grossSalesMinor)}</span>
                <span className="text-rose-500">
                  Rev: -{formatTaka(pnlData?.revenue?.salesReversalsMinor)}
                </span>
              </div>
            </div>

            {/* 2. Gross Profit & Margin */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Gross Profit</span>
                <span className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {formatTaka(pnlData?.profit?.grossProfitMinor)}
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>COGS: {formatTaka(pnlData?.cogs?.totalCogsMinor)}</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  Margin: {pnlData?.profit?.grossMarginPercent ?? 0}%
                </span>
              </div>
            </div>

            {/* 3. Direct Order Costs & Contribution */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Contribution Margin</span>
                <span className="p-1 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                  <Package className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {formatTaka(pnlData?.directOrderCosts?.contributionMarginMinor)}
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>Order Costs: {formatTaka(pnlData?.directOrderCosts?.totalDirectOrderCostsMinor)}</span>
                <span>(Courier + Pack)</span>
              </div>
            </div>

            {/* 4. Operating Profit / Net Profit */}
            <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Operating Profit</span>
                <span className="p-1 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-600">
                  <Receipt className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                {formatTaka(pnlData?.bottomLine?.operatingProfitMinor)}
              </div>
              <div className="text-[11px] text-slate-400 flex justify-between">
                <span>Opex: {formatTaka(pnlData?.operatingExpenses?.totalOperatingExpensesMinor)}</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  Margin: {pnlData?.bottomLine?.operatingMarginPercent ?? 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Statement Section */}
          <div className="bg-white dark:bg-[#121826] rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Deterministic Income Statement Breakdown
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Transactions accounted: {pnlData?.transactionsCount ?? 0} posted ledger records
                </p>
              </div>
              <div className="text-xs px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                Currency: BDT
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {/* Category 1: Revenue */}
              <div className="p-4 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="text-emerald-600 dark:text-emerald-400">1. REVENUE (DELIVERED SALES)</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatTaka(pnlData?.revenue?.netProductSalesMinor)}
                  </span>
                </div>
                <div className="pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Delivered Gross Product Sales</span>
                    <span>{formatTaka(pnlData?.revenue?.grossSalesMinor)}</span>
                  </div>
                  <div className="flex justify-between text-rose-500">
                    <span>Discounts & Recognized Reversals</span>
                    <span>-{formatTaka(pnlData?.revenue?.salesReversalsMinor)}</span>
                  </div>
                </div>
              </div>

              {/* Category 2: COGS */}
              <div className="p-4 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">2. COST OF GOODS SOLD (COGS)</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{formatTaka(pnlData?.cogs?.totalCogsMinor)}
                  </span>
                </div>
                <div className="pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Product Unit Cost Snapshot (Recognized at delivery)</span>
                    <span>{formatTaka(pnlData?.cogs?.totalCogsMinor)}</span>
                  </div>
                </div>
              </div>

              {/* Intermediate 1: Gross Profit */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span className="text-blue-600 dark:text-blue-400">GROSS PROFIT (= Net Sales − COGS)</span>
                <span className="text-blue-600 dark:text-blue-400 text-sm">
                  {formatTaka(pnlData?.profit?.grossProfitMinor)}
                </span>
              </div>

              {/* Category 3: Direct Order Costs */}
              <div className="p-4 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">3. DIRECT ORDER-LEVEL COSTS</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{formatTaka(pnlData?.directOrderCosts?.totalDirectOrderCostsMinor)}
                  </span>
                </div>
                <div className="pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3 h-3 text-slate-400" />
                      Courier Delivery Charges
                    </span>
                    <span>{formatTaka(pnlData?.directOrderCosts?.courierCostsMinor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-slate-400" />
                      Packaging Material Cost (Boxes, Flyers, Tape)
                    </span>
                    <span>{formatTaka(pnlData?.directOrderCosts?.packagingCostsMinor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>COD Handling Fees</span>
                    <span>{formatTaka(pnlData?.directOrderCosts?.codFeesMinor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <RotateCcw className="w-3 h-3 text-slate-400" />
                      Return Logistics & Damage Costs
                    </span>
                    <span>{formatTaka(pnlData?.directOrderCosts?.returnCostsMinor)}</span>
                  </div>
                </div>
              </div>

              {/* Intermediate 2: Contribution Margin */}
              <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between font-bold text-slate-900 dark:text-white">
                <span className="text-amber-600 dark:text-amber-400">
                  CONTRIBUTION MARGIN (= Gross Profit − Direct Order Costs)
                </span>
                <span className="text-amber-600 dark:text-amber-400 text-sm">
                  {formatTaka(pnlData?.directOrderCosts?.contributionMarginMinor)}
                </span>
              </div>

              {/* Category 4: Operating Expenses */}
              <div className="p-4 space-y-2">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                  <span className="text-slate-700 dark:text-slate-300">4. OPERATING EXPENSES (OPEX)</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    -{formatTaka(pnlData?.operatingExpenses?.totalOperatingExpensesMinor)}
                  </span>
                </div>
                <div className="pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>Operating Expenses (Rent, Salaries, Marketing, Utilities, Software)</span>
                    <Link
                      href="/finances/expenses"
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <span>View details</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Final Bottom Line: Operating Profit */}
              <div className="p-5 bg-purple-50/60 dark:bg-purple-950/20 flex items-center justify-between font-extrabold text-sm text-purple-700 dark:text-purple-300">
                <div className="flex flex-col">
                  <span>OPERATING PROFIT (= Gross Profit − Operating Expenses)</span>
                  <span className="text-xs font-normal text-purple-600/80 dark:text-purple-400/80">
                    Operating Margin: {pnlData?.bottomLine?.operatingMarginPercent ?? 0}%
                  </span>
                </div>
                <span className="text-lg">
                  {formatTaka(pnlData?.bottomLine?.operatingProfitMinor)}
                </span>
              </div>

              {/* Cash Basis Movement */}
              <div className="p-4 bg-slate-100/70 dark:bg-slate-900/50 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-slate-500" />
                  <span>Net Cash Movement (Actual Inflows − Outflows)</span>
                  <span className="text-[10px] font-normal text-slate-400">(Cash Basis, separate from Accrual)</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatTaka(pnlData?.bottomLine?.netCashMovementMinor)}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
