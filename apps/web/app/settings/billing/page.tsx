'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Plus,
  ArrowUpRight,
  Shield,
  ShieldAlert,
  Sparkles,
  Zap,
  Building,
  Users,
  Store,
  Warehouse,
  Truck,
  FileText,
  Clock,
  ExternalLink,
  Printer,
  Copy,
  ChevronRight,
} from 'lucide-react';

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Billing data states
  const [currentSubData, setCurrentSubData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  // Modals
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedPlanForPay, setSelectedPlanForPay] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState<any>(null);

  // Manual payment form fields
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'rocket' | 'bank_transfer'>('bkash');
  const [transactionId, setTransactionId] = useState('');
  const [senderNumber, setSenderNumber] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'overview' | 'submissions' | 'invoices'>('overview');

  const fetchBillingData = async () => {
    setLoading(true);
    try {
      const [subRes, plansRes, paymentsRes, invoicesRes] = await Promise.all([
        api.subscriptions.getCurrent().catch(() => null),
        api.subscriptions.getPlans().catch(() => []),
        api.subscriptions.getManualPayments().catch(() => []),
        api.subscriptions.getInvoices().catch(() => []),
      ]);

      setCurrentSubData(subRes);
      setPlans(plansRes || []);
      setSubmissions(paymentsRes || []);
      setInvoices(invoicesRes || []);
    } catch (err: any) {
      setNotification({ message: 'বিলিং তথ্য লোড করতে সমস্যা হয়েছে', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const openPaymentModalWithPlan = (plan: any, cycle: 'monthly' | 'annual' = 'monthly') => {
    setSelectedPlanForPay(plan);
    setBillingCycle(cycle);
    setIsUpgradeModalOpen(false);
    setIsPayModalOpen(true);
  };

  const handleManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForPay) return;

    if (!transactionId.trim() || transactionId.trim().length < 4) {
      setNotification({ message: 'সঠিক ট্রানজ্যাকশন আইডি (TrxID) প্রদান করুন', type: 'error' });
      return;
    }

    if (!senderNumber.trim() || senderNumber.trim().length < 11) {
      setNotification({ message: 'সঠিক প্রেরক ফোন নম্বর (১১ ডিজিট) প্রদান করুন', type: 'error' });
      return;
    }

    const priceMinor =
      billingCycle === 'annual'
        ? selectedPlanForPay.annualPriceMinor
        : selectedPlanForPay.monthlyPriceMinor;

    setSubmittingPayment(true);
    try {
      const payload: any = {
        planId: selectedPlanForPay.id,
        billingCycle,
        paymentMethod,
        amountMinor: priceMinor,
        transactionId: transactionId.trim(),
        senderNumber: senderNumber.trim(),
      };
      if (receiptUrl.trim()) payload.receiptUrl = receiptUrl.trim();
      if (paymentNotes.trim()) payload.notes = paymentNotes.trim();

      await api.subscriptions.submitManualPayment(payload);

      setNotification({
        message: 'পেমেন্ট রসিদ সফলভাবে জমা হয়েছে! অ্যাডমিন যাচাই করার পর সক্রিয় হবে।',
        type: 'success',
      });
      setIsPayModalOpen(false);
      setTransactionId('');
      setSenderNumber('');
      setReceiptUrl('');
      setPaymentNotes('');
      fetchBillingData();
    } catch (err: any) {
      setNotification({
        message: err.message || 'পেমেন্ট তথ্য জমা দিতে ব্যর্থ হয়েছে',
        type: 'error',
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const formatPaisa = (paisa: number) => {
    return (paisa / 100).toLocaleString('bn-BD', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const formatEnPaisa = (paisa: number) => {
    return (paisa / 100).toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const sub = currentSubData?.subscription;
  const currentPlan = currentSubData?.plan;
  const entitlements = currentSubData?.entitlements;
  const usage = currentSubData?.usage;
  const statusChecks = currentSubData?.statusChecks;

  const orderLimitPercent =
    entitlements?.maxMonthlyOrders && usage?.ordersCount != null
      ? Math.min(100, Math.round((usage.ordersCount / entitlements.maxMonthlyOrders) * 100))
      : 0;

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

          {/* Restricted Read-Only Mode Banner */}
          {statusChecks?.isRestrictedReadOnlyMode && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">
                    রেস্ট্রিক্টেড রিড-অনলি মোড সক্রিয় (Restricted Read-Only Mode)
                  </h4>
                  <p className="text-xs text-rose-600/90 dark:text-rose-300/80">
                    আপনার সাবস্ক্রিপশনের মেয়াদ শেষ হয়েছে। ঐতিহাসিক ডেটা সুরক্ষিত রয়েছে তবে নতুন অর্ডার বা রাইট অপারেশন স্থগিত আছে। অনুগ্রহ করে রিনিউ করুন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 transition-colors shadow-sm"
              >
                এখনই রিনিউ করুন
              </button>
            </div>
          )}

          {/* Trial / Payment Pending Notice */}
          {sub?.status === 'trial' && (
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-700 dark:text-blue-400">
                    ১৪ দিনের ফ্রি ট্রায়াল চালু আছে (Free Trial Active)
                  </h4>
                  <p className="text-xs text-blue-600/90 dark:text-blue-300/80">
                    মেয়াদ শেষ হওয়ার আগেই বিকাশ বা নগদে পেমেন্ট জমা দিয়ে প্রো-ফিচার উপভোগ করুন।
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 transition-colors"
              >
                প্ল্যান নির্বাচন করুন
              </button>
            </div>
          )}

          {sub?.status === 'payment_pending' && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    পেমেন্ট ভেরিফিকেশন পর্যালোচনায় আছে (Pending Verification)
                  </h4>
                  <p className="text-xs text-amber-600/90 dark:text-amber-300/80">
                    আপনার জমা দেওয়া ট্রানজ্যাকশন আইডি প্ল্যাটফর্ম অ্যাডমিন পর্যালোচনা করছেন। সাধারণত ১৫-৩০ মিনিটের মধ্যে স্বয়ংক্রিয়ভাবে সক্রিয় হয়।
                  </p>
                </div>
              </div>
              <span className="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold">
                Review in Progress
              </span>
            </div>
          )}

          {/* Header Title & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                সাবস্ক্রিপশন ও বিলিং (Subscriptions & Billing)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                আপনার স্টোরের সাবস্ক্রিপশন প্ল্যান, পেমেন্ট ও ইনভয়েস রসিদসমূহ পরিচালনা করুন।
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={fetchBillingData}
                disabled={loading}
                className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                title="রিফ্রেশ করুন"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>প্ল্যান আপগ্রেড করুন</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              ওভারভিউ ও ব্যবহার (Overview)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'submissions'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              পেমেন্ট রসিদ হিস্ট্রি ({submissions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'invoices'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              বিলিং ইনভয়েসসমূহ ({invoices.length})
            </button>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Subscription Card */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-slate-900 dark:text-white">
                        {currentPlan?.name ?? 'Starter'} প্ল্যান
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          sub?.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : sub?.status === 'trial'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                            : sub?.status === 'payment_pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                        }`}
                      >
                        {sub?.status ?? 'active'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                      {currentPlan?.description ?? 'ক্ষুদ্র ও মাঝারি অনলাইন ব্যবসার জন্য আদর্শ ইনভেন্টরি ও ওমনিচ্যানেল সমাধান।'}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-600 dark:text-slate-300">
                      <div>
                        বিলিং সাইকেল:{' '}
                        <span className="font-semibold capitalize text-slate-900 dark:text-white">
                          {sub?.billingCycle === 'annual' ? 'বার্ষিক (Annual)' : 'মাসিক (Monthly)'}
                        </span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <div>
                        মেয়াদ শেষ:{' '}
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {sub?.currentPeriodEnd
                            ? new Date(sub.currentPeriodEnd).toLocaleDateString('bn-BD', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:border-l lg:border-slate-100 lg:dark:border-slate-800 lg:pl-6">
                    <div>
                      <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        ৳{formatPaisa(currentPlan?.monthlyPriceMinor ?? 99900)}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400"> / মাস</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        বার্ষিক ৳{formatPaisa(currentPlan?.annualPriceMinor ?? 999000)} (২০% ছাড়)
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openPaymentModalWithPlan(currentPlan || plans[0])}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-500/20"
                    >
                      পেমেন্ট জমা দিন (bKash/Nagad)
                    </button>
                  </div>
                </div>
              </div>

              {/* Resource Entitlements & Usage Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Orders Usage Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      মাসিক অর্ডার কোটা
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-2xl font-black text-slate-900 dark:text-white">
                        {usage?.ordersCount ?? 0}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        / {entitlements?.maxMonthlyOrders ?? 500} অর্ডার
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          orderLimitPercent > 90
                            ? 'bg-rose-500'
                            : orderLimitPercent > 75
                            ? 'bg-amber-500'
                            : 'bg-blue-600'
                        }`}
                        style={{ width: `${orderLimitPercent}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-slate-400 mt-2">
                      +১০% গ্রেস লিমিট: সর্বোচ্চ {statusChecks?.orderLimit?.effectiveLimit ?? Math.floor((entitlements?.maxMonthlyOrders ?? 500) * 1.1)} অর্ডার
                    </p>
                  </div>
                </div>

                {/* Staff Members Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      স্টাফ সদস্য সীমা
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Users className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      সর্বোচ্চ {entitlements?.maxStaff ?? 2} জন
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      রোল ও পারমিশন ভিত্তিক অ্যাক্সেস
                    </p>
                  </div>
                </div>

                {/* Stores Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      অনলাইন স্টোর কানেকশন
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {entitlements?.maxStores ?? 1} টি স্টোর
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      WooCommerce ও কাস্টম শপ সিঙ্ক
                    </p>
                  </div>
                </div>

                {/* Warehouses Card */}
                <div className="p-5 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      ওয়্যারহাউস সীমা
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <Warehouse className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {entitlements?.maxWarehouses ?? 1} টি ওয়্যারহাউস
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      মাল্টি-লোকেশন স্টক ও রাউটিং
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Flags Included */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  প্ল্যানে অন্তর্ভুক্ত প্রিমিয়াম ফিচারসমূহ
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    অটোমেটেড এসএমএস নোটিফিকেশন
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    স্টেডফাস্ট ও পাঠাও সরাসরি এপিআই
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    ফ্রড ও ফেক অর্ডার ডিটেকশন ইঞ্জিন
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    কাস্টম চালান ও কিউআর লেবেল প্রিন্ট
                  </span>
                  {entitlements?.featureFlags?.includes('ai_module') && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      এআই স্টক ফোরকাস্টিং
                    </span>
                  )}
                  {entitlements?.featureFlags?.includes('custom_api') && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      কাস্টম ডেভেলপার এপিআই
                    </span>
                  )}
                  {entitlements?.featureFlags?.includes('advanced_analytics') && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      অ্যাডভান্সড প্রফিট ও সিওজিএস অ্যানালিটিক্স
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL PAYMENT SUBMISSIONS */}
          {activeTab === 'submissions' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  ম্যানুয়াল পেমেন্ট রসিদ হিস্ট্রি (Payment Submissions)
                </h3>
                <button
                  type="button"
                  onClick={() => openPaymentModalWithPlan(currentPlan || plans[0])}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  নতুন পেমেন্ট জমা দিন
                </button>
              </div>

              {submissions.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  কোনো পেমেন্ট রসিদ জমা দেওয়ার হিস্ট্রি নেই।
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                        <th className="pb-3">তারিখ</th>
                        <th className="pb-3">মেথড</th>
                        <th className="pb-3">ট্রানজ্যাকশন আইডি (TrxID)</th>
                        <th className="pb-3">প্রেরক নম্বর</th>
                        <th className="pb-3">পরিমাণ (৳)</th>
                        <th className="pb-3">স্ট্যাটাস</th>
                        <th className="pb-3">মন্তব্য / কারণ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {submissions.map((subItem) => (
                        <tr key={subItem.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3.5 text-slate-500">
                            {new Date(subItem.createdAt).toLocaleDateString('bn-BD', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 capitalize font-bold text-slate-900 dark:text-white">
                            {subItem.paymentMethod}
                          </td>
                          <td className="py-3.5 font-mono text-slate-700 dark:text-slate-300">
                            {subItem.transactionId}
                          </td>
                          <td className="py-3.5 text-slate-600 dark:text-slate-400">
                            {subItem.senderNumber}
                          </td>
                          <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                            ৳{formatPaisa(subItem.amountMinor)}
                          </td>
                          <td className="py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                subItem.status === 'verified'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                                  : subItem.status === 'pending'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                              }`}
                            >
                              {subItem.status}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-500 max-w-xs truncate">
                            {subItem.rejectionReason || subItem.notes || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BILLING INVOICES */}
          {activeTab === 'invoices' && (
            <div className="p-6 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                বিলিং ইনভয়েসসমূহ (Billing Invoices)
              </h3>

              {invoices.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  কোনো ইনভয়েস পাওয়া যায়নি।
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-medium">
                        <th className="pb-3">ইনভয়েস নম্বর</th>
                        <th className="pb-3">প্ল্যানের নাম</th>
                        <th className="pb-3">বিলিং মেয়াদ</th>
                        <th className="pb-3">পরিমাণ (৳)</th>
                        <th className="pb-3">স্ট্যাটাস</th>
                        <th className="pb-3">পরিশোধের তারিখ</th>
                        <th className="pb-3 text-right">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                            {inv.planName}
                          </td>
                          <td className="py-3.5 text-slate-500">
                            {new Date(inv.billingPeriodStart).toLocaleDateString('bn-BD')} –{' '}
                            {new Date(inv.billingPeriodEnd).toLocaleDateString('bn-BD')}
                          </td>
                          <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                            ৳{formatPaisa(inv.amountMinor)}
                          </td>
                          <td className="py-3.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                              {inv.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-500">
                            {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('bn-BD') : '—'}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForView(inv)}
                              className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              ভিউ ও প্রিন্ট
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

          {/* UPGRADE PLAN COMPARISON MODAL */}
          {isUpgradeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-5xl w-full p-6 md:p-8 space-y-6 shadow-2xl my-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      সাবস্ক্রিপশন প্ল্যান নির্বাচন করুন
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      আপনার ব্যবসায়ের স্কেল অনুযায়ী সবচেয়ে উপযুক্ত প্ল্যানটি বেছে নিন।
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUpgradeModalOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Monthly / Annual Toggle */}
                <div className="flex justify-center">
                  <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center gap-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`px-4 py-2 rounded-lg transition-all ${
                        billingCycle === 'monthly'
                          ? 'bg-white dark:bg-[#121826] text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      মাসিক বিলিং (Monthly)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('annual')}
                      className={`px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 ${
                        billingCycle === 'annual'
                          ? 'bg-white dark:bg-[#121826] text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      <span>বার্ষিক বিলিং (Annual)</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px]">
                        ২০% ছাড়
                      </span>
                    </button>
                  </div>
                </div>

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {plans.map((p) => {
                    const priceMinor =
                      billingCycle === 'annual' ? p.annualPriceMinor : p.monthlyPriceMinor;
                    const isCurrent = currentPlan?.id === p.id;
                    const ent = p.entitlements || {};

                    return (
                      <div
                        key={p.id}
                        className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${
                          p.slug === 'growth'
                            ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-md ring-2 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#121826]'
                        }`}
                      >
                        <div>
                          {p.slug === 'growth' && (
                            <span className="inline-block px-2.5 py-1 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider mb-3">
                              সবচেয়ে জনপ্রিয়
                            </span>
                          )}
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                            {p.name}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 min-h-[32px]">
                            {p.description}
                          </p>

                          <div className="my-4">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                              ৳{formatPaisa(priceMinor)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {billingCycle === 'annual' ? ' / বছর' : ' / মাস'}
                            </span>
                          </div>

                          <div className="space-y-2.5 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{ent.maxMonthlyOrders?.toLocaleString('bn-BD')} টি অর্ডার / মাস</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{ent.maxStaff} জন স্টাফ সদস্য</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{ent.maxStores} টি শপ / চ্যানেল</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{ent.maxWarehouses} টি ওয়্যারহাউস</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{ent.maxCouriers} টি কুরিয়ার সংযোগ</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-6">
                          <button
                            type="button"
                            onClick={() => openPaymentModalWithPlan(p, billingCycle)}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all ${
                              p.slug === 'growth'
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20'
                                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                            }`}
                          >
                            {isCurrent ? 'রিনিউ বা মেয়াদ বাড়ান' : 'এই প্ল্যানটি নিন'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* MANUAL PAYMENT SUBMISSION MODAL */}
          {isPayModalOpen && selectedPlanForPay && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 space-y-6 shadow-2xl my-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      পেমেন্ট রসিদ জমা দিন
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {selectedPlanForPay.name} প্ল্যান ({billingCycle === 'annual' ? 'বার্ষিক' : 'মাসিক'})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPayModalOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Instructions Box */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    পেমেন্ট নির্দেশিকা (Payment Instructions):
                  </h4>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                    <li>বিকাশ / নগদ / রকেট অ্যাপ থেকে <span className="font-bold">Send Money</span> অথবা <span className="font-bold">Payment</span> করুন।</li>
                    <li>
                      মার্চেন্ট / পার্সোনাল নম্বর:{' '}
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 select-all">
                        01711223344
                      </span>{' '}
                      (bKash / Nagad Personal)
                    </li>
                    <li>
                      পরিশোধযোগ্য পরিমাণ:{' '}
                      <span className="font-bold text-slate-900 dark:text-white">
                        ৳{formatPaisa(
                          billingCycle === 'annual'
                            ? selectedPlanForPay.annualPriceMinor
                            : selectedPlanForPay.monthlyPriceMinor
                        )} BDT
                      </span>
                    </li>
                    <li>টাকা পাঠানোর পর প্রাপ্ত Transaction ID (TrxID) নিচে সঠিকভাবে ইনপুট করুন।</li>
                  </ul>
                </div>

                {/* Payment Form */}
                <form onSubmit={handleManualPaymentSubmit} className="space-y-4">
                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      পেমেন্ট মাধ্যম (Payment Method)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'bkash', name: 'বিকাশ (bKash)', color: 'text-pink-600' },
                        { id: 'nagad', name: 'নগদ (Nagad)', color: 'text-orange-600' },
                        { id: 'rocket', name: 'রকেট (Rocket)', color: 'text-purple-600' },
                        { id: 'bank_transfer', name: 'ব্যাংক ট্রান্সফার', color: 'text-blue-600' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all ${
                            paymentMethod === m.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Transaction ID */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ট্রানজ্যাকশন আইডি (TrxID) *
                    </label>
                    <input
                      type="text"
                      required
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                      placeholder="যেমন: BLG78X20Q1"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Sender Phone Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      যে নম্বর থেকে টাকা পাঠিয়েছেন (Sender Number) *
                    </label>
                    <input
                      type="text"
                      required
                      value={senderNumber}
                      onChange={(e) => setSenderNumber(e.target.value)}
                      placeholder="যেমন: 01711223344"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Receipt URL (Optional) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      স্ক্রিনশট / রসিদের লিংক (Receipt URL - ঐচ্ছিক)
                    </label>
                    <input
                      type="url"
                      value={receiptUrl}
                      onChange={(e) => setReceiptUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {/* Notes (Optional) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      অতিরিক্ত তথ্য / নোট (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      placeholder="যেকোনো তথ্য"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submittingPayment}
                      className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      {submittingPayment ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>যাচাই হচ্ছে...</span>
                        </>
                      ) : (
                        <span>রসিদ জমা দিন (Submit Payment)</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* INVOICE VIEW & PRINT MODAL */}
          {selectedInvoiceForView && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
              <div className="bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-8 space-y-6 shadow-2xl my-8">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
                      S
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Shopeers Billing Invoice
                      </h3>
                      <span className="text-xs text-slate-500">
                        ইনভয়েস নং: {selectedInvoiceForView.invoiceNumber}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                      title="প্রিন্ট করুন"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoiceForView(null)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">বিল প্রাপক (Billed To):</span>
                    <div className="font-bold text-slate-900 dark:text-white mt-1">
                      {currentSubData?.subscription?.tenantName ?? 'Organization'}
                    </div>
                    <div className="text-slate-500">Dhaka, Bangladesh</div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">তারিখ ও স্ট্যাটাস:</span>
                    <div className="font-bold text-slate-900 dark:text-white mt-1">
                      {new Date(selectedInvoiceForView.createdAt).toLocaleDateString('bn-BD')}
                    </div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold uppercase text-[10px]">
                      {selectedInvoiceForView.paymentStatus}
                    </span>
                  </div>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 font-medium">
                      <tr>
                        <th className="p-3">বিবরণ (Description)</th>
                        <th className="p-3">মেয়াদ (Period)</th>
                        <th className="p-3 text-right">পরিমাণ (Amount)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      <tr>
                        <td className="p-3 text-slate-900 dark:text-white font-bold">
                          {selectedInvoiceForView.planName} Subscription Plan
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(selectedInvoiceForView.billingPeriodStart).toLocaleDateString('bn-BD')} –{' '}
                          {new Date(selectedInvoiceForView.billingPeriodEnd).toLocaleDateString('bn-BD')}
                        </td>
                        <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                          ৳{formatPaisa(selectedInvoiceForView.amountMinor)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-slate-50/50 dark:bg-slate-800/30">
                      <tr>
                        <td colSpan={2} className="p-3 font-bold text-slate-700 dark:text-slate-300">
                          মোট পরিশোধিত (Total Paid)
                        </td>
                        <td className="p-3 text-right font-black text-slate-900 dark:text-white text-sm">
                          ৳{formatPaisa(selectedInvoiceForView.amountMinor)} BDT
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="text-[11px] text-slate-400 text-center pt-2">
                  ধন্যবাদ! যেকোনো প্রয়োজনে সাপোর্ট টিমের সাথে যোগাযোগ করুন: support@shopeers.com
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
