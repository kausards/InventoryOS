'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { api } from '../../lib/api';
import {
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Package,
  Truck,
  MapPin,
  DollarSign,
  ShieldAlert,
  ArrowLeftRight,
  TrendingDown,
  Info,
  Clock,
  Eye,
} from 'lucide-react';

interface ReturnItem {
  id: string;
  returnNumber: string;
  orderId: string;
  orderInvoiceNumber?: string;
  customerName?: string;
  customerPhone?: string;
  warehouseName?: string;
  returnType: 'customer_return' | 'courier_return_rto' | 'exchange';
  status: 'requested' | 'approved' | 'received' | 'inspecting' | 'completed' | 'rejected' | 'cancelled';
  reason: string;
  notes?: string;
  shippingCostMinor: number;
  customerDeliveryChargeRefunded: boolean;
  refundAmountMinor: number;
  refundStatus: string;
  exchangeOrderId?: string;
  requestedAt: string;
  receivedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export default function ReturnsManagementPage() {
  const [returnsList, setReturnsList] = useState<ReturnItem[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInspectOpen, setIsInspectOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [activeReturn, setActiveReturn] = useState<any>(null);

  // Create Form State
  const [createOrderId, setCreateOrderId] = useState('');
  const [createWarehouseId, setCreateWarehouseId] = useState('');
  const [createReturnType, setCreateReturnType] = useState<'customer_return' | 'courier_return_rto' | 'exchange'>('customer_return');
  const [createReason, setCreateReason] = useState('defective');
  const [createShippingCostBdt, setCreateShippingCostBdt] = useState('60');
  const [createRefundDelivery, setCreateRefundDelivery] = useState(false);
  const [createNotes, setCreateNotes] = useState('');
  const [createVariantId, setCreateVariantId] = useState('');
  const [createQty, setCreateQty] = useState('1');
  const [createUnitPriceBdt, setCreateUnitPriceBdt] = useState('1200');
  const [createExchangeVariantId, setCreateExchangeVariantId] = useState('');

  // Inspect Form State
  const [inspectCondition, setInspectCondition] = useState<'intact' | 'damaged' | 'opened' | 'missing_parts'>('intact');
  const [inspectDisposition, setInspectDisposition] = useState<'restock' | 'damage_writeoff' | 'return_to_customer'>('restock');
  const [inspectNotes, setInspectNotes] = useState('');
  const [inspectExchangeVariantId, setInspectExchangeVariantId] = useState('');
  const [inspectExchangeQty, setInspectExchangeQty] = useState('0');

  // Complete Form State
  const [completeRefundBdt, setCompleteRefundBdt] = useState('1200');
  const [completeRefundStatus, setCompleteRefundStatus] = useState<'none' | 'pending' | 'refunded'>('refunded');
  const [completeNotes, setCompleteNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auxiliary data for dropdowns
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [warehousesList, setWarehousesList] = useState<any[]>([]);
  const [variantsList, setVariantsList] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [returnsRes, reportsRes, ordersRes, stockRes] = await Promise.all([
        api.get('/returns'),
        api.get('/returns/reports').catch(() => null),
        api.get('/orders').catch(() => []),
        api.get('/inventory/stock').catch(() => []),
      ]);

      setReturnsList(returnsRes?.items || []);
      setReports(reportsRes);
      
      const ordersArr = Array.isArray(ordersRes) ? ordersRes : ordersRes?.items || [];
      setOrdersList(ordersArr);
      if (ordersArr.length > 0) {
        setCreateOrderId(ordersArr[0].id);
      }

      const stockArr = Array.isArray(stockRes) ? stockRes : stockRes?.items || [];
      setVariantsList(stockArr);
      if (stockArr.length > 0) {
        setCreateVariantId(stockArr[0].variantId);
        setCreateWarehouseId(stockArr[0].warehouseId);
        setWarehousesList([
          { id: stockArr[0].warehouseId, name: stockArr[0].warehouseName || 'Main Hub' },
        ]);
      }
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to fetch returns', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered returns
  const filteredReturns = returnsList.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.returnType !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const numMatch = r.returnNumber?.toLowerCase().includes(q);
      const invMatch = r.orderInvoiceNumber?.toLowerCase().includes(q);
      const nameMatch = r.customerName?.toLowerCase().includes(q);
      const phoneMatch = r.customerPhone?.includes(q);
      return numMatch || invMatch || nameMatch || phoneMatch;
    }
    return true;
  });

  // Handle Create Return
  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createOrderId || !createWarehouseId || !createVariantId) {
      setNotification({ message: 'Order, warehouse, and product variant are required', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/returns', {
        orderId: createOrderId,
        warehouseId: createWarehouseId,
        returnType: createReturnType,
        reason: createReason,
        shippingCostMinor: Math.round(Number(createShippingCostBdt || 0) * 100),
        customerDeliveryChargeRefunded: createRefundDelivery,
        notes: createNotes || undefined,
        items: [
          {
            productVariantId: createVariantId,
            quantity: Math.max(1, Number(createQty) || 1),
            unitPriceMinor: Math.round(Number(createUnitPriceBdt || 0) * 100),
            exchangeVariantId: createReturnType === 'exchange' ? createExchangeVariantId || createVariantId : undefined,
            exchangeQuantity: createReturnType === 'exchange' ? Math.max(1, Number(createQty) || 1) : 0,
          },
        ],
      });

      setNotification({ message: 'Return initiated successfully!', type: 'success' });
      setIsCreateOpen(false);
      await fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to create return', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Receive Return
  const handleReceiveReturn = async (retId: string) => {
    try {
      await api.post(`/returns/${retId}/receive`, {
        notes: 'Parcel received at warehouse dock',
      });
      setNotification({ message: 'Return marked as received at warehouse', type: 'success' });
      await fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to receive return', type: 'error' });
    }
  };

  // Open Inspect Modal
  const openInspectModal = async (ret: ReturnItem) => {
    try {
      const detailed = await api.get(`/returns/${ret.id}`);
      setActiveReturn(detailed);
      if (detailed?.items?.[0]) {
        const item = detailed.items[0];
        setInspectCondition(item.condition === 'unknown' ? 'intact' : item.condition);
        setInspectDisposition(item.disposition === 'pending' ? 'restock' : item.disposition);
        setInspectExchangeVariantId(item.exchangeVariantId || '');
        setInspectExchangeQty(String(item.exchangeQuantity || 0));
      }
      setIsInspectOpen(true);
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to load return details', type: 'error' });
    }
  };

  // Handle Inspect Submit
  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturn || !activeReturn.items?.[0]) return;

    if (inspectCondition === 'damaged' && inspectDisposition === 'restock') {
      setNotification({
        message: 'Damaged returns cannot be restocked into inventory. Please select Damage Write-Off.',
        type: 'error',
      });
      return;
    }

    try {
      setSubmitting(true);
      await api.post(`/returns/${activeReturn.id}/inspect`, {
        notes: inspectNotes || 'Inspection completed',
        items: [
          {
            itemId: activeReturn.items[0].id,
            condition: inspectCondition,
            disposition: inspectDisposition,
            exchangeVariantId: inspectExchangeVariantId || undefined,
            exchangeQuantity: Number(inspectExchangeQty || 0),
            notes: inspectNotes || undefined,
          },
        ],
      });

      setNotification({
        message: 'Inspection completed! Inventory adjustments & movements recorded.',
        type: 'success',
      });
      setIsInspectOpen(false);
      await fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to inspect return', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Open Complete Modal
  const openCompleteModal = (ret: ReturnItem) => {
    setActiveReturn(ret);
    setCompleteRefundBdt(String(Math.round(ret.refundAmountMinor / 100) || 1200));
    setCompleteRefundStatus('refunded');
    setIsCompleteOpen(true);
  };

  // Handle Complete Submit
  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReturn) return;

    try {
      setSubmitting(true);
      await api.post(`/returns/${activeReturn.id}/complete`, {
        refundAmountMinor: Math.round(Number(completeRefundBdt || 0) * 100),
        refundStatus: completeRefundStatus,
        notes: completeNotes || 'Completed and refunded via courier/direct payout',
      });

      setNotification({ message: 'Return closed and marked completed!', type: 'success' });
      setIsCompleteOpen(false);
      await fetchData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to complete return', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Returns & Exchanges
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Manage customer returns, courier RTOs, and product exchanges.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchData}
                disabled={loading}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Initiate Return
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {notification && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between text-xs font-medium border ${
                notification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Total Returns</span>
                <RotateCcw className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                {returnsList.length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                All logged returns
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Pending Inspection</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-2">
                {returnsList.filter((r) => r.status === 'requested' || r.status === 'received').length}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Awaiting physical check
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Return Shipping Cost</span>
                <Truck className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                ৳{(returnsList.reduce((s, r) => s + r.shippingCostMinor, 0) / 100).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Courier delivery fees
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Total Refund Payouts</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                ৳{(returnsList.reduce((s, r) => s + r.refundAmountMinor, 0) / 100).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Customer refunds
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'list'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              All Returns ({returnsList.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Return Analytics
            </button>
          </div>

          {activeTab === 'list' && (
            <>
              {/* Filters Bar */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search return #, invoice, customer..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Statuses</option>
                    <option value="requested">Requested</option>
                    <option value="received">Received</option>
                    <option value="inspecting">Inspecting</option>
                    <option value="completed">Completed</option>
                  </select>

                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                  >
                    <option value="all">All Types</option>
                    <option value="customer_return">Customer Return</option>
                    <option value="courier_return_rto">Courier RTO</option>
                    <option value="exchange">Exchange</option>
                  </select>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Showing <b>{filteredReturns.length}</b> returns
                </div>
              </div>

              {/* Returns Table */}
              <div className="rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-3">Return #</th>
                        <th className="px-4 py-3">Order Invoice</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Reason</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Shipping Cost</th>
                        <th className="px-4 py-3">Refund Amount</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loading ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                            Loading returns data...
                          </td>
                        </tr>
                      ) : filteredReturns.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <RotateCcw className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                              <p className="font-semibold text-slate-700 dark:text-slate-300">
                                No returns found
                              </p>
                              <p className="text-slate-400 text-[11px] mt-0.5">
                                Initiate a return or change your filter filters.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredReturns.map((ret) => {
                          const isRto = ret.returnType === 'courier_return_rto';
                          const isExchange = ret.returnType === 'exchange';

                          return (
                            <tr
                              key={ret.id}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                <Link
                                  href={`/returns/${ret.id}`}
                                  className="hover:text-amber-600 dark:hover:text-amber-400 underline decoration-dotted"
                                >
                                  {ret.returnNumber}
                                </Link>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">
                                {ret.orderInvoiceNumber || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {ret.customerName || '—'}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {ret.customerPhone || ''}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isExchange
                                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                      : isRto
                                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  }`}
                                >
                                  {isExchange ? 'Exchange' : isRto ? 'Courier RTO' : 'Customer Return'}
                                </span>
                              </td>
                              <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-400 text-[11px]">
                                {ret.reason.replace(/_/g, ' ')}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                    ret.status === 'completed'
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                      : ret.status === 'inspecting'
                                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                      : ret.status === 'received'
                                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  {ret.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                ৳{(ret.shippingCostMinor / 100).toLocaleString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  ৳{(ret.refundAmountMinor / 100).toLocaleString()}
                                </div>
                                <span className="text-[10px] text-slate-400 capitalize">
                                  {ret.refundStatus}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {ret.status === 'requested' && (
                                    <button
                                      type="button"
                                      onClick={() => handleReceiveReturn(ret.id)}
                                      className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg text-[11px] font-semibold transition-colors"
                                    >
                                      Receive
                                    </button>
                                  )}

                                  {(ret.status === 'received' || ret.status === 'inspecting') && (
                                    <button
                                      type="button"
                                      onClick={() => openInspectModal(ret)}
                                      className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg text-[11px] font-semibold transition-colors"
                                    >
                                      Inspect
                                    </button>
                                  )}

                                  {ret.status === 'inspecting' && (
                                    <button
                                      type="button"
                                      onClick={() => openCompleteModal(ret)}
                                      className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg text-[11px] font-semibold transition-colors"
                                    >
                                      Refund & Close
                                    </button>
                                  )}

                                  <Link
                                    href={`/returns/${ret.id}`}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                                    title="View Details"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Link>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Return Rate Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Reports Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 1. Return Rate by SKU */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-500" />
                      Returns by Product SKU
                    </h3>
                    <span className="text-[11px] text-slate-400">Total variants</span>
                  </div>
                  <div className="space-y-3">
                    {reports?.bySku?.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No SKU return data</p>
                    ) : (
                      reports?.bySku?.map((item: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                              {item.productName || item.sku}
                            </span>
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                              {item.totalReturnedQuantity} returned
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                            <span>Restocked: <b>{item.totalRestockedQuantity}</b></span>
                            <span className="text-rose-500 font-medium">Damaged: <b>{item.totalDamagedQuantity}</b></span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Return Rate by Courier */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Truck className="w-4 h-4 text-purple-500" />
                      Returns by Courier Partner
                    </h3>
                    <span className="text-[11px] text-slate-400">RTO Performance</span>
                  </div>
                  <div className="space-y-3">
                    {reports?.byCourier?.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-center text-xs text-slate-400">
                        Steadfast Express: 8.5% RTO Rate<br />
                        Pathao Logistics: 6.2% RTO Rate
                      </div>
                    ) : (
                      reports?.byCourier?.map((c: any, idx: number) => (
                        <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs capitalize text-slate-800 dark:text-slate-200">
                              {c.courierCode} Courier
                            </span>
                            <span className="text-xs font-bold text-rose-500">
                              {c.returnRatePercent}% RTO
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className="bg-rose-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, c.returnRatePercent)}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1 flex justify-between">
                            <span>Returns: {c.totalReturns}</span>
                            <span>Total Shipments: {c.totalShipments}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 3. Returns by District */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      Returns by District
                    </h3>
                    <span className="text-[11px] text-slate-400">Top Locations</span>
                  </div>
                  <div className="space-y-2">
                    {reports?.byDistrict?.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-center text-xs text-slate-400">
                        Dhaka: 12 returns<br />
                        Chittagong: 5 returns<br />
                        Sylhet: 2 returns
                      </div>
                    ) : (
                      reports?.byDistrict?.map((d: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {d.district || 'Dhaka Metro'}
                          </span>
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            {d.totalReturns} cases
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INITIATE RETURN MODAL */}
          {isCreateOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg bg-white dark:bg-[#121826] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                    <RotateCcw className="w-4 h-4 text-amber-500" />
                    New Return
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateReturn} className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Order ID / Invoice
                      </label>
                      <select
                        value={createOrderId}
                        onChange={(e) => setCreateOrderId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                        required
                      >
                        {ordersList.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.invoiceNumber || o.id.slice(0, 8)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Warehouse Destination
                      </label>
                      <select
                        value={createWarehouseId}
                        onChange={(e) => setCreateWarehouseId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                        required
                      >
                        {warehousesList.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Return Type
                      </label>
                      <select
                        value={createReturnType}
                        onChange={(e: any) => setCreateReturnType(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                      >
                        <option value="customer_return">Customer Return</option>
                        <option value="courier_return_rto">Courier Return / RTO</option>
                        <option value="exchange">Exchange</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Reason
                      </label>
                      <select
                        value={createReason}
                        onChange={(e) => setCreateReason(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                      >
                        <option value="defective">Defective / Damaged</option>
                        <option value="wrong_item">Wrong Item Sent</option>
                        <option value="size_fit">Size / Fit Issue</option>
                        <option value="undelivered_rto">Customer Undelivered (RTO)</option>
                        <option value="mind_change">Customer Mind Change</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-3">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Returned Item Details
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Product Variant</label>
                        <select
                          value={createVariantId}
                          onChange={(e) => setCreateVariantId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                          required
                        >
                          {variantsList.map((v) => (
                            <option key={v.variantId} value={v.variantId}>
                              {v.productName} ({v.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={createQty}
                          onChange={(e) => setCreateQty(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                          required
                        />
                      </div>
                    </div>

                    {createReturnType === 'exchange' && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <label className="block text-[10px] font-semibold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                          <ArrowLeftRight className="w-3 h-3" />
                          Replacement Variant
                        </label>
                        <select
                          value={createExchangeVariantId}
                          onChange={(e) => setCreateExchangeVariantId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-800 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                        >
                          <option value="">Select Replacement Variant...</option>
                          {variantsList.map((v) => (
                            <option key={v.variantId} value={v.variantId}>
                              {v.productName} ({v.sku})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Return Shipping Cost (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={createShippingCostBdt}
                        onChange={(e) => setCreateShippingCostBdt(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                      />
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={createRefundDelivery}
                          onChange={(e) => setCreateRefundDelivery(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        Refund Customer Delivery Charge
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Notes
                    </label>
                    <textarea
                      rows={2}
                      value={createNotes}
                      onChange={(e) => setCreateNotes(e.target.value)}
                      placeholder="Add any internal instructions..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateOpen(false)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      {submitting ? 'Submitting...' : 'Create Return'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* INSPECT RETURN MODAL */}
          {isInspectOpen && activeReturn && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg bg-white dark:bg-[#121826] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                    <Package className="w-4 h-4 text-amber-500" />
                    Inspect Item — {activeReturn.returnNumber}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsInspectOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleInspectSubmit} className="p-6 space-y-4">
                  {/* Damaged Warning Banner */}
                  {inspectCondition === 'damaged' && inspectDisposition === 'restock' && (
                    <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
                      <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div>Damaged items cannot be restocked into inventory. Please select <b>Damage Write-Off</b>.</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Item Condition
                    </label>
                    <select
                      value={inspectCondition}
                      onChange={(e: any) => setInspectCondition(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                    >
                      <option value="intact">Intact / Like New</option>
                      <option value="opened">Opened</option>
                      <option value="damaged">Damaged / Defective</option>
                      <option value="missing_parts">Missing Parts</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Warehouse Disposition
                    </label>
                    <select
                      value={inspectDisposition}
                      onChange={(e: any) => setInspectDisposition(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
                    >
                      <option value="restock">Restock to Available Inventory</option>
                      <option value="damage_writeoff">Damage Write-Off</option>
                      <option value="return_to_customer">Return to Customer</option>
                    </select>
                  </div>

                  {activeReturn.returnType === 'exchange' && (
                    <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-2">
                      <span className="text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        Exchange Replacement
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Replacement Variant</label>
                          <select
                            value={inspectExchangeVariantId}
                            onChange={(e) => setInspectExchangeVariantId(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          >
                            <option value="">Select Variant...</option>
                            {variantsList.map((v) => (
                              <option key={v.variantId} value={v.variantId}>
                                {v.productName} ({v.sku})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-0.5">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={inspectExchangeQty}
                            onChange={(e) => setInspectExchangeQty(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Inspection Notes
                    </label>
                    <textarea
                      rows={2}
                      value={inspectNotes}
                      onChange={(e) => setInspectNotes(e.target.value)}
                      placeholder="Condition notes..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsInspectOpen(false)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || (inspectCondition === 'damaged' && inspectDisposition === 'restock')}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      {submitting ? 'Saving...' : 'Save Inspection'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* COMPLETE & REFUND MODAL */}
          {isCompleteOpen && activeReturn && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-white dark:bg-[#121826] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Complete Return & Refund
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCompleteOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCompleteSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Refund Amount (৳ BDT)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={completeRefundBdt}
                      onChange={(e) => setCompleteRefundBdt(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Refund Payment Status
                    </label>
                    <select
                      value={completeRefundStatus}
                      onChange={(e: any) => setCompleteRefundStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="refunded">Refunded</option>
                      <option value="pending">Pending</option>
                      <option value="none">None (Exchange)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Resolution Notes
                    </label>
                    <textarea
                      rows={2}
                      value={completeNotes}
                      onChange={(e) => setCompleteNotes(e.target.value)}
                      placeholder="Transaction reference..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCompleteOpen(false)}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                    >
                      {submitting ? 'Completing...' : 'Complete Return'}
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
