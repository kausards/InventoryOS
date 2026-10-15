'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  Truck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  ExternalLink,
  Wallet,
  Settings2,
  Eye,
  EyeOff,
  Copy,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface MaskedCourierAccount {
  id: string;
  courierCode: 'steadfast' | 'pathao' | 'redx';
  accountName: string;
  senderName?: string | null;
  senderPhone?: string | null;
  senderAddress?: string | null;
  isActive: boolean;
  isDefault: boolean;
  testMode: boolean;
  lastConnectionTestAt?: string | null;
  lastConnectionStatus?: string | null;
  maskedCredentials: {
    apiKey: string;
    secretKey: string;
  };
  createdAt: string;
}

export default function CourierSettingsPage() {
  const [accounts, setAccounts] = useState<MaskedCourierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [testingAccountId, setTestingAccountId] = useState<string | null>(null);
  const [accountBalance, setAccountBalance] = useState<{ [id: string]: number }>({});
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [formCourierCode, setFormCourierCode] = useState<'steadfast' | 'pathao' | 'redx'>('steadfast');
  const [formAccountName, setFormAccountName] = useState('Steadfast Main');
  const [formApiKey, setFormApiKey] = useState('');
  const [formSecretKey, setFormSecretKey] = useState('');
  const [formSenderName, setFormSenderName] = useState('');
  const [formSenderPhone, setFormSenderPhone] = useState('');
  const [formSenderAddress, setFormSenderAddress] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(true);
  const [formTestMode, setFormTestMode] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/couriers/accounts');
      setAccounts(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to load courier accounts', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formApiKey.trim() || !formSecretKey.trim()) {
      setNotification({ message: 'API Key and Secret Key are required', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      await api.post('/couriers/accounts', {
        courierCode: formCourierCode,
        accountName: formAccountName.trim(),
        apiKey: formApiKey.trim(),
        secretKey: formSecretKey.trim(),
        senderName: formSenderName.trim() || undefined,
        senderPhone: formSenderPhone.trim() || undefined,
        senderAddress: formSenderAddress.trim() || undefined,
        isDefault: formIsDefault,
        testMode: formTestMode,
      });

      setNotification({ message: 'Courier account connected successfully!', type: 'success' });
      setIsAddModalOpen(false);
      setFormApiKey('');
      setFormSecretKey('');
      fetchAccounts();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to save courier account', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      setTestingAccountId(id);
      const res = await api.post(`/couriers/accounts/${id}/test`);
      if (res.success) {
        setNotification({
          message: `Connection successful! ${res.balance !== undefined ? `Steadfast Balance: ৳${res.balance.toLocaleString('en-US')}` : ''}`,
          type: 'success',
        });
        if (res.balance !== undefined) {
          setAccountBalance((prev) => ({ ...prev, [id]: res.balance }));
        }
      } else {
        setNotification({ message: res.message || 'Connection test failed', type: 'error' });
      }
      fetchAccounts();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to test connection', type: 'error' });
    } finally {
      setTestingAccountId(null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans antialiased">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Notification Alert */}
          {notification && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${
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
                <Link href="/settings/roles" className="hover:text-blue-600">Settings</Link>
                <span>/</span>
                <span className="text-slate-800 dark:text-slate-200 font-semibold">Courier Integration</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Truck className="w-7 h-7 text-blue-600" />
                Courier Gateway & Accounts
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Configure official Steadfast courier credentials, test live connection, and automate COD tracking.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/finances/settlements"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>COD Settlements</span>
              </Link>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Courier</span>
              </button>
            </div>
          </div>

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {loading ? (
              <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                <span className="text-xs font-medium">Loading courier integrations...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mx-auto">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No courier accounts connected</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Connect your Steadfast Courier merchant account to start sending orders, tracking parcels, and auto-settling COD.
                  </p>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Connect Steadfast BD</span>
                </button>
              </div>
            ) : (
              accounts.map((account) => {
                const isTesting = testingAccountId === account.id;
                const balance = accountBalance[account.id];

                return (
                  <div
                    key={account.id}
                    className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 font-black flex items-center justify-center text-sm border border-orange-500/20">
                            SF
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                {account.accountName}
                              </h3>
                              {account.isDefault && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                  Default
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                              {account.courierCode} Courier BD
                            </span>
                          </div>
                        </div>

                        {/* Connection Status Badge */}
                        <div>
                          {account.lastConnectionStatus === 'connected' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : account.lastConnectionStatus === 'failed' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Auth Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Untested
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Credentials Masked Preview */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-100 dark:border-slate-800/60 space-y-2 mb-4 font-mono text-[11px]">
                        <div className="flex items-center justify-between text-slate-500">
                          <span>API Key</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold tracking-widest">
                            {account.maskedCredentials.apiKey}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-500">
                          <span>Secret Key</span>
                          <span className="text-slate-700 dark:text-slate-300 font-semibold tracking-widest">
                            {account.maskedCredentials.secretKey}
                          </span>
                        </div>
                      </div>

                      {/* Live Balance if fetched */}
                      {balance !== undefined && (
                        <div className="p-3 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
                          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Steadfast Wallet</span>
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                            ৳{balance.toLocaleString('en-US')}
                          </span>
                        </div>
                      )}

                      {/* Sender Info */}
                      {(account.senderName || account.senderPhone) && (
                        <div className="text-[11px] text-slate-500 space-y-1 mb-4">
                          {account.senderName && (
                            <div>
                              <span className="text-slate-400">Sender:</span> <span className="font-semibold text-slate-700 dark:text-slate-300">{account.senderName}</span>
                            </div>
                          )}
                          {account.senderPhone && (
                            <div>
                              <span className="text-slate-400">Phone:</span> <span className="font-mono text-slate-700 dark:text-slate-300">{account.senderPhone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions Bottom Bar */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleTestConnection(account.id)}
                        disabled={isTesting}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-blue-600' : ''}`} />
                        <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                      </button>

                      <a
                        href="https://portal.steadfast.com.bd"
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Open Steadfast Merchant Portal"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Add Courier Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Connect Steadfast Courier</h3>
                  <p className="text-xs text-slate-500">Enter your merchant API credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Courier Provider
                </label>
                <select
                  value={formCourierCode}
                  onChange={(e: any) => setFormCourierCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="steadfast">Steadfast Courier (API v1)</option>
                  <option value="pathao" disabled>Pathao Courier (Coming in M7)</option>
                  <option value="redx" disabled>RedX Logistics (Coming in M7)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name / Label
                </label>
                <input
                  type="text"
                  required
                  value={formAccountName}
                  onChange={(e) => setFormAccountName(e.target.value)}
                  placeholder="e.g. Steadfast Main Branch"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>API Key</span>
                    <button
                      type="button"
                      onClick={() => setShowSecrets(!showSecrets)}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      {showSecrets ? 'Hide' : 'Show'}
                    </button>
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    required
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    placeholder="Steadfast API Key"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Secret Key
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    required
                    value={formSecretKey}
                    onChange={(e) => setFormSecretKey(e.target.value)}
                    placeholder="Steadfast Secret Key"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Sender Details (Optional) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Pickup / Sender Information (Optional)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formSenderName}
                    onChange={(e) => setFormSenderName(e.target.value)}
                    placeholder="Sender Name"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  />
                  <input
                    type="text"
                    value={formSenderPhone}
                    onChange={(e) => setFormSenderPhone(e.target.value)}
                    placeholder="Sender Phone (017...)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <input
                  type="text"
                  value={formSenderAddress}
                  onChange={(e) => setFormSenderAddress(e.target.value)}
                  placeholder="Pickup Street Address"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formIsDefault}
                    onChange={(e) => setFormIsDefault(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Set as default courier</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={formTestMode}
                    onChange={(e) => setFormTestMode(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span>Sandbox / Test Mode</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Integration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
