'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  RotateCcw,
  ArrowLeft,
  Package,
  Truck,
  MapPin,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeftRight,
  ShieldAlert,
  User,
  Building2,
  Calendar,
  FileText,
} from 'lucide-react';

export default function ReturnDetailPage() {
  const params = useParams();
  const id = (params?.['id'] as string) || '';

  const [returnRecord, setReturnRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReturn = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get(`/returns/${id}`);
      setReturnRecord(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch return details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReturn();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="w-4 h-4 animate-spin text-amber-500" />
              Loading return information...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !returnRecord) {
    return (
      <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <Topbar />
          <div className="p-8">
            <Link
              href="/returns"
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Returns List
            </Link>
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm">
              <AlertTriangle className="w-5 h-5 mb-2 text-rose-600" />
              {error || 'Return record not found'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isExchange = returnRecord.returnType === 'exchange';
  const isRto = returnRecord.returnType === 'courier_return_rto';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-200">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <div>
            <Link
              href="/returns"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Returns
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                      {returnRecord.returnNumber}
                    </h1>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        isExchange
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : isRto
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      {isExchange ? 'Exchange' : isRto ? 'Courier RTO' : 'Customer Return'}
                    </span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        returnRecord.status === 'completed'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : returnRecord.status === 'inspecting'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                          : returnRecord.status === 'received'
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {returnRecord.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Invoice: <b>{returnRecord.orderInvoiceNumber || '—'}</b> •{' '}
                    {new Date(returnRecord.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Customer Details */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-500" />
                Customer Info
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Customer:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {returnRecord.customerName || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Phone:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {returnRecord.customerPhone || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Reason:</span>
                  <span className="font-semibold capitalize text-amber-600 dark:text-amber-400">
                    {returnRecord.reason.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Warehouse & Destination */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-purple-500" />
                Warehouse & Shipping
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Warehouse:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {returnRecord.warehouseName || 'Main Hub'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Reverse Shipping:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    ৳{(returnRecord.shippingCostMinor / 100).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Delivery Fee Refunded:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {returnRecord.customerDeliveryChargeRefunded ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>

            {/* Refund & Accounting */}
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
                Refund Details
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Refund Amount:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    ৳{(returnRecord.refundAmountMinor / 100).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status:</span>
                  <span className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                    {returnRecord.refundStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Completed At:</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {returnRecord.completedAt
                      ? new Date(returnRecord.completedAt).toLocaleDateString()
                      : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Returned Items Table */}
          <div className="rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                Returned Items
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200/80 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3">Product / SKU</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3">Disposition</th>
                    <th className="px-4 py-3">Replacement SKU</th>
                    <th className="px-4 py-3">Restocked At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {returnRecord.items?.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.productName || item.variantName}
                        </div>
                        <div className="text-[11px] text-slate-400">SKU: {item.variantSku}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            item.condition === 'intact'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : item.condition === 'damaged'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {item.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            item.disposition === 'restock'
                              ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                              : item.disposition === 'damage_writeoff'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {item.disposition.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {item.exchangeVariantId ? (
                          <div className="text-purple-600 dark:text-purple-400 font-medium">
                            Variant: {item.exchangeVariantId.slice(0, 8)}... (Qty: {item.exchangeQuantity})
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {item.restockedAt
                          ? new Date(item.restockedAt).toLocaleString()
                          : item.disposition === 'damage_writeoff'
                          ? 'Written off (Not sellable)'
                          : 'Pending'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Timeline */}
          <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Return Timeline & Audit Log
            </h3>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {returnRecord.history?.map((h: any, idx: number) => (
                <div key={idx} className="relative flex items-start gap-3">
                  <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-[#121826] bg-amber-500 ring-2 ring-amber-500/20" />
                  <div className="space-y-0.5">
                    <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="capitalize">
                        {h.fromStatus === 'none' ? 'Return Initiated' : `Status changed to ${h.toStatus}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({new Date(h.createdAt).toLocaleString()})
                      </span>
                    </div>
                    {h.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {h.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
