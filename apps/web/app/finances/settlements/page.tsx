'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  Wallet,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Building2,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Download,
  Info,
} from 'lucide-react';

interface SettlementItem {
  id: string;
  statementReference: string;
  statementDate: string;
  totalExpectedCodMinor: string | number;
  totalSettledMinor: string | number;
  totalFeeDeductedMinor: string | number;
  settlementStatus: string;
  createdAt: string;
}

export default function CourierSettlementsPage() {
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Import modal form
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [statementRef, setStatementRef] = useState('');
  const [csvText, setCsvText] = useState(
    'SF-CONS-1001,1500,80,1420\nSF-CONS-1002,2400,120,2280'
  );
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settlementsRes, accountsRes] = await Promise.all([
        api.get('/couriers/settlements'),
        api.get('/couriers/accounts'),
      ]);
      setSettlements(Array.isArray(settlementsRes) ? settlementsRes : []);
      const accList = Array.isArray(accountsRes) ? accountsRes : [];
      setAccounts(accList);
      if (accList.length > 0) {
        setSelectedAccountId(accList[0].id);
      }
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to load settlements', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleImportSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !statementRef.trim() || !csvText.trim()) {
      setNotification({ message: 'All fields are required', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const lines = csvText.trim().split('\n');
      const items = lines.map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        return {
          consignmentId: parts[0] || 'UNKNOWN',
          codAmount: Number(parts[1] || 0),
          courierFee: Number(parts[2] || 0),
          netSettled: Number(parts[3] || 0),
        };
      });

      await api.post('/couriers/settlements', {
        courierAccountId: selectedAccountId,
        statementReference: statementRef.trim(),
        items,
      });

      setNotification({ message: 'Settlement statement imported and shipments reconciled successfully!', type: 'success' });
      setIsModalOpen(false);
      setStatementRef('');
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Settlement import failed', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTaka = (minor: string | number) => {
    const num = Number(minor || 0) / 100;
    return `৳${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Calculate totals
  const totalSettled = settlements.reduce((acc, s) => acc + Number(s.totalSettledMinor || 0), 0);
  const totalFees = settlements.reduce((acc, s) => acc + Number(s.totalFeeDeductedMinor || 0), 0);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {notification && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm transition-all ${
                notification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                )}
                <span>{notification.message}</span>
              </div>
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <span>Finances</span>
                <span>/</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">COD Settlements</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Wallet className="w-6 h-6 text-emerald-600" />
                COD Settlements
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Reconcile courier statements, disbursements, and delivery deductions.
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Import Settlement</span>
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Net Settled</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {formatTaka(totalSettled)}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600">
                <TrendingUp className="w-6 h-6 rotate-180" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Courier Fees Deducted</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {formatTaka(totalFees)}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Statements Reconciled</span>
                <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                  {settlements.length} Statements
                </div>
              </div>
            </div>
          </div>

          {/* Settlements Table */}
          <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Settlement History</h2>
              <span className="text-xs text-slate-400">{settlements.length} statements found</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/60 dark:bg-slate-900/40">
                    <th className="py-3 px-4">Statement Reference</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Total COD Collected</th>
                    <th className="py-3 px-4">Fees Deducted</th>
                    <th className="py-3 px-4">Net Settled to Bank</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                        <span>Loading settlements...</span>
                      </td>
                    </tr>
                  ) : settlements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        No settlement statements imported yet. Click &quot;Import Settlement&quot; to reconcile payments.
                      </td>
                    </tr>
                  ) : (
                    settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                          {s.statementReference}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {new Date(s.statementDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                          {formatTaka(s.totalExpectedCodMinor)}
                        </td>
                        <td className="py-3.5 px-4 text-rose-600 font-medium">
                          {formatTaka(s.totalFeeDeductedMinor)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                          {formatTaka(s.totalSettledMinor)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Settled
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Import Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Import Courier Statement</h3>
                  <p className="text-xs text-slate-500">Reconcile COD payments & fees from Steadfast</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImportSettlement} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Courier Account
                </label>
                {accounts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      No courier accounts connected yet. Please connect your Steadfast or Pathao account first.
                    </p>
                    <Link
                      href="/settings/couriers"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Connect Courier Account
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.accountName} ({a.courierCode ? a.courierCode.toUpperCase() : 'COURIER'}) {a.isDefault ? '— Default' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Statement Reference / Invoice #
                </label>
                <input
                  type="text"
                  required
                  value={statementRef}
                  onChange={(e) => setStatementRef(e.target.value)}
                  placeholder="e.g. SF-STMT-2026-OCT-01"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Shipment Lines (CSV format)</span>
                  <span className="text-[10px] text-slate-400">consignment_id,cod,fee,net</span>
                </label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Reconcile Statement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
