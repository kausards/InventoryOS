'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  Users,
  History,
  Plus,
  Search,
  CheckCircle2,
  X,
  RefreshCw,
  Phone,
  Clock,
  Sparkles,
  Info,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ShieldX,
} from 'lucide-react';
import { normalizeBdPhone } from '@growthomic/shared';

interface RiskRulesData {
  id?: string;
  minEligibleOrders: number;
  cancellationThresholdPercent: number;
  returnThresholdPercent: number;
  deliveryFailureThresholdPercent: number;
  autoFlagHighRisk: boolean;
  manualReviewRequiredForHighRisk: boolean;
  cacheDurationHours: number;
  updatedAt?: string;
}

interface BlacklistEntryData {
  id: string;
  phone: string;
  normalizedPhone: string;
  type: 'blacklist' | 'watchlist';
  reason: string;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

interface RuleHistoryData {
  id: string;
  rulesSnapshot: any;
  reason?: string | null;
  createdAt: string;
}

export default function RiskSettingsPage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'blacklist' | 'history'>('rules');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Rules State
  const [rules, setRules] = useState<RiskRulesData>({
    minEligibleOrders: 3,
    cancellationThresholdPercent: 40,
    returnThresholdPercent: 25,
    deliveryFailureThresholdPercent: 30,
    autoFlagHighRisk: true,
    manualReviewRequiredForHighRisk: true,
    cacheDurationHours: 24,
  });

  // Save Rules Modal (mandatory reason)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveReason, setSaveReason] = useState('');

  // Blacklist State
  const [blacklist, setBlacklist] = useState<BlacklistEntryData[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'blacklist' | 'watchlist'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState<'blacklist' | 'watchlist'>('blacklist');
  const [newReason, setNewReason] = useState('');
  const [phoneValidation, setPhoneValidation] = useState<{ isValid: boolean; normalized?: string } | null>(null);

  // History State
  const [history, setHistory] = useState<RuleHistoryData[]>([]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, blacklistRes, historyRes] = await Promise.all([
        api.get('/risk/settings').catch(() => null),
        api.get('/risk/blacklist').catch(() => []),
        api.get('/risk/history').catch(() => []),
      ]);

      if (rulesRes) {
        setRules({
          minEligibleOrders: rulesRes.minEligibleOrders ?? 3,
          cancellationThresholdPercent: rulesRes.cancellationThresholdPercent ?? 40,
          returnThresholdPercent: rulesRes.returnThresholdPercent ?? 25,
          deliveryFailureThresholdPercent: rulesRes.deliveryFailureThresholdPercent ?? 30,
          autoFlagHighRisk: rulesRes.autoFlagHighRisk ?? true,
          manualReviewRequiredForHighRisk: rulesRes.manualReviewRequiredForHighRisk ?? true,
          cacheDurationHours: rulesRes.cacheDurationHours ?? 24,
          updatedAt: rulesRes.updatedAt,
        });
      }

      setBlacklist(Array.isArray(blacklistRes) ? blacklistRes : []);
      setHistory(Array.isArray(historyRes) ? historyRes : []);
    } catch (err: any) {
      setNotification({ message: 'Failed to load risk settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Phone input handler in Add modal
  const handlePhoneInputChange = (val: string) => {
    setNewPhone(val);
    const norm = normalizeBdPhone(val);
    setPhoneValidation({
      isValid: norm.isValid,
      normalized: norm.e164,
    });
  };

  // Save rules handler
  const handleSaveRules = async () => {
    if (!saveReason.trim()) {
      setNotification({ message: 'Please provide a reason for the rule revision', type: 'error' });
      return;
    }
    try {
      setSaving(true);
      const res = await api.patch('/risk/settings', {
        ...rules,
        reason: saveReason.trim(),
      });
      setNotification({ message: 'Risk engine rules updated successfully!', type: 'success' });
      setIsSaveModalOpen(false);
      setSaveReason('');
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to update rules', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Add blacklist entry
  const handleAddBlacklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValidation?.isValid || !phoneValidation.normalized) {
      setNotification({ message: 'Please provide a valid 11-digit Bangladesh phone number', type: 'error' });
      return;
    }
    if (!newReason.trim()) {
      setNotification({ message: 'Please provide a reason for blacklisting/watchlisting', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      await api.post('/risk/blacklist', {
        phone: newPhone,
        type: newType,
        reason: newReason.trim(),
      });
      setNotification({
        message: `Phone ${phoneValidation.normalized} added to ${newType}!`,
        type: 'success',
      });
      setIsAddModalOpen(false);
      setNewPhone('');
      setNewReason('');
      setPhoneValidation(null);
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to add entry', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (entry: BlacklistEntryData) => {
    try {
      await api.patch(`/risk/blacklist/${entry.id}`, {
        isActive: !entry.isActive,
      });
      setNotification({
        message: `Entry status updated to ${!entry.isActive ? 'Active' : 'Inactive'}`,
        type: 'success',
      });
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to update status', type: 'error' });
    }
  };

  // Filtered blacklist
  const filteredBlacklist = blacklist.filter((item) => {
    const matchesPhone =
      item.phone.includes(searchPhone) ||
      item.normalizedPhone.includes(searchPhone) ||
      item.reason.toLowerCase().includes(searchPhone.toLowerCase());
    const matchesType = typeFilter === 'all' || item.type === typeFilter;
    return matchesPhone && matchesType;
  });

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] transition-colors">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Toast Notification */}
          {notification && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-sm font-medium border shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
                notification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/80'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Customer Risk & Delivery Protection</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200/60 dark:border-emerald-800/60">
                      Active Shield
                    </span>
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Deterministic fraud scoring, return prevention, and manual blacklist protection
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                title="Refresh settings"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'rules'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Risk Rules & Thresholds</span>
            </button>
            <button
              onClick={() => setActiveTab('blacklist')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'blacklist'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Blacklist & Watchlist ({blacklist.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Rule Revision Audit ({history.length})</span>
            </button>
          </div>

          {/* TAB 1: RISK RULES & THRESHOLDS */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Form Grid */}
              <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-sm space-y-6">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Threshold Configuration</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Min Eligible Orders */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Min Eligible Orders
                      </label>
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                        {rules.minEligibleOrders} orders
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Orders below this number evaluate to "Insufficient Data" rather than Low Risk.
                    </p>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={rules.minEligibleOrders}
                      onChange={(e) =>
                        setRules({ ...rules, minEligibleOrders: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Cache Duration */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Risk Check Cache Duration
                      </label>
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                        {rules.cacheDurationHours} hours
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Reuses cached risk evaluations for same phone within this time window.
                    </p>
                    <input
                      type="range"
                      min={1}
                      max={72}
                      step={1}
                      value={rules.cacheDurationHours}
                      onChange={(e) =>
                        setRules({ ...rules, cacheDurationHours: Number(e.target.value) })
                      }
                      className="w-full accent-blue-600"
                    />
                  </div>

                  {/* Cancellation Threshold */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        High Risk Cancellation Threshold
                      </label>
                      <span className="text-xs font-mono font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded">
                        {rules.cancellationThresholdPercent}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Flags customer as High Risk if cancellation rate meets or exceeds this %.
                    </p>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      value={rules.cancellationThresholdPercent}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          cancellationThresholdPercent: Number(e.target.value),
                        })
                      }
                      className="w-full accent-rose-600"
                    />
                  </div>

                  {/* Return Threshold */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        High Risk Return Threshold
                      </label>
                      <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                        {rules.returnThresholdPercent}%
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Flags customer as High Risk if return rate meets or exceeds this %.
                    </p>
                    <input
                      type="range"
                      min={5}
                      max={60}
                      value={rules.returnThresholdPercent}
                      onChange={(e) =>
                        setRules({ ...rules, returnThresholdPercent: Number(e.target.value) })
                      }
                      className="w-full accent-amber-600"
                    />
                  </div>
                </div>

                {/* Automation Toggles */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Automation & Enforcement
                  </h4>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Auto-Flag High Risk Orders
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Automatically attach High Risk badge to matching orders upon creation.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setRules({ ...rules, autoFlagHighRisk: !rules.autoFlagHighRisk })
                      }
                      className={`p-1 rounded-full transition-colors ${
                        rules.autoFlagHighRisk ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    >
                      {rules.autoFlagHighRisk ? (
                        <ToggleRight className="w-8 h-8" />
                      ) : (
                        <ToggleLeft className="w-8 h-8" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Require Manual Review Before Shipping
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Requires manager approval & justification before fulfilling flagged orders.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setRules({
                          ...rules,
                          manualReviewRequiredForHighRisk: !rules.manualReviewRequiredForHighRisk,
                        })
                      }
                      className={`p-1 rounded-full transition-colors ${
                        rules.manualReviewRequiredForHighRisk ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    >
                      {rules.manualReviewRequiredForHighRisk ? (
                        <ToggleRight className="w-8 h-8" />
                      ) : (
                        <ToggleLeft className="w-8 h-8" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Save Action */}
                <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setIsSaveModalOpen(true)}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Rule Changes</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: BLACKLIST & WATCHLIST */}
          {activeTab === 'blacklist' && (
            <div className="space-y-6">
              {/* Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search phone number or reason..."
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="px-3 py-2 text-xs bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="all">All Entries</option>
                    <option value="blacklist">Blacklist Only</option>
                    <option value="watchlist">Watchlist Only</option>
                  </select>
                </div>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-rose-500/20 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Phone to Blocklist</span>
                </button>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Phone Number</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Reason & Notes</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Added On</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {filteredBlacklist.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          <p className="font-semibold text-slate-600 dark:text-slate-300">
                            No entries found
                          </p>
                          <p className="text-[11px] mt-0.5">
                            Add fraudulent or habitual return customer phones to block them.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredBlacklist.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {entry.normalizedPhone}
                            </span>
                            {entry.phone !== entry.normalizedPhone && (
                              <span className="text-[10px] text-slate-400 block">
                                Raw: {entry.phone}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {entry.type === 'blacklist' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                <ShieldX className="w-3 h-3" />
                                Blacklist
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                Watchlist
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300">
                            {entry.reason}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                                entry.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span className="font-medium text-[11px]">
                              {entry.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {new Date(entry.createdAt).toLocaleDateString('en-GB')}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleToggleActive(entry)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              {entry.isActive ? 'Disable' : 'Enable'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Audit Trail of Risk Rule Revisions</span>
              </h3>
              <p className="text-xs text-slate-500">
                Immutable record of every threshold change, who authorized it, and the mandatory business rationale.
              </p>

              <div className="space-y-3 pt-2">
                {history.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">
                    No revisions recorded yet. Default policy is active.
                  </p>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800/70 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.reason || 'Rule parameters updated'}
                        </span>
                        <span className="text-slate-400">
                          {new Date(item.createdAt).toLocaleString('en-GB')}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/50 overflow-x-auto">
                        Min Orders: {item.rulesSnapshot?.minEligibleOrders ?? 'N/A'} · Cancel Threshold: {item.rulesSnapshot?.cancellationThresholdPercent ?? 'N/A'}% · Return Threshold: {item.rulesSnapshot?.returnThresholdPercent ?? 'N/A'}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* SAVE RULES MODAL (Requires Reason) */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121826] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="w-4 h-4 text-blue-600" />
              <span>Confirm Rule Revision</span>
            </h3>
            <p className="text-xs text-slate-500">
              Per compliance requirements, state the business rationale for updating the fraud & risk policy.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Tightened return threshold due to high festival order rush"
              value={saveReason}
              onChange={(e) => setSaveReason(e.target.value)}
              className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRules}
                disabled={saving || !saveReason.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD BLACKLIST MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121826] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Add Customer to Risk List</span>
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBlacklist} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Customer Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="01712345678 or +8801712345678"
                    value={newPhone}
                    onChange={(e) => handlePhoneInputChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>
                {phoneValidation && (
                  <p
                    className={`text-[11px] mt-1 font-medium ${
                      phoneValidation.isValid ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  >
                    {phoneValidation.isValid
                      ? `Valid BD Phone: ${phoneValidation.normalized}`
                      : 'Invalid Bangladesh mobile number'}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Classification Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewType('blacklist')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      newType === 'blacklist'
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 text-rose-700 dark:text-rose-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <ShieldX className="w-4 h-4" />
                    <span>Blacklist (Block)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewType('watchlist')}
                    className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                      newType === 'watchlist'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 text-amber-700 dark:text-amber-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Watchlist (Warn)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for Action
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Cancelled 3 orders at doorstep; courier delivery charge wasted."
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !phoneValidation?.isValid}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
                >
                  {saving ? 'Adding...' : 'Add to List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
