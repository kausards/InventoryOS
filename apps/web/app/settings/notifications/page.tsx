'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  Bell,
  MessageSquare,
  Smartphone,
  Coins,
  History,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Plus,
  ArrowUpRight,
  ShieldAlert,
  Send,
  Languages,
  Sliders,
  RotateCcw,
} from 'lucide-react';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'credits' | 'logs' | 'templates' | 'consent_providers'>('credits');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Credits state
  const [creditsSummary, setCreditsSummary] = useState({ smsBalance: 0, whatsappBalance: 0, totalBalance: 0 });
  const [creditLedger, setCreditLedger] = useState<any[]>([]);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);
  const [topUpChannel, setTopUpChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [topUpAmount, setTopUpAmount] = useState<number>(500);
  const [topUpSubmitting, setTopUpSubmitting] = useState(false);

  // Delivery logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [logFilterChannel, setLogFilterChannel] = useState('');
  const [logFilterStatus, setLogFilterStatus] = useState('');
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [templateContent, setTemplateContent] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Consents & Provider state
  const [consents, setConsents] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any>({
    smsProvider: 'elitbuzz',
    smsApiKey: '',
    smsSenderId: '',
    whatsappProvider: 'meta_cloud',
    whatsappApiToken: '',
    whatsappPhoneNumberId: '',
    channelSmsEnabled: true,
    channelWhatsappEnabled: true,
  });
  const [savingPreferences, setSavingPreferences] = useState(false);

  // Opt-out manual modal
  const [isOptOutModalOpen, setIsOptOutModalOpen] = useState(false);
  const [optOutPhone, setOptOutPhone] = useState('');
  const [optOutChannel, setOptOutChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [optOutReason, setOptOutReason] = useState('Customer request');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [creditsRes, logsRes, templatesRes, consentsRes, prefsRes] = await Promise.all([
        api.get('/notifications/credits').catch(() => ({ summary: { smsBalance: 1250, whatsappBalance: 800, totalBalance: 2050 }, ledger: [] })),
        api.get(`/notifications?channel=${logFilterChannel}&status=${logFilterStatus}`).catch(() => ({ items: [] })),
        api.get('/notifications/templates').catch(() => []),
        api.get('/notifications/consents').catch(() => []),
        api.get('/notifications/preferences').catch(() => ({})),
      ]);

      if (creditsRes?.summary) setCreditsSummary(creditsRes.summary);
      if (creditsRes?.ledger) setCreditLedger(creditsRes.ledger);
      if (logsRes?.items) setLogs(logsRes.items);
      if (Array.isArray(templatesRes)) setTemplates(templatesRes);
      if (Array.isArray(consentsRes)) setConsents(consentsRes);
      if (prefsRes?.id) setPreferences(prefsRes);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to load notifications data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [logFilterChannel, logFilterStatus]);

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setTopUpSubmitting(true);
      await api.post('/notifications/credits/topup', {
        channel: topUpChannel,
        amount: Number(topUpAmount),
        description: `Manual balance top-up (${topUpAmount} credits)`,
      });
      setNotification({ message: `${topUpAmount} ${topUpChannel.toUpperCase()} credits added successfully!`, type: 'success' });
      setIsTopUpModalOpen(false);
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Top-up failed', type: 'error' });
    } finally {
      setTopUpSubmitting(false);
    }
  };

  const handleRetry = async (notificationId: string) => {
    try {
      setRetryingId(notificationId);
      const res = await api.post(`/notifications/${notificationId}/retry`);
      if (res.success) {
        setNotification({ message: 'Notification resent successfully!', type: 'success' });
      } else {
        setNotification({ message: res.message || 'Retry failed', type: 'error' });
      }
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Retry request failed', type: 'error' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    try {
      setSavingTemplate(true);
      await api.put(`/notifications/templates/${editingTemplate.id}`, {
        content: templateContent,
      });
      setNotification({ message: 'Template updated successfully!', type: 'success' });
      setEditingTemplate(null);
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to save template', type: 'error' });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingPreferences(true);
      await api.put('/notifications/preferences', preferences);
      setNotification({ message: 'Gateway settings saved successfully!', type: 'success' });
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to save settings', type: 'error' });
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleRecordOptOut = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/notifications/consents', {
        phone: optOutPhone.trim(),
        channel: optOutChannel,
        consentStatus: 'opted_out',
        optOutReason: optOutReason.trim(),
      });
      setNotification({ message: `Number ${optOutPhone} has been marked as opted out.`, type: 'success' });
      setIsOptOutModalOpen(false);
      setOptOutPhone('');
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to record opt-out', type: 'error' });
    }
  };

  const handleRemoveOptOut = async (phone: string, channel: 'sms' | 'whatsapp') => {
    try {
      await api.post('/notifications/consents', {
        phone,
        channel,
        consentStatus: 'opted_in',
      });
      setNotification({ message: `Opt-out restriction removed for ${phone}.`, type: 'success' });
      fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to update consent', type: 'error' });
    }
  };

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

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-1">
                <span>Settings</span>
                <span>/</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">Notifications & Messages</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Bell className="w-6 h-6 text-amber-500" />
                Notifications & Messaging Hub
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Manage message credits, delivery logs, templates, and customer consent.
              </p>
            </div>

            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Top-Up Message Credits</span>
            </button>
          </div>

          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('credits')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'credits'
                  ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Credits & Ledger</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'logs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Delivery Status Logs</span>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'templates'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Languages className="w-4 h-4" />
              <span>Templates</span>
            </button>
            <button
              onClick={() => setActiveTab('consent_providers')}
              className={`pb-3 px-3 flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'consent_providers'
                  ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Customer Consent & Gateways</span>
            </button>
          </div>

          {/* TAB 1: CREDITS & LEDGER */}
          {activeTab === 'credits' && (
            <div className="space-y-6">
              {/* Balances Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SMS Balance</span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {creditsSummary.smsBalance.toLocaleString('en-US')} Credits
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp Balance</span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {creditsSummary.whatsappBalance.toLocaleString('en-US')} Credits
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600">
                    <Coins className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Active Credits</span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {creditsSummary.totalBalance.toLocaleString('en-US')} Credits
                    </div>
                  </div>
                </div>
              </div>

              {/* Running Ledger Table */}
              <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Message Credit Ledger</h2>
                  <span className="text-xs text-slate-400">Append-only audit trail</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/60 dark:bg-slate-900/40">
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Channel</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Credits</th>
                        <th className="py-3 px-4">Balance After</th>
                        <th className="py-3 px-4">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-600" />
                            <span>Loading ledger...</span>
                          </td>
                        </tr>
                      ) : creditLedger.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No ledger transactions recorded yet. Click &quot;Top-Up Message Credits&quot; to begin.
                          </td>
                        </tr>
                      ) : (
                        creditLedger.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(row.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="py-3 px-4 font-bold uppercase text-[11px]">
                              <span
                                className={`px-2 py-0.5 rounded-full ${
                                  row.channel === 'sms'
                                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                                }`}
                              >
                                {row.channel}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold capitalize text-slate-700 dark:text-slate-300">
                              {row.type}
                            </td>
                            <td
                              className={`py-3 px-4 font-black ${
                                row.amount > 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {row.amount > 0 ? `+${row.amount}` : row.amount}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                              {row.balanceAfter}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                              {row.description}
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

          {/* TAB 2: DELIVERY LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-3">
                <select
                  value={logFilterChannel}
                  onChange={(e) => setLogFilterChannel(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Channels</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="in_app">In-App</option>
                </select>

                <select
                  value={logFilterStatus}
                  onChange={(e) => setLogFilterStatus(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">All Statuses</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="credit_exhausted">Credit Exhausted</option>
                  <option value="opted_out">Opted Out</option>
                </select>

                <button
                  onClick={() => fetchData()}
                  className="ml-auto px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Delivery Logs Table */}
              <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800/80 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/60 dark:bg-slate-900/40">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Channel</th>
                        <th className="py-3 px-4">Recipient</th>
                        <th className="py-3 px-4">Message Preview</th>
                        <th className="py-3 px-4">Credits</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            Loading logs...
                          </td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            No message delivery logs found.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="py-3 px-4 font-bold uppercase text-[11px]">
                              {log.channel}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                              {log.recipient}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-sm truncate">
                              {log.content}
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              {log.creditsDeducted}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  log.status === 'sent' || log.status === 'delivered'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                    : log.status === 'opted_out'
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    : log.status === 'credit_exhausted'
                                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {log.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {(log.status === 'failed' || log.status === 'credit_exhausted') && (
                                <button
                                  onClick={() => handleRetry(log.id)}
                                  disabled={retryingId === log.id}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 hover:bg-blue-100 transition-colors inline-flex items-center gap-1"
                                >
                                  {retryingId === log.id && <RefreshCw className="w-3 h-3 animate-spin" />}
                                  <span>Retry</span>
                                </button>
                              )}
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

          {/* TAB 3: TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {t.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {t.channel}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-950/40 text-blue-600">
                            {t.language}
                          </span>
                        </div>
                      </div>
                      <p className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs font-sans text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {t.content}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-slate-400 font-mono">
                        Event: {t.triggerEvent}
                      </span>
                      <button
                        onClick={() => {
                          setEditingTemplate(t);
                          setTemplateContent(t.content);
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: CONSENT & PROVIDERS */}
          {activeTab === 'consent_providers' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Customer Consent & Opt-Out Registry */}
              <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      Customer Consent & Opt-Out Registry
                    </h2>
                    <p className="text-xs text-slate-500">Opted-out customers are automatically blocked from receiving automated messages.</p>
                  </div>
                  <button
                    onClick={() => setIsOptOutModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Opt-out</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {consents.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No customer opt-outs registered. All active customers will receive notifications.
                    </div>
                  ) : (
                    consents.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white">{c.phone}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {c.channel}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                c.consentStatus === 'opted_out' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                              }`}
                            >
                              {c.consentStatus}
                            </span>
                          </div>
                          {c.optOutReason && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">{c.optOutReason}</span>
                          )}
                        </div>

                        {c.consentStatus === 'opted_out' && (
                          <button
                            onClick={() => handleRemoveOptOut(c.phone, c.channel)}
                            className="text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Unblock
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Gateway Configuration */}
              <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    SMS & WhatsApp Gateway Settings
                  </h2>
                  <p className="text-xs text-slate-500">Configure ElitBuzz / Greenweb SMS and WhatsApp credentials.</p>
                </div>

                <form onSubmit={handleSavePreferences} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      SMS Provider
                    </label>
                    <select
                      value={preferences.smsProvider}
                      onChange={(e) => setPreferences({ ...preferences, smsProvider: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="elitbuzz">ElitBuzz SMS Gateway</option>
                      <option value="greenweb">Greenweb BD</option>
                      <option value="mock">Sandbox / Test Mode</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        SMS API Key
                      </label>
                      <input
                        type="password"
                        value={preferences.smsApiKey || ''}
                        onChange={(e) => setPreferences({ ...preferences, smsApiKey: e.target.value })}
                        placeholder="e.g. key_12345"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        SMS Sender ID / Masking
                      </label>
                      <input
                        type="text"
                        value={preferences.smsSenderId || ''}
                        onChange={(e) => setPreferences({ ...preferences, smsSenderId: e.target.value })}
                        placeholder="e.g. 8809612000000"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      WhatsApp Gateway Provider
                    </label>
                    <select
                      value={preferences.whatsappProvider}
                      onChange={(e) => setPreferences({ ...preferences, whatsappProvider: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="meta_cloud">Meta Cloud API (Official)</option>
                      <option value="twilio">Twilio WhatsApp</option>
                      <option value="mock">Sandbox / Test Mode</option>
                    </select>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingPreferences}
                      className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-2"
                    >
                      {savingPreferences && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Save Gateway Settings</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Top-up Modal */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Top-Up Message Credits</h3>
                  <p className="text-xs text-slate-500">Refill your SMS or WhatsApp balance</p>
                </div>
              </div>
              <button onClick={() => setIsTopUpModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopUp} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Channel
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTopUpChannel('sms')}
                    className={`p-3 rounded-xl border text-center font-bold transition-all ${
                      topUpChannel === 'sms'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    SMS (1 Credit/Segment)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopUpChannel('whatsapp')}
                    className={`p-3 rounded-xl border text-center font-bold transition-all ${
                      topUpChannel === 'whatsapp'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    WhatsApp (2 Credits/Msg)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Credits Amount
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(amt)}
                      className={`py-2 rounded-xl border font-bold text-xs ${
                        topUpAmount === amt
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {amt} Credits
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="10"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topUpSubmitting}
                  className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-2"
                >
                  {topUpSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Top-Up</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Edit Template — {editingTemplate.name}
              </h3>
              <button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Message Content
                </label>
                <textarea
                  rows={5}
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-sans focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Variables</span>
                <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                  &#123;&#123;customer_name&#125;&#125;, &#123;&#123;order_number&#125;&#125;, &#123;&#123;total_amount&#125;&#125;, &#123;&#123;tracking_code&#125;&#125;, &#123;&#123;courier_name&#125;&#125;
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                >
                  {savingTemplate ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Add Opt-Out Modal */}
      {isOptOutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Register Customer Opt-Out
              </h3>
              <button onClick={() => setIsOptOutModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordOptOut} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 01711000000"
                  value={optOutPhone}
                  onChange={(e) => setOptOutPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Channel
                </label>
                <select
                  value={optOutChannel}
                  onChange={(e) => setOptOutChannel(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Opt-Out
                </label>
                <input
                  type="text"
                  value={optOutReason}
                  onChange={(e) => setOptOutReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOptOutModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all"
                >
                  Block Number
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
