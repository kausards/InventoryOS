'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Lock,
} from 'lucide-react';

interface TransactionItem {
  id: string;
  transactionNumber: string;
  type: string;
  direction: 'in' | 'out';
  category: string;
  amountMinor: number;
  currency: string;
  date: string;
  referenceType: string | null;
  referenceId: string | null;
  paymentMethod: string | null;
  status: string;
  reversalOf: string | null;
  notes: string | null;
  createdAt: string;
}

export default function FinanceLedgerPage() {
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Reversal Modal State
  const [reversalTarget, setReversalTarget] = useState<TransactionItem | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalSubmitting, setReversalSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Manual Transaction Modal State
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    type: 'adjustment' as const,
    direction: 'in' as const,
    category: 'other' as const,
    amountMajor: '',
    paymentMethod: 'cash' as const,
    notes: '',
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedType !== 'all') params.append('type', selectedType);
      if (selectedDirection !== 'all') params.append('direction', selectedDirection);
      params.append('limit', '50');

      const res = await api.get(`/finance/transactions?${params.toString()}`);
      if (res && Array.isArray(res.items)) {
        setTransactions(res.items);
        setTotal(res.total ?? res.items.length);
      } else {
        setTransactions([]);
        setTotal(0);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load ledger transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedType, selectedDirection]);

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget || !reversalReason.trim()) return;

    try {
      setReversalSubmitting(true);
      await api.post(`/finance/transactions/${reversalTarget.id}/reverse`, {
        reason: reversalReason.trim(),
      });

      setNotification({
        message: `Transaction ${reversalTarget.transactionNumber} reversed successfully. Offsetting entry posted.`,
        type: 'success',
      });
      setReversalTarget(null);
      setReversalReason('');
      fetchTransactions();
    } catch (err: any) {
      setNotification({
        message: err?.message || 'Failed to reverse transaction',
        type: 'error',
      });
    } finally {
      setReversalSubmitting(false);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(manualForm.amountMajor);
    if (isNaN(amountVal) || amountVal <= 0) {
      setNotification({ message: 'Please enter a valid positive amount', type: 'error' });
      return;
    }

    try {
      setManualSubmitting(true);
      const amountMinor = Math.round(amountVal * 100);

      await api.post('/finance/transactions', {
        type: manualForm.type,
        direction: manualForm.direction,
        category: manualForm.category,
        amountMinor,
        currency: 'BDT',
        paymentMethod: manualForm.paymentMethod,
        notes: manualForm.notes || undefined,
      });

      setNotification({ message: 'Manual transaction posted to ledger.', type: 'success' });
      setIsManualModalOpen(false);
      setManualForm({
        type: 'adjustment',
        direction: 'in',
        category: 'other',
        amountMajor: '',
        paymentMethod: 'cash',
        notes: '',
      });
      fetchTransactions();
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to post transaction', type: 'error' });
    } finally {
      setManualSubmitting(false);
    }
  };

  const formatTaka = (minor: number) => {
    const taka = minor / 100;
    return `৳${taka.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredTransactions = transactions.filter((t) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      t.transactionNumber.toLowerCase().includes(term) ||
      (t.referenceId && t.referenceId.toLowerCase().includes(term)) ||
      (t.notes && t.notes.toLowerCase().includes(term))
    );
  });

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
                  Financial Transaction Ledger
                </h1>
                <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <Lock className="w-3 h-3 text-slate-500" />
                  Immutable PRD R.5
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Single-entry ledger records (Double-entry ready). Posted rows are immutable; corrections via offsetting reversals.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsManualModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Transaction</span>
              </button>

              <button
                onClick={fetchTransactions}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm"
                title="Refresh Ledger"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2">
            <Link
              href="/finances"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              P&L Overview
            </Link>
            <Link
              href="/finances/ledger"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
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

          {notification && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                notification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>{notification.message}</span>
              </div>
              <button onClick={() => setNotification(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                <option value="all">All Types</option>
                <option value="sale">Sales (Delivered)</option>
                <option value="cogs">COGS</option>
                <option value="courier_fee">Courier Shipping Fee</option>
                <option value="packaging_cost">Packaging Cost</option>
                <option value="cod_fee">COD Fee</option>
                <option value="return_cost">Return Cost</option>
                <option value="expense">Operating Expense</option>
                <option value="adjustment">Adjustments</option>
              </select>

              {/* Direction Filter */}
              <select
                value={selectedDirection}
                onChange={(e) => setSelectedDirection(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                <option value="all">All Directions</option>
                <option value="in">Inflow (Cash/Revenue In)</option>
                <option value="out">Outflow (Cost/Expense Out)</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transaction # or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white dark:bg-[#121826] rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Transaction #</th>
                    <th className="px-4 py-3">Type / Category</th>
                    <th className="px-4 py-3">Direction</th>
                    <th className="px-4 py-3 text-right">Amount (BDT)</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-sans">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading ledger entries...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-sans">
                        No financial transactions found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((t) => {
                      const isReversed = t.status === 'reversed';
                      const isReversalEntry = t.reversalOf != null || t.transactionNumber.startsWith('REV-');

                      return (
                        <tr
                          key={t.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                            isReversed ? 'opacity-60 bg-slate-50/30 dark:bg-slate-900/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-sans text-slate-500 whitespace-nowrap">
                            {new Date(t.date).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                            <span className={isReversed ? 'line-through text-slate-400' : ''}>
                              {t.transactionNumber}
                            </span>
                            {isReversalEntry && (
                              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-sans">
                                Reversal
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
                                {t.type.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                                {t.category}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-sans">
                            {t.direction === 'in' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                                <ArrowDownLeft className="w-3 h-3" />
                                Inflow
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                                <ArrowUpRight className="w-3 h-3" />
                                Outflow
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-bold ${
                              t.direction === 'in'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {t.direction === 'out' ? '-' : '+'}
                            {formatTaka(t.amountMinor)}
                          </td>
                          <td className="px-4 py-3 font-sans text-slate-600 dark:text-slate-400">
                            {t.referenceType ? (
                              <span className="text-xs">
                                <span className="capitalize">{t.referenceType}</span>:{' '}
                                <span className="font-mono text-[11px]">{t.referenceId ? t.referenceId.slice(0, 8) : '—'}</span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 font-sans">
                            {t.status === 'posted' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Posted
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                                Reversed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-sans">
                            {t.status === 'posted' && !isReversalEntry ? (
                              <button
                                onClick={() => setReversalTarget(t)}
                                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center justify-end gap-1 ml-auto"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reverse</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredTransactions.length} of {total} records</span>
              <span className="text-[11px]">Audit compliant • PRD Part R</span>
            </div>
          </div>

          {/* Reversal Modal */}
          {reversalTarget && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <RotateCcw className="w-4 h-4" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Reverse Financial Transaction
                    </h3>
                  </div>
                  <button onClick={() => setReversalTarget(null)}>
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                  <p className="font-semibold mb-1">Immutable Ledger Notice:</p>
                  <p>
                    Transaction <span className="font-mono font-bold">{reversalTarget.transactionNumber}</span> cannot be deleted or overwritten. An offsetting reversal transaction ({reversalTarget.direction === 'in' ? 'Outflow' : 'Inflow'} of {formatTaka(reversalTarget.amountMinor)}) will be posted.
                  </p>
                </div>

                <form onSubmit={handleReverse} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Reason for Reversal *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={reversalReason}
                      onChange={(e) => setReversalReason(e.target.value)}
                      placeholder="e.g. Customer returned goods, erroneous entry correction, courier refund adjustment..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setReversalTarget(null)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reversalSubmitting || reversalReason.trim().length < 5}
                      className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {reversalSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Post Reversal</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Manual Transaction Modal */}
          {isManualModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    Post Manual Ledger Transaction
                  </h3>
                  <button onClick={() => setIsManualModalOpen(false)}>
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>

                <form onSubmit={handleCreateManual} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Transaction Type
                    </label>
                    <select
                      value={manualForm.type}
                      onChange={(e) => setManualForm({ ...manualForm, type: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    >
                      <option value="adjustment">Adjustment / Correction</option>
                      <option value="expense">Operating Expense</option>
                      <option value="payout">Owner Payout / Dividend</option>
                      <option value="refund">Customer Refund</option>
                      <option value="sale">Direct Cash Sale</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Direction
                      </label>
                      <select
                        value={manualForm.direction}
                        onChange={(e) => setManualForm({ ...manualForm, direction: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="in">Inflow (+ Cash In)</option>
                        <option value="out">Outflow (- Cost/Expense)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={manualForm.paymentMethod}
                        onChange={(e) => setManualForm({ ...manualForm, paymentMethod: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Amount in BDT (৳) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 500.00"
                      value={manualForm.amountMajor}
                      onChange={(e) => setManualForm({ ...manualForm, amountMajor: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Notes / Description
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Reason or invoice reference..."
                      value={manualForm.notes}
                      onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsManualModalOpen(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={manualSubmitting || !manualForm.amountMajor}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {manualSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Post Entry</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
