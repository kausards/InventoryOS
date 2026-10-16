'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { api } from '../../lib/api';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Search,
  Users,
  Building,
  CreditCard,
  DollarSign,
  Clock,
  ExternalLink,
  Check,
  Ban,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

export default function PlatformAdminPage() {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Stats and lists
  const [stats, setStats] = useState<any>({
    totalTenants: 0,
    activeSubscriptions: 0,
    pendingPaymentReviews: 0,
    totalPlatformRevenueMinor: 0,
  });
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [tenantsList, setTenantsList] = useState<any[]>([]);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'payments' | 'tenants'>('payments');

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals for Verify / Reject
  const [selectedPaymentForAction, setSelectedPaymentForAction] = useState<any | null>(null);
  const [actionType, setActionType] = useState<'verified' | 'rejected'>('verified');
  const [rejectionReason, setRejectionReason] = useState('Invalid Transaction ID on statement');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, paymentsRes, tenantsRes] = await Promise.all([
        api.admin.getStats().catch(() => ({})),
        api.admin.getPendingPayments().catch(() => []),
        api.admin.getTenants().catch(() => []),
      ]);

      setStats(statsRes || {});
      setPendingPayments(paymentsRes || []);
      setTenantsList(tenantsRes || []);
    } catch (err: any) {
      setNotification({ message: 'অ্যাডমিন তথ্য লোড করতে ব্যর্থ হয়েছে', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openActionModal = (payment: any, type: 'verified' | 'rejected') => {
    setSelectedPaymentForAction(payment);
    setActionType(type);
    setRejectionReason('Invalid Transaction ID on statement');
  };

  const handleVerifyOrReject = async () => {
    if (!selectedPaymentForAction) return;

    setActionSubmitting(true);
    try {
      await api.admin.verifyPayment(selectedPaymentForAction.id, {
        decision: actionType,
        ...(actionType === 'rejected' ? { rejectionReason } : {}),
      });

      setNotification({
        message:
          actionType === 'verified'
            ? 'পেমেন্ট সফলভাবে ভেরিফাই ও সাবস্ক্রিপশন সক্রিয় করা হয়েছে!'
            : 'পেমেন্ট রসিদ সফলভাবে প্রত্যাখ্যান করা হয়েছে।',
        type: 'success',
      });

      setSelectedPaymentForAction(null);
      fetchData();
    } catch (err: any) {
      setNotification({
        message: err.message || 'অপারেশন সম্পন্ন করতে সমস্যা হয়েছে',
        type: 'error',
      });
    } finally {
      setActionSubmitting(false);
    }
  };

  const formatPaisa = (paisa: number) => {
    return (paisa / 100).toLocaleString('bn-BD', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const filteredTenants = tenantsList.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q) ||
      t.planName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 font-sans transition-colors">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <main className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* Toast Notification */}
          {notification && (
            <div
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                notification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                )}
                <span className="text-sm font-semibold">{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  প্ল্যাটফর্ম সুপার-অ্যাডমিন (Platform Admin)
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ম্যানুয়াল পেমেন্ট ট্রানজ্যাকশন যাচাই, টেন্যান্ট ডিরেক্টরি এবং প্ল্যাটফর্ম অ্যানালিটিক্স।
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors self-start sm:self-center"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stats KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400">মোট টেন্যান্ট</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {stats.totalTenants ?? 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Building className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400">সক্রিয় সাবস্ক্রিপশন</span>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {stats.activeSubscriptions ?? 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400">যাচাইয়ের অপেক্ষায় (Pending)</span>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  {stats.pendingPaymentReviews ?? pendingPayments.length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400">মোট সংগৃহীত রাজস্ব</span>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  ৳{formatPaisa(stats.totalPlatformRevenueMinor ?? 0)}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'payments'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>পেমেন্ট ভেরিফিকেশন কিউ</span>
              {pendingPayments.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingPayments.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tenants')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'tenants'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              টেন্যান্ট ডিরেক্টরি ({tenantsList.length})
            </button>
          </div>

          {/* TAB 1: PENDING PAYMENTS VERIFICATION QUEUE */}
          {activeTab === 'payments' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    পর্যালোচনার অপেক্ষায় থাকা ম্যানুয়াল পেমেন্টসমূহ
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    বিকাশ, নগদ বা ব্যাংক ট্রান্সফারের TrxID যাচাই করে সাবস্ক্রিপশন অ্যাক্টিভেট করুন।
                  </p>
                </div>
              </div>

              {pendingPayments.length === 0 ? (
                <div className="text-center py-16 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    সব পেমেন্ট যাচাই সম্পন্ন!
                  </h4>
                  <p className="text-xs text-slate-400">
                    এই মুহূর্তে পর্যালোচনার অপেক্ষায় কোনো ম্যানুয়াল পেমেন্ট নেই।
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                        <th className="pb-3">টেন্যান্ট / প্রতিষ্ঠান</th>
                        <th className="pb-3">প্ল্যান ও সাইকেল</th>
                        <th className="pb-3">মেথড</th>
                        <th className="pb-3">ট্রানজ্যাকশন আইডি (TrxID)</th>
                        <th className="pb-3">প্রেরক নম্বর</th>
                        <th className="pb-3">পরিমাণ (৳)</th>
                        <th className="pb-3">জমার তারিখ</th>
                        <th className="pb-3 text-right">যাচাই অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {pendingPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-4">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {p.tenantName}
                            </div>
                            <div className="text-[11px] text-slate-400">{p.submittedByEmail || '—'}</div>
                          </td>
                          <td className="py-4">
                            <span className="font-bold text-slate-900 dark:text-white">{p.planName}</span>
                            <span className="text-[11px] text-slate-400 block capitalize">
                              {p.billingCycle}
                            </span>
                          </td>
                          <td className="py-4 capitalize font-bold text-slate-700 dark:text-slate-300">
                            {p.paymentMethod}
                          </td>
                          <td className="py-4 font-mono font-bold text-blue-600 dark:text-blue-400 select-all">
                            {p.transactionId}
                          </td>
                          <td className="py-4 text-slate-700 dark:text-slate-300 font-mono">
                            {p.senderNumber}
                          </td>
                          <td className="py-4 font-black text-slate-900 dark:text-white">
                            ৳{formatPaisa(p.amountMinor)}
                          </td>
                          <td className="py-4 text-slate-500">
                            {new Date(p.createdAt).toLocaleDateString('bn-BD', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => openActionModal(p, 'verified')}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              অনুমোদন
                            </button>
                            <button
                              type="button"
                              onClick={() => openActionModal(p, 'rejected')}
                              className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-xs font-bold inline-flex items-center gap-1 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              প্রত্যাখ্যান
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TENANT DIRECTORY */}
          {activeTab === 'tenants' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  প্ল্যাটফর্ম টেন্যান্ট তালিকা (Tenant Directory)
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="টেন্যান্ট বা প্ল্যান খুঁজুন..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                      <th className="pb-3">নাম ও স্লাগ</th>
                      <th className="pb-3">প্ল্যানের নাম</th>
                      <th className="pb-3">সাবস্ক্রিপশন স্ট্যাটাস</th>
                      <th className="pb-3">বিলিং সাইকেল</th>
                      <th className="pb-3">মেয়াদ শেষ</th>
                      <th className="pb-3">যুক্ত হওয়ার তারিখ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    {filteredTenants.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">{t.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">/{t.slug}</div>
                        </td>
                        <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                          {t.planName ?? 'Starter'}
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              t.subStatus === 'active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                : t.subStatus === 'trial'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                                : t.subStatus === 'payment_pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}
                          >
                            {t.subStatus ?? 'trial'}
                          </span>
                        </td>
                        <td className="py-3.5 capitalize text-slate-600 dark:text-slate-400">
                          {t.billingCycle ?? 'monthly'}
                        </td>
                        <td className="py-3.5 text-slate-500">
                          {t.periodEnd
                            ? new Date(t.periodEnd).toLocaleDateString('bn-BD', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : '—'}
                        </td>
                        <td className="py-3.5 text-slate-400">
                          {new Date(t.createdAt).toLocaleDateString('bn-BD', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VERIFY / REJECT ACTION MODAL */}
          {selectedPaymentForAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 space-y-6 shadow-2xl my-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        actionType === 'verified'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      {actionType === 'verified' ? <Check className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {actionType === 'verified' ? 'পেমেন্ট অনুমোদন নিশ্চিতকরণ' : 'পেমেন্ট প্রত্যাখ্যান নিশ্চিতকরণ'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentForAction(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Details Summary */}
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">টেন্যান্ট:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedPaymentForAction.tenantName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">প্ল্যান:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedPaymentForAction.planName} ({selectedPaymentForAction.billingCycle})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">মেথড ও নম্বর:</span>
                    <span className="font-bold text-slate-900 dark:text-white capitalize">
                      {selectedPaymentForAction.paymentMethod} ({selectedPaymentForAction.senderNumber})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">ট্রানজ্যাকশন আইডি (TrxID):</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {selectedPaymentForAction.transactionId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">পরিমাণ:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      ৳{formatPaisa(selectedPaymentForAction.amountMinor)} BDT
                    </span>
                  </div>
                </div>

                {actionType === 'verified' ? (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    অনুমোদন করলে টেন্যান্টের সাবস্ক্রিপশন স্ট্যাটাস তাৎক্ষণিকভাবে{' '}
                    <span className="font-bold text-emerald-600">Active</span> হবে, নতুন পিরিয়ড যোগ হবে এবং পরিশোধিত ইনভয়েস ইস্যু হবে।
                  </p>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      প্রত্যাখ্যানের কারণ (Rejection Reason) *
                    </label>
                    <textarea
                      rows={3}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="কারণ উল্লেখ করুন..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentForAction(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyOrReject}
                    disabled={actionSubmitting}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                      actionType === 'verified'
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                        : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                    }`}
                  >
                    {actionSubmitting ? (
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        প্রসেস হচ্ছে...
                      </span>
                    ) : actionType === 'verified' ? (
                      'অনুমোদন ও সক্রিয় করুন'
                    ) : (
                      'প্রত্যাখ্যান করুন'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
