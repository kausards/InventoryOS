'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { api } from '../../lib/api';
import {
  Boxes,
  History,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Search,
  Warehouse,
  ArrowUpRight,
  ArrowDownRight,
  X,
  FileCheck2,
  RefreshCw,
} from 'lucide-react';

interface StockBalance {
  id: string;
  warehouseId: string;
  warehouseName: string;
  variantId: string;
  sku: string;
  variantName: string;
  productName: string;
  retailPrice: number;
  purchaseCost: number;
  lowStockThreshold: number;
  onHand: number;
  reserved: number;
  available: number;
  valuation: number;
  isLowStock: boolean;
}

interface LedgerMovement {
  id: string;
  type: string;
  quantity: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  note?: string | null;
  unitCost: number;
  createdAt: string;
  warehouseName: string;
  sku: string;
  variantName: string;
  actorName?: string | null;
  actorEmail?: string | null;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<'balances' | 'ledger' | 'reconcile'>('balances');
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [movements, setMovements] = useState<LedgerMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Adjustment Drawer State
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockBalance | null>(null);
  const [countedQty, setCountedQty] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<'stocktake' | 'damaged' | 'shrinkage' | 'correction' | 'other'>('stocktake');
  const [adjustNote, setAdjustNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Reconcile Status
  const [reconcileResult, setReconcileResult] = useState<{
    onHand: number;
    ledgerSum: number;
    isBalanced: boolean;
    drift: number;
  } | null>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const [stockRes, ledgerRes] = await Promise.allSettled([
        api.get('/inventory/stock'),
        api.get('/inventory/ledger'),
      ]);

      if (stockRes.status === 'fulfilled') {
        setBalances(stockRes.value || []);
      }
      if (ledgerRes.status === 'fulfilled') {
        setMovements(ledgerRes.value.items || []);
      }
    } catch (err) {
      console.warn('Backend unavailable, using initial demo inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleOpenAdjust = (item: StockBalance) => {
    setSelectedItem(item);
    setCountedQty(item.onHand);
    setAdjustReason('stocktake');
    setAdjustNote('');
    setIsAdjustOpen(true);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (countedQty < selectedItem.reserved) {
      showNotification(
        `Negative available stock blocked! Cannot reduce below ${selectedItem.reserved} units currently reserved for orders.`,
        'error'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/inventory/adjust', {
        warehouseId: selectedItem.warehouseId,
        variantId: selectedItem.variantId,
        countedQuantity: Number(countedQty),
        reason: adjustReason,
        note: adjustNote,
      });

      showNotification('Stock adjusted successfully and recorded in immutable ledger!', 'success');
      setIsAdjustOpen(false);
      fetchInventory();
    } catch (err: any) {
      showNotification(err.message || 'Failed to adjust stock', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReconcileCheck = async (item: StockBalance) => {
    try {
      const res = await api.get(`/inventory/reconcile/${item.warehouseId}/${item.variantId}`);
      setReconcileResult(res);
      if (res.isBalanced) {
        showNotification(`Perfect Match! On-Hand (${res.onHand}) matches Ledger Sum (${res.ledgerSum}) exactly.`, 'success');
      } else {
        showNotification(`Drift detected: ${res.drift} units discrepancy between ledger and on-hand!`, 'error');
      }
    } catch (err: any) {
      showNotification(err.message || 'Reconciliation check failed', 'error');
    }
  };

  // KPI Calculations
  const totalSkus = balances.length;
  const totalOnHand = balances.reduce((acc, b) => acc + b.onHand, 0);
  const totalReserved = balances.reduce((acc, b) => acc + b.reserved, 0);
  const totalAvailable = balances.reduce((acc, b) => acc + b.available, 0);
  const totalValuation = balances.reduce((acc, b) => acc + (b.valuation / 100), 0);

  const filteredBalances = balances.filter(
    (b) =>
      b.productName.toLowerCase().includes(search.toLowerCase()) ||
      b.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 font-sans transition-colors">
      <Sidebar activeTenantName="Growthomic Store" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar onOpenAddWidget={() => {}} />

        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Notification Toast */}
          {notification && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-md transition-all ${
                notification.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Inventory & Stock Ledger
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-500/10">
                  Main Warehouse
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live warehouse stock balances, immutable transaction ledger, and atomic reservations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchInventory}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Units On Hand</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalOnHand}</span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Physical Stock
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Reserved for Orders</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalReserved}</span>
                <span className="text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                  Pending Dispatch
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Available to Sell</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalAvailable}</span>
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                  On Hand - Reserved
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Stock Valuation</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  ৳{totalValuation.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </span>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  Weighted Avg
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-2">
            <button
              onClick={() => setActiveTab('balances')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'balances'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Boxes className="w-4 h-4" />
              Stock Balances
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'ledger'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              Immutable Ledger History
            </button>
          </div>

          {/* Tab 1: Stock Balances Table */}
          {activeTab === 'balances' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search stock balances by SKU or product..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
                        <th className="py-3.5 px-4">SKU / Item</th>
                        <th className="py-3.5 px-4">Warehouse</th>
                        <th className="py-3.5 px-4">On-Hand</th>
                        <th className="py-3.5 px-4">Reserved</th>
                        <th className="py-3.5 px-4">Available</th>
                        <th className="py-3.5 px-4">Valuation (Cost)</th>
                        <th className="py-3.5 px-4">Health</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                            Loading warehouse balances...
                          </td>
                        </tr>
                      ) : filteredBalances.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                            No inventory items found. Add products with opening stock to see them here.
                          </td>
                        </tr>
                      ) : (
                        filteredBalances.map((item) => (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-slate-900 dark:text-white block font-mono">
                                {item.sku}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {item.productName} · {item.variantName}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                                {item.warehouseName}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                              {item.onHand}
                            </td>

                            <td className="py-3.5 px-4 font-bold text-purple-600 dark:text-purple-400">
                              {item.reserved}
                            </td>

                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  item.available > 5
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                    : item.available > 0
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {item.available} units
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                              ৳{(item.valuation / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>

                            <td className="py-3.5 px-4">
                              {item.available <= item.lowStockThreshold ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Low Stock (&lt;={item.lowStockThreshold})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Optimal
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleReconcileCheck(item)}
                                  title="Audit Ledger Drift"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <FileCheck2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleOpenAdjust(item)}
                                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-colors"
                                >
                                  Adjust
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Immutable Ledger History */}
          {activeTab === 'ledger' && (
            <div className="rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Immutable Ledger Audit Trail</h3>
                  <p className="text-[11px] text-slate-400">Every physical movement is append-only and cannot be altered or removed.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Quantity Delta</th>
                      <th className="py-3 px-4">SKU / Item</th>
                      <th className="py-3 px-4">Reason / Reference</th>
                      <th className="py-3 px-4">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs">
                    {movements.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                          No movements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      movements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {m.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold">
                            <span
                              className={`inline-flex items-center gap-0.5 ${
                                m.quantity > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {m.quantity > 0 ? (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5" />
                              )}
                              {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">
                              {m.sku}
                            </span>
                            <span className="text-[11px] text-slate-400">{m.variantName}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                            {m.reason || m.referenceType || 'System entry'}
                            {m.note && <span className="block text-[11px] text-slate-400 italic">"{m.note}"</span>}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {m.actorName || m.actorEmail || 'System'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Stock Adjustment Slide-over Drawer */}
        {isAdjustOpen && selectedItem && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-md bg-white dark:bg-[#121826] h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                      <SlidersHorizontal className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Adjust Stock Count</h2>
                      <p className="text-[11px] text-slate-500 font-mono">{selectedItem.sku}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAdjustOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Current Stock Context */}
                <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Current On-Hand</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white">{selectedItem.onHand}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Reserved Orders</span>
                    <span className="text-base font-bold text-purple-600">{selectedItem.reserved}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Available</span>
                    <span className="text-base font-bold text-blue-600">{selectedItem.available}</span>
                  </div>
                </div>

                <form id="adjustForm" onSubmit={handleAdjustSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      New Actual Counted Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={countedQty}
                      onChange={(e) => setCountedQty(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm font-bold bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                    <div className="flex items-center justify-between text-[11px] mt-1.5 px-1">
                      <span className="text-slate-400">Calculated Adjustment Delta:</span>
                      <span
                        className={`font-bold ${
                          countedQty - selectedItem.onHand > 0
                            ? 'text-emerald-600'
                            : countedQty - selectedItem.onHand < 0
                            ? 'text-rose-600'
                            : 'text-slate-500'
                        }`}
                      >
                        {countedQty - selectedItem.onHand > 0
                          ? `+${countedQty - selectedItem.onHand} (Addition)`
                          : countedQty - selectedItem.onHand < 0
                          ? `${countedQty - selectedItem.onHand} (Reduction)`
                          : '0 (No Change)'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Reason for Discrepancy *
                    </label>
                    <select
                      value={adjustReason}
                      onChange={(e: any) => setAdjustReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="stocktake">Periodic Physical Stocktake</option>
                      <option value="damaged">Damaged in Warehouse</option>
                      <option value="shrinkage">Loss / Shrinkage</option>
                      <option value="correction">Inventory Correction</option>
                      <option value="other">Other Reason</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                      Audit Note (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      placeholder="e.g. Broken packaging discovered in Section B-4"
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Safety Warning */}
                  {countedQty < selectedItem.reserved && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/20 text-rose-600 text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Blocked: On-hand count cannot be lower than {selectedItem.reserved} units currently locked in orders.
                      </span>
                    </div>
                  )}
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0B0F17]/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="adjustForm"
                  disabled={isSubmitting || countedQty < selectedItem.reserved}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Adjustment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
