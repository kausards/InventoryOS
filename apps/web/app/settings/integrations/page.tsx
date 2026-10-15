'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Shield,
  Layers,
  ArrowRight,
  ExternalLink,
  Lock,
  Trash2,
  Calendar,
  Search,
  Check,
  X,
  Activity,
  Zap,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Store {
  id: string;
  storeName: string;
  storeUrl: string;
  platform: string;
  isActive: boolean;
  syncOrders: boolean;
  pushStock: boolean;
  lastOrderSyncedAt: string | null;
  lastStockPushedAt: string | null;
  healthStatus: 'healthy' | 'warning' | 'error' | 'disconnected';
  healthMessage: string | null;
  credentials?: {
    consumerKey: string;
    consumerSecret: string;
    webhookSecret?: string;
  };
  stats?: {
    totalMappings: number;
    mappedCount: number;
    unmappedCount: number;
  };
}

interface ProductMapping {
  id: string;
  externalProductId: string;
  externalVariantId: string;
  externalSku: string | null;
  externalName: string;
  externalPriceMinor: string;
  externalStockQuantity: number | null;
  internalVariantId: string | null;
  mappingStatus: 'mapped' | 'unmapped' | 'ignored';
  internalVariantTitle?: string;
  internalVariantSku?: string;
  productTitle?: string;
}

interface InternalVariant {
  id: string;
  title: string;
  sku: string;
  productTitle: string;
}

export default function IntegrationsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stores' | 'mappings' | 'events'>('stores');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  // Modals state
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);
  const [storeToDisconnect, setStoreToDisconnect] = useState<Store | null>(null);

  // Form states
  const [connectForm, setConnectForm] = useState({
    storeName: '',
    storeUrl: '',
    consumerKey: '',
    consumerSecret: '',
    syncOrders: true,
    pushStock: true,
  });
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Reconcile states
  const [reconcileDays, setReconcileDays] = useState(7);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any | null>(null);

  // Mappings state
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [mappingSearch, setMappingSearch] = useState('');
  const [mappingFilter, setMappingFilter] = useState('all');
  const [internalVariants, setInternalVariants] = useState<InternalVariant[]>([]);

  // Action status
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchStores();
    fetchInternalVariants();
  }, []);

  useEffect(() => {
    if (selectedStoreId && activeTab === 'mappings') {
      fetchMappings(selectedStoreId);
    }
  }, [selectedStoreId, activeTab, mappingFilter]);

  const fetchStores = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Store[]>('/integrations/stores');
      setStores(data || []);
      if (data && data.length > 0 && !selectedStoreId) {
        setSelectedStoreId(data[0]!.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch integration stores');
    } finally {
      setLoading(false);
    }
  };

  const fetchInternalVariants = async () => {
    try {
      const res = await apiFetch<any>('/products?limit=100');
      const vars: InternalVariant[] = [];
      if (res && res.items) {
        for (const p of res.items) {
          if (p.variants) {
            for (const v of p.variants) {
              vars.push({
                id: v.id,
                title: v.title,
                sku: v.sku || '',
                productTitle: p.title,
              });
            }
          }
        }
      }
      setInternalVariants(vars);
    } catch {
      // non-critical
    }
  };

  const fetchMappings = async (storeId: string) => {
    setMappingsLoading(true);
    try {
      const params = new URLSearchParams();
      if (mappingFilter !== 'all') params.set('status', mappingFilter);
      const res = await apiFetch<any>(`/integrations/stores/${storeId}/mappings?${params.toString()}`);
      setMappings(res?.items || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setMappingsLoading(false);
    }
  };

  const handleConnectStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectLoading(true);
    setConnectError(null);

    try {
      await apiFetch('/integrations/stores', {
        method: 'POST',
        body: JSON.stringify(connectForm),
      });

      setIsConnectModalOpen(false);
      setConnectForm({
        storeName: '',
        storeUrl: '',
        consumerKey: '',
        consumerSecret: '',
        syncOrders: true,
        pushStock: true,
      });
      setActionSuccess('WooCommerce Store connected and verified successfully!');
      fetchStores();
    } catch (err: any) {
      setConnectError(err.message || 'Failed to connect store');
    } finally {
      setConnectLoading(false);
    }
  };

  const handleTestConnection = async (storeId: string) => {
    try {
      const res = await apiFetch<any>(`/integrations/stores/${storeId}/test`, {
        method: 'POST',
      });
      if (res.success) {
        setActionSuccess(`Connection test passed: ${res.message}`);
      } else {
        setError(`Connection test failed: ${res.message}`);
      }
      fetchStores();
    } catch (err: any) {
      setError(err.message || 'Connection test error');
    }
  };

  const handleSyncProducts = async (storeId: string) => {
    setSyncingProducts(true);
    setError(null);
    try {
      const res = await apiFetch<any>(`/integrations/stores/${storeId}/sync-products`, {
        method: 'POST',
      });
      setActionSuccess(
        `Synced ${res.totalFetched} products (${res.createdCount} new, ${res.autoMappedCount} auto-mapped by SKU)`
      );
      fetchStores();
      if (selectedStoreId === storeId) {
        fetchMappings(storeId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync products');
    } finally {
      setSyncingProducts(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedStoreId) return;
    setReconcileLoading(true);
    try {
      const res = await apiFetch<any>(
        `/integrations/stores/${selectedStoreId}/reconcile?days=${reconcileDays}`,
        { method: 'POST' }
      );
      setReconcileResult(res);
      setActionSuccess(
        `Reconciled ${res.totalChecked} orders (${res.recoveredCount} missed orders recovered)`
      );
      fetchStores();
    } catch (err: any) {
      setError(err.message || 'Reconciliation failed');
    } finally {
      setReconcileLoading(false);
    }
  };

  const handleMapVariant = async (mappingId: string, internalVariantId: string | null) => {
    if (!selectedStoreId) return;
    try {
      await apiFetch(`/integrations/stores/${selectedStoreId}/mappings/${mappingId}`, {
        method: 'PUT',
        body: JSON.stringify({
          internalVariantId,
          mappingStatus: internalVariantId ? 'mapped' : 'unmapped',
        }),
      });
      fetchMappings(selectedStoreId);
      fetchStores();
    } catch (err: any) {
      setError(err.message || 'Failed to update mapping');
    }
  };

  const handleDisconnect = async () => {
    if (!storeToDisconnect) return;
    try {
      await apiFetch(`/integrations/stores/${storeToDisconnect.id}/disconnect`, {
        method: 'POST',
      });
      setIsDisconnectModalOpen(false);
      setStoreToDisconnect(null);
      setActionSuccess('Store disconnected. Historical orders and records preserved.');
      fetchStores();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect store');
    }
  };

  const filteredMappings = mappings.filter((m) => {
    if (!mappingSearch.trim()) return true;
    const q = mappingSearch.toLowerCase();
    return (
      m.externalName.toLowerCase().includes(q) ||
      (m.externalSku && m.externalSku.toLowerCase().includes(q)) ||
      (m.productTitle && m.productTitle.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            WooCommerce Store Integrations
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Connect WooCommerce stores, map product variants, and sync orders in real time.
          </p>
        </div>

        <button
          onClick={() => {
            setConnectError(null);
            setIsConnectModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Connect Store</span>
        </button>
      </div>

      {/* Success / Error Alerts */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-emerald-800 dark:text-emerald-200 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-xs underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-rose-800 dark:text-rose-200 text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-6">
        <button
          onClick={() => setActiveTab('stores')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'stores'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Connected Stores ({stores.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('mappings')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'mappings'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Product & Variant Mappings</span>
        </button>
      </div>

      {/* TAB 1: CONNECTED STORES */}
      {activeTab === 'stores' && (
        <div className="space-y-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading connected stores...</div>
          ) : stores.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
              <Globe className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                No WooCommerce Stores Connected
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Connect your first WooCommerce website to start syncing customer orders and pushing live inventory stock.
              </p>
              <button
                onClick={() => setIsConnectModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect Store Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className={`p-6 rounded-2xl border transition-all ${
                    store.isActive
                      ? 'bg-white dark:bg-[#121826] border-slate-200/80 dark:border-slate-800/80 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                        W
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          {store.storeName}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              store.healthStatus === 'healthy'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : store.healthStatus === 'disconnected'
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}
                          >
                            {store.healthStatus}
                          </span>
                        </h3>
                        <a
                          href={store.storeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          {store.storeUrl}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleTestConnection(store.id)}
                        title="Test Live Connection"
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setStoreToDisconnect(store);
                          setIsDisconnectModalOpen(true);
                        }}
                        title="Disconnect Store"
                        className="p-2 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Credentials & Security Preview */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 mb-4 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        Consumer Key:
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {store.credentials?.consumerKey || 'ck_...****'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        Consumer Secret:
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {store.credentials?.consumerSecret || 'cs_...****'}
                      </span>
                    </div>
                  </div>

                  {/* Mapping Stats Row */}
                  <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-slate-100 dark:border-slate-800/60 text-xs mb-4">
                    <div>
                      <span className="block text-slate-400 text-[11px]">Total Synced</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-bold">
                        {store.stats?.totalMappings || 0}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[11px]">Mapped</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {store.stats?.mappedCount || 0}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-slate-400 text-[11px]">Unmapped</span>
                      <strong className="text-amber-600 dark:text-amber-400 font-bold">
                        {store.stats?.unmappedCount || 0}
                      </strong>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      onClick={() => handleSyncProducts(store.id)}
                      disabled={syncingProducts}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${syncingProducts ? 'animate-spin' : ''}`} />
                      <span>Sync Products</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setReconcileResult(null);
                        setIsReconcileModalOpen(true);
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Reconcile Orders</span>
                    </button>

                    <button
                      onClick={() => {
                        setSelectedStoreId(store.id);
                        setActiveTab('mappings');
                      }}
                      className="py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Mappings</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRODUCT MAPPINGS */}
      {activeTab === 'mappings' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Store:</span>
                <select
                  value={selectedStoreId || ''}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.storeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1">
                {['all', 'mapped', 'unmapped', 'ignored'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setMappingFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      mappingFilter === status
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search external or internal SKU/title..."
                value={mappingSearch}
                onChange={(e) => setMappingSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {mappingsLoading ? (
            <div className="p-12 text-center text-slate-400">Loading mappings...</div>
          ) : filteredMappings.length === 0 ? (
            <div className="p-12 text-center text-slate-400 rounded-2xl border border-slate-200 dark:border-slate-800">
              No product mappings found matching current filter.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#121826] overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold">
                    <th className="p-3.5">WooCommerce Product / Variation</th>
                    <th className="p-3.5">External SKU</th>
                    <th className="p-3.5">External Price</th>
                    <th className="p-3.5">WC Stock</th>
                    <th className="p-3.5">Internal Inventory Variant</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredMappings.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="p-3.5 font-medium text-slate-900 dark:text-white">
                        {m.externalName}
                        <span className="block text-[10px] text-slate-400 font-mono">
                          ID: #{m.externalProductId} {m.externalVariantId ? `(Var: #${m.externalVariantId})` : ''}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {m.externalSku || '—'}
                      </td>
                      <td className="p-3.5 font-medium text-slate-700 dark:text-slate-300">
                        ৳{(Number(m.externalPriceMinor) / 100).toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {m.externalStockQuantity ?? 'N/A'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <select
                          value={m.internalVariantId || ''}
                          onChange={(e) => handleMapVariant(m.id, e.target.value || null)}
                          className="w-64 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-white"
                        >
                          <option value="">— Unmapped (Select Variant) —</option>
                          {internalVariants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.productTitle} — {v.title} ({v.sku || 'No SKU'})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            m.mappingStatus === 'mapped'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : m.mappingStatus === 'ignored'
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {m.mappingStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONNECT STORE MODAL */}
      {isConnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Connect WooCommerce Store
                </h3>
              </div>
              <button
                onClick={() => setIsConnectModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {connectError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200">
                {connectError}
              </div>
            )}

            <form onSubmit={handleConnectStore} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Store Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My WordPress Shop"
                  value={connectForm.storeName}
                  onChange={(e) => setConnectForm({ ...connectForm, storeName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Store Website URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://yourstore.com.bd"
                  value={connectForm.storeUrl}
                  onChange={(e) => setConnectForm({ ...connectForm, storeUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Consumer Key (ck_...)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="ck_xxxxxxxxxxxx"
                    value={connectForm.consumerKey}
                    onChange={(e) => setConnectForm({ ...connectForm, consumerKey: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Consumer Secret (cs_...)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="cs_xxxxxxxxxxxx"
                    value={connectForm.consumerSecret}
                    onChange={(e) => setConnectForm({ ...connectForm, consumerSecret: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={connectForm.syncOrders}
                    onChange={(e) => setConnectForm({ ...connectForm, syncOrders: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Automatically import and synchronize new orders</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={connectForm.pushStock}
                    onChange={(e) => setConnectForm({ ...connectForm, pushStock: e.target.checked })}
                    className="rounded text-blue-600"
                  />
                  <span>Push internal stock changes to WooCommerce website</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConnectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectLoading}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  {connectLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Verify & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECONCILE MODAL */}
      {isReconcileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Reconcile Orders
              </h3>
              <button
                onClick={() => setIsReconcileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Scans WooCommerce for any orders created or updated in the date window that may have been missed by webhooks.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Scan Window (Days):
              </label>
              <select
                value={reconcileDays}
                onChange={(e) => setReconcileDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold"
              >
                <option value={3}>Last 3 Days</option>
                <option value={7}>Last 7 Days (Recommended)</option>
                <option value={14}>Last 14 Days</option>
                <option value={30}>Last 30 Days</option>
              </select>
            </div>

            {reconcileResult && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
                <div>Total Checked: {reconcileResult.totalChecked}</div>
                <div className="text-emerald-700 dark:text-emerald-300 font-bold">
                  Recovered Missed Orders: {reconcileResult.recoveredCount}
                </div>
                <div>Already In Sync: {reconcileResult.alreadySyncedCount}</div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                onClick={() => setIsReconcileModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
              >
                Close
              </button>
              <button
                onClick={handleReconcile}
                disabled={reconcileLoading}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2"
              >
                {reconcileLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Start Reconciliation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DISCONNECT CONFIRMATION MODAL */}
      {isDisconnectModalOpen && storeToDisconnect && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              Disconnect Store?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to disconnect <strong>{storeToDisconnect.storeName}</strong>?
              Live order webhooks and stock pushes will cease. Historical orders, shipments, and financial records will remain completely intact.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsDisconnectModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
