'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  ShoppingCart,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  AlertTriangle,
  X,
  User,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  ShieldAlert,
  RefreshCw,
  FileText,
  Tag,
  Check,
  Send,
  RotateCcw,
  Printer,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

interface OrderItem {
  id: string;
  productVariantId: string;
  variantSku?: string;
  variantName?: string;
  productName?: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}

interface OrderHistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  reason?: string | null;
  changedBy?: string | null;
  createdAt: string;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled' | 'on_hold' | 'returned';
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
  source: 'manual' | 'facebook' | 'instagram' | 'whatsapp' | 'website' | 'phone';
  subtotalMinor: number;
  deliveryChargeMinor: number;
  discountMinor: number;
  totalMinor: number;
  hasDuplicateWarning: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | 'insufficient_data' | 'manual_review_required' | null;
  riskScore?: number | null;
  riskDecision?: 'approved' | 'rejected' | 'flagged' | null;
  riskDecisionReason?: string | null;
  riskDecidedBy?: string | null;
  internalNotes?: string | null;
  customerNotes?: string | null;
  cancelReason?: string | null;
  holdReason?: string | null;
  createdAt: string;
  customer?: {
    id: string;
    fullName?: string | null;
    phone: string;
    totalOrdersCount?: number;
    deliveredOrdersCount?: number;
    deliveredRate?: number;
  } | null;
  shippingAddress?: {
    id: string;
    division?: string | null;
    district?: string | null;
    addressLine1?: string | null;
  } | null;
  items: OrderItem[];
  statusHistory: OrderHistoryItem[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.['id'] as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Modal State for Hold / Cancel Reason
  const [modalType, setModalType] = useState<'hold' | 'cancel' | null>(null);
  const [modalReason, setModalReason] = useState('');

  // Risk Review & Re-eval State
  const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
  const [riskDecision, setRiskDecision] = useState<'approved' | 'rejected' | 'flagged'>('approved');
  const [riskDecisionReason, setRiskDecisionReason] = useState('');
  const [reEvaluatingRisk, setReEvaluatingRisk] = useState(false);

  // Courier & Shipment State (M5)
  const [courierAccounts, setCourierAccounts] = useState<any[]>([]);
  const [activeShipment, setActiveShipment] = useState<any | null>(null);
  const [shipmentEvents, setShipmentEvents] = useState<any[]>([]);
  const [isCourierModalOpen, setIsCourierModalOpen] = useState(false);
  const [selectedCourierAccountId, setSelectedCourierAccountId] = useState('');
  const [courierNotes, setCourierNotes] = useState('');
  const [dispatchingCourier, setDispatchingCourier] = useState(false);
  const [trackingShipment, setTrackingShipment] = useState(false);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [reconcileAction, setReconcileAction] = useState<'confirm_found' | 'mark_cancelled'>('confirm_found');
  const [reconcileConsignmentId, setReconcileConsignmentId] = useState('');
  const [reconcileTrackingCode, setReconcileTrackingCode] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [showEventsTimeline, setShowEventsTimeline] = useState(false);

  const fetchOrder = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await api.get(`/orders/${orderId}`);
      setOrder(res);
    } catch (err: any) {
      console.warn('Could not fetch order from API, using demo fallback:', err);
      // Demo Fallback
      setOrder({
        id: orderId,
        orderNumber: 'ORD-1002',
        orderStatus: 'pending',
        paymentStatus: 'unpaid',
        source: 'facebook',
        subtotalMinor: 216000,
        deliveryChargeMinor: 12000,
        discountMinor: 0,
        totalMinor: 228000,
        hasDuplicateWarning: true,
        internalNotes: 'Customer requested evening delivery',
        createdAt: new Date().toISOString(),
        customer: {
          id: 'cust-1',
          fullName: 'Nusrat Jahan',
          phone: '+8801819998877',
          totalOrdersCount: 4,
          deliveredOrdersCount: 4,
          deliveredRate: 100,
        },
        shippingAddress: {
          id: 'addr-1',
          division: 'Chittagong',
          district: 'Chittagong',
          addressLine1: 'GEC Circle, Nasirabad Housing Society, Flat 4B',
        },
        items: [
          {
            id: 'item-1',
            productVariantId: 'v-2',
            variantSku: 'CSH-CRM-M',
            variantName: 'Cashmere Knit Sweater (Cream / M)',
            productName: 'Cashmere Knit Sweater',
            quantity: 2,
            unitPriceMinor: 108000,
            totalMinor: 216000,
          },
        ],
        statusHistory: [
          {
            id: 'h-1',
            fromStatus: null,
            toStatus: 'pending',
            reason: 'Order created via Quick Order Intake',
            changedBy: 'Staff Admin',
            createdAt: new Date().toISOString(),
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchShipment = async () => {
    if (!orderId) return;
    try {
      const res = await api.get(`/couriers/shipments?orderId=${orderId}`);
      if (Array.isArray(res) && res.length > 0) {
        setActiveShipment(res[0]);
        const eventsRes = await api.get(`/couriers/shipments/${res[0].id}/events`);
        setShipmentEvents(Array.isArray(eventsRes) ? eventsRes : []);
      } else {
        setActiveShipment(null);
        setShipmentEvents([]);
      }
    } catch {
      // ignore
    }
  };

  const fetchCourierAccounts = async () => {
    try {
      const res = await api.get('/couriers/accounts');
      if (Array.isArray(res)) {
        setCourierAccounts(res);
        if (res.length > 0) {
          const defaultAcc = res.find((a: any) => a.isDefault) || res[0];
          setSelectedCourierAccountId(defaultAcc.id);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchOrder();
    fetchShipment();
    fetchCourierAccounts();
  }, [orderId]);

  const handleDispatchCourier = async () => {
    if (!order || !selectedCourierAccountId) {
      setNotification({ message: 'Please select a courier account', type: 'error' });
      return;
    }
    try {
      setDispatchingCourier(true);
      const res = await api.post('/couriers/shipments/dispatch', {
        orderId: order.id,
        courierAccountId: selectedCourierAccountId,
        notes: courierNotes.trim() || undefined,
      });

      if (res.isAmbiguousTimeout) {
        setNotification({
          message: 'Courier request timed out. Please check reconciliation status before retrying.',
          type: 'error',
        });
      } else {
        setNotification({
          message: `Order successfully dispatched to courier! Tracking Code: ${res.shipment?.trackingCode || 'N/A'}`,
          type: 'success',
        });
      }
      setIsCourierModalOpen(false);
      fetchOrder();
      fetchShipment();
    } catch (err: any) {
      setNotification({ message: err.message || 'Courier dispatch failed', type: 'error' });
    } finally {
      setDispatchingCourier(false);
    }
  };

  const handleTrackShipment = async () => {
    if (!activeShipment) return;
    try {
      setTrackingShipment(true);
      const res = await api.get(`/couriers/shipments/${activeShipment.id}/track`);
      setActiveShipment(res.shipment);
      setShipmentEvents(res.events || []);
      if (res.terminalRegressionBlocked) {
        setNotification({
          message: 'Parcel is already in a terminal state (delivered/returned). Status change ignored.',
          type: 'error',
        });
      } else {
        setNotification({
          message: `Live tracking updated: ${res.shipment.shipmentStatus}`,
          type: 'success',
        });
      }
      fetchOrder();
    } catch (err: any) {
      setNotification({ message: err.message || 'Tracking failed', type: 'error' });
    } finally {
      setTrackingShipment(false);
    }
  };

  const handleReconcile = async () => {
    if (!activeShipment) return;
    try {
      setReconciling(true);
      await api.post(`/couriers/shipments/${activeShipment.id}/reconcile`, {
        action: reconcileAction,
        consignmentId: reconcileConsignmentId.trim() || undefined,
        trackingCode: reconcileTrackingCode.trim() || undefined,
      });
      setNotification({
        message: reconcileAction === 'confirm_found'
          ? 'Shipment confirmed found on courier and marked pending'
          : 'Timed-out shipment marked cancelled. Order released for re-dispatch.',
        type: 'success',
      });
      setIsReconcileModalOpen(false);
      fetchOrder();
      fetchShipment();
    } catch (err: any) {
      setNotification({ message: err.message || 'Reconciliation failed', type: 'error' });
    } finally {
      setReconciling(false);
    }
  };

  // Transition handler
  const handleTransition = async (toStatus: string, reason?: string) => {
    if (!order) return;
    try {
      setActionLoading(true);
      const res = await api.patch(`/orders/${order.id}/status`, {
        toStatus,
        reason: reason || undefined,
      });

      setNotification({
        message: `Order transitioned to ${toStatus.replace('_', ' ')} successfully!`,
        type: 'success',
      });
      setModalType(null);
      setModalReason('');
      fetchOrder();
    } catch (err: any) {
      setNotification({ message: err.message || 'Transition failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel handler
  const handleCancel = async () => {
    if (!order || !modalReason.trim()) {
      setNotification({ message: 'Please provide a cancellation reason', type: 'error' });
      return;
    }
    try {
      setActionLoading(true);
      await api.patch(`/orders/${order.id}/cancel`, {
        reason: modalReason.trim(),
      });
      setNotification({ message: 'Order cancelled and reserved stock released.', type: 'success' });
      setModalType(null);
      setModalReason('');
      fetchOrder();
    } catch (err: any) {
      setNotification({ message: err.message || 'Cancel failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // Hold handler
  const handleHold = async () => {
    if (!order || !modalReason.trim()) {
      setNotification({ message: 'Please provide a reason for placing order on hold', type: 'error' });
      return;
    }
    try {
      setActionLoading(true);
      await api.patch(`/orders/${order.id}/hold`, {
        reason: modalReason.trim(),
      });
      setNotification({ message: 'Order placed on hold.', type: 'success' });
      setModalType(null);
      setModalReason('');
      fetchOrder();
    } catch (err: any) {
      setNotification({ message: err.message || 'Hold failed', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewRisk = async () => {
    if (!order || !riskDecisionReason.trim()) {
      setNotification({ message: 'Please provide a reason for the review decision', type: 'error' });
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/risk/orders/${order.id}/review`, {
        decision: riskDecision,
        decisionReason: riskDecisionReason.trim(),
      });
      setNotification({ message: `Risk review recorded: decision set to ${riskDecision}`, type: 'success' });
      setIsRiskModalOpen(false);
      setRiskDecisionReason('');
      fetchOrder();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to record risk review', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReevaluateRisk = async () => {
    if (!order || !order.customer?.phone) {
      setNotification({ message: 'Order customer has no phone number', type: 'error' });
      return;
    }
    try {
      setReEvaluatingRisk(true);
      await api.post('/risk/check', {
        phone: order.customer.phone,
        orderId: order.id,
        skipCache: true,
      });
      setNotification({ message: 'Live customer risk re-evaluation completed!', type: 'success' });
      fetchOrder();
    } catch (err: any) {
      setNotification({ message: err.message || 'Risk re-evaluation failed', type: 'error' });
    } finally {
      setReEvaluatingRisk(false);
    }
  };

  const formatTaka = (paisaMinor: number) => {
    return `৳${(paisaMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Confirmed (Stock Reserved)
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Processing
          </span>
        );
      case 'ready_to_ship':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Ready to Ship
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
            <Truck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Shipped
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Delivered
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60">
            <Clock className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
            On Hold
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
            <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Cancelled
          </span>
        );
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100">{status}</span>;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] transition-colors">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
          {/* Back link */}
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Orders List</span>
          </Link>

          {/* Toast Notification */}
          {notification && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between text-sm font-medium border shadow-sm animate-in fade-in duration-150 ${
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
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading || !order ? (
            <div className="py-24 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
              <p className="text-sm font-semibold">Loading order details...</p>
            </div>
          ) : (
            <>
              {/* Duplicate Order Warning Banner */}
              {order.hasDuplicateWarning && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/70 rounded-2xl flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                      Duplicate Order Warning Detected (24-Hour Window)
                    </h3>
                    <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-0.5">
                      This customer placed another order with the same phone number within the last 24 hours. Call the buyer before dispatching to prevent duplicate shipments and COD return costs.
                    </p>
                  </div>
                </div>
              )}

              {/* Order Header & Action Buttons */}
              <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                      Order #{order.orderNumber}
                    </h1>
                    {getStatusBadge(order.orderStatus)}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>
                      Placed on {new Date(order.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>·</span>
                    <span className="capitalize">Channel: {order.source}</span>
                  </div>
                </div>

                {/* State Machine Action Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {order.orderStatus === 'pending' && (
                    <>
                      <button
                        onClick={() => handleTransition('confirmed')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm & Reserve Stock</span>
                      </button>
                      <button
                        onClick={() => setModalType('hold')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Hold</span>
                      </button>
                      <button
                        onClick={() => setModalType('cancel')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'confirmed' && (
                    <>
                      <button
                        onClick={() => handleTransition('processing')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm transition-all flex items-center gap-2"
                      >
                        <Package className="w-4 h-4" />
                        <span>Start Processing</span>
                      </button>
                      <button
                        onClick={() => setModalType('hold')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                      >
                        Hold
                      </button>
                      <button
                        onClick={() => setModalType('cancel')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                      >
                        Cancel (Release Stock)
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'processing' && (
                    <>
                      <button
                        onClick={() => handleTransition('ready_to_ship')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Ready to Ship</span>
                      </button>
                      <button
                        onClick={() => setModalType('hold')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                      >
                        Hold
                      </button>
                      <button
                        onClick={() => setModalType('cancel')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                      >
                        Cancel (Release Stock)
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'ready_to_ship' && (
                    <>
                      {(!activeShipment || ['cancelled', 'returned', 'failed'].includes(activeShipment.shipmentStatus)) && (
                        <button
                          onClick={() => setIsCourierModalOpen(true)}
                          disabled={actionLoading}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          <span>Send to Steadfast</span>
                        </button>
                      )}

                      {activeShipment?.shipmentStatus === 'unknown_pending_reconciliation' && (
                        <button
                          onClick={() => setIsReconcileModalOpen(true)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all flex items-center gap-2 animate-pulse"
                        >
                          <AlertTriangle className="w-4 h-4" />
                          <span>Reconcile Timed-out Parcel</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleTransition('shipped')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-2"
                      >
                        <Truck className="w-4 h-4" />
                        <span>Mark Shipped</span>
                      </button>
                      <button
                        onClick={() => setModalType('hold')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                      >
                        Hold
                      </button>
                      <button
                        onClick={() => setModalType('cancel')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'shipped' && (
                    <>
                      <button
                        onClick={() => handleTransition('delivered')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Delivered</span>
                      </button>
                      <button
                        onClick={() => handleTransition('returned', 'Returned by courier')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                      >
                        Mark Returned
                      </button>
                    </>
                  )}

                  {order.orderStatus === 'on_hold' && (
                    <>
                      <button
                        onClick={() => handleTransition('confirmed', 'Resumed from hold')}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>Resume to Confirmed</span>
                      </button>
                      <button
                        onClick={() => setModalType('cancel')}
                        disabled={actionLoading}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors"
                      >
                        Cancel Order
                      </button>
                    </>
                  )}
                  {/* Print Document Buttons */}
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                    <a
                      href={`/print/invoice?orderId=${order.id}&format=a4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Invoice (A4)</span>
                    </a>
                    <a
                      href={`/print/invoice?orderId=${order.id}&format=pos_thermal_80mm`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-600" />
                      <span>80mm POS Slip</span>
                    </a>
                    <a
                      href={`/print/packing_slip?orderId=${order.id}&format=a4`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Packing Slip</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* Main Content: 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 Columns: Items & Financials */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Items Card */}
                  <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Order Items ({order.items.length})
                      </h2>
                    </div>

                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200/60 dark:border-slate-800/60 text-slate-400 uppercase tracking-wider text-[11px]">
                          <th className="py-3 px-4">Item & SKU</th>
                          <th className="py-3 px-4 text-center">Qty</th>
                          <th className="py-3 px-4 text-right">Unit Price</th>
                          <th className="py-3 px-4 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40 text-slate-700 dark:text-slate-300">
                        {order.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-3.5 px-4">
                              <span className="font-semibold text-slate-900 dark:text-white block">
                                {item.productName || item.variantName || 'Product Item'}
                              </span>
                              <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                                SKU: {item.variantSku || 'DEFAULT'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-bold text-slate-900 dark:text-white">
                              {item.quantity}
                            </td>
                            <td className="py-3.5 px-4 text-right">{formatTaka(item.unitPriceMinor)}</td>
                            <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                              {formatTaka(item.totalMinor)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Financial Summary */}
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Items Subtotal:</span>
                        <span>{formatTaka(order.subtotalMinor)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500 dark:text-slate-400">
                        <span>Delivery Charge:</span>
                        <span>{formatTaka(order.deliveryChargeMinor)}</span>
                      </div>
                      {order.discountMinor > 0 && (
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                          <span>Discount:</span>
                          <span>-{formatTaka(order.discountMinor)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span>Grand Total:</span>
                        <span className="text-blue-600 dark:text-blue-400 text-base">
                          {formatTaka(order.totalMinor)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Address Card */}
                  <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                    <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      <span>Delivery & Shipping Address</span>
                    </h2>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block mb-0.5">Division:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {order.shippingAddress?.division || 'Dhaka'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block mb-0.5">District:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {order.shippingAddress?.district || 'Dhaka'}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block mb-0.5">Detailed Street Address:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {order.shippingAddress?.addressLine1 || 'Standard delivery address'}
                        </span>
                      </div>
                    </div>

                    {order.internalNotes && (
                      <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/50 rounded-xl text-xs">
                        <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                          Internal Notes:
                        </span>
                        <span className="text-amber-900/80 dark:text-amber-200/80">{order.internalNotes}</span>
                      </div>
                    )}
                  </div>

                  {/* Courier Dispatch & Live Tracking Card (M5) */}
                  <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-black text-xs border border-orange-500/20">
                          SF
                        </div>
                        <div>
                          <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Courier Dispatch & Live Tracking
                          </h2>
                          <span className="text-[11px] text-slate-400 font-medium">Steadfast Courier Bangladesh</span>
                        </div>
                      </div>

                      {activeShipment && (
                        <button
                          onClick={handleTrackShipment}
                          disabled={trackingShipment}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${trackingShipment ? 'animate-spin text-blue-600' : ''}`} />
                          <span>{trackingShipment ? 'Tracking...' : 'Live Track'}</span>
                        </button>
                      )}
                    </div>

                    {!activeShipment ? (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                        <p className="text-xs text-slate-500">
                          This order has not been dispatched to Steadfast yet.
                        </p>
                        <button
                          onClick={() => setIsCourierModalOpen(true)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm inline-flex items-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          <span>Dispatch to Steadfast</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Status & Tracking Details */}
                        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Shipment Status:</span>
                            <span className="font-bold capitalize text-slate-900 dark:text-white flex items-center gap-1.5">
                              {activeShipment.shipmentStatus === 'delivered' ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : activeShipment.shipmentStatus === 'unknown_pending_reconciliation' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              ) : (
                                <Truck className="w-4 h-4 text-blue-500" />
                              )}
                              {activeShipment.shipmentStatus.replace(/_/g, ' ')}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block mb-0.5">Tracking Code:</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-white">
                              {activeShipment.trackingCode || 'Pending Assignment'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block mb-0.5">Consignment ID:</span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                              {activeShipment.consignmentId || 'N/A'}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block mb-0.5">COD Amount:</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatTaka(activeShipment.codAmountMinor)}
                            </span>
                          </div>
                        </div>

                        {/* Ambiguous Timeout Alert */}
                        {activeShipment.shipmentStatus === 'unknown_pending_reconciliation' && (
                          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Dispatch Request Timed Out</span>
                            </div>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                              A network timeout occurred while sending this order to the courier. Please reconcile before re-attempting dispatch.
                            </p>
                            <button
                              onClick={() => setIsReconcileModalOpen(true)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5"
                            >
                              <span>Reconcile Shipment</span>
                            </button>
                          </div>
                        )}

                        {/* Toggleable Audit Timeline */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowEventsTimeline(!showEventsTimeline)}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <span>{showEventsTimeline ? 'Hide Tracking History' : `View Tracking Audit History (${shipmentEvents.length} events)`}</span>
                          </button>

                          {showEventsTimeline && (
                            <div className="mt-3 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {shipmentEvents.length === 0 ? (
                                <p className="text-xs text-slate-400">No events recorded yet.</p>
                              ) : (
                                shipmentEvents.map((ev) => (
                                  <div key={ev.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-xs flex justify-between items-start">
                                    <div>
                                      <span className="font-bold text-slate-800 dark:text-slate-200 block">
                                        {ev.normalizedStatus.replace(/_/g, ' ')}
                                      </span>
                                      <span className="text-[11px] text-slate-500 block mt-0.5">
                                        {ev.note || `Provider status: ${ev.providerStatus}`}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {new Date(ev.eventTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Customer Profile & Timeline */}
                <div className="space-y-6">
                  {/* Customer Risk & Delivery Shield Card */}
                  <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-600" />
                        <span>Risk & Delivery Shield</span>
                      </h2>
                      <button
                        onClick={handleReevaluateRisk}
                        disabled={reEvaluatingRisk}
                        className="text-[11px] font-semibold text-blue-600 hover:underline flex items-center gap-1"
                        title="Live risk evaluation"
                      >
                        <RefreshCw className={`w-3 h-3 ${reEvaluatingRisk ? 'animate-spin' : ''}`} />
                        <span>Re-evaluate</span>
                      </button>
                    </div>

                    {/* Risk Badge & Score Meter */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Assessment:</span>
                        {/* Dynamic risk badge */}
                        {order.riskDecision === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                            Manager Approved
                          </span>
                        ) : order.riskDecision === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                            <ShieldX className="w-3.5 h-3.5 text-rose-500" />
                            Manager Rejected
                          </span>
                        ) : order.riskLevel === 'high' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            High Risk Order
                          </span>
                        ) : order.riskLevel === 'medium' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            Medium Risk
                          </span>
                        ) : order.riskLevel === 'low' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Low Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            New / Low Data
                          </span>
                        )}
                      </div>

                      {/* Score Bar */}
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-500">Risk Score Index:</span>
                          <span className="font-bold font-mono text-slate-900 dark:text-white">
                            {order.riskScore ?? 50}/100
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              (order.riskScore ?? 50) >= 70
                                ? 'bg-rose-500'
                                : (order.riskScore ?? 50) >= 35
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(order.riskScore ?? 50, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Review Reason Details if previously overridden */}
                      {order.riskDecisionReason && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px]">
                          <span className="text-slate-400 block font-semibold">Review Override Note:</span>
                          <span className="text-slate-700 dark:text-slate-300">{order.riskDecisionReason}</span>
                        </div>
                      )}
                    </div>

                    {/* Override Button */}
                    <button
                      onClick={() => setIsRiskModalOpen(true)}
                      className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      <span>Review / Override Risk</span>
                    </button>
                  </div>

                  {/* Customer CRM Card */}
                  <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-600" />
                        <span>Customer Profile</span>
                      </h2>
                      {order.customer && (
                        <Link
                          href={`/customers`}
                          className="text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          CRM Profile →
                        </Link>
                      )}
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-400 block">Name:</span>
                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                          {order.customer?.fullName || 'Walk-in Customer'}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-400 block">Phone:</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {order.customer?.phone || 'No phone'}
                        </span>
                      </div>

                      {order.customer && (
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] text-slate-400 block">Total Orders</span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {order.customer.totalOrdersCount || 1}
                            </span>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl text-center">
                            <span className="text-[10px] text-slate-400 block">Delivered Rate</span>
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              {order.customer.deliveredRate ?? 100}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Status History Timeline */}
                  <div className="bg-white dark:bg-[#121826] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-4">
                    <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>Status Audit Timeline</span>
                    </h2>

                    <div className="space-y-4 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                      {order.statusHistory.map((item, idx) => (
                        <div key={item.id} className="relative pl-7 text-xs">
                          <div className="absolute left-1.5 top-1.5 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-[#121826]" />
                          <div className="flex items-center justify-between">
                            <span className="font-bold capitalize text-slate-900 dark:text-white">
                              {item.toStatus.replace('_', ' ')}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {item.reason && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {item.reason}
                            </p>
                          )}
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            By {item.changedBy || 'System / Staff'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* REASON MODAL (HOLD OR CANCEL) */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setModalType(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#121826] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 z-10 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {modalType === 'hold' ? 'Place Order On Hold' : 'Cancel Order & Release Stock'}
              </h3>
              <button onClick={() => setModalType(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {modalType === 'hold'
                ? 'Please specify a reason for putting this order on hold. The order will be paused until resumed.'
                : 'Cancelling this order will release all atomically reserved warehouse stock and record a cancellation log.'}
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason *
              </label>
              <textarea
                rows={3}
                placeholder={
                  modalType === 'hold'
                    ? 'e.g. Customer requested delivery on next Monday'
                    : 'e.g. Customer unreachable / Changed mind'
                }
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={modalType === 'hold' ? handleHold : handleCancel}
                disabled={actionLoading || !modalReason.trim()}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm disabled:opacity-50 transition-all ${
                  modalType === 'hold' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading ? 'Processing...' : modalType === 'hold' ? 'Confirm Hold' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RISK REVIEW MODAL */}
      {isRiskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121826] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Manual Risk Review & Override</span>
              </h3>
              <button
                onClick={() => setIsRiskModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Provide authorization to approve or flag this order. An immutable audit record will be logged with your user credentials.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Manager Decision
                </label>
                <select
                  value={riskDecision}
                  onChange={(e) => setRiskDecision(e.target.value as any)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="approved">Approve Order (Permit Fulfillment)</option>
                  <option value="rejected">Reject Order (Fraud / High Risk Refusal)</option>
                  <option value="flagged">Flag for Supervisor Follow-Up</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Mandatory Justification / Reason
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Spoke with customer on WhatsApp; verified full delivery address and confirmed advance bKash payment."
                  value={riskDecisionReason}
                  onChange={(e) => setRiskDecisionReason(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRiskModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReviewRisk}
                disabled={actionLoading || !riskDecisionReason.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
              >
                {actionLoading ? 'Recording...' : 'Submit Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND TO STEADFAST MODAL (M5) */}
      {isCourierModalOpen && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121826] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-black text-sm border border-orange-500/20">
                  SF
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Dispatch to Steadfast Courier</h3>
                  <p className="text-xs text-slate-500">Order #{order.orderNumber} • Cash on Delivery</p>
                </div>
              </div>
              <button onClick={() => setIsCourierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Recipient Details Preview */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Name:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{order.customer?.fullName || 'Valued Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mobile Phone:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{order.customer?.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {order.shippingAddress?.addressLine1 || 'Dhaka, Bangladesh'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 font-bold">
                  <span className="text-slate-600 dark:text-slate-300">COD Collection Amount:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 text-sm">{formatTaka(order.totalMinor)}</span>
                </div>
              </div>

              {/* Courier Account Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Steadfast Courier Account
                </label>
                {courierAccounts.length === 0 ? (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                    No active courier account found. Configure your API keys in <Link href="/settings/couriers" className="font-bold underline">Courier Settings</Link> first.
                  </div>
                ) : (
                  <select
                    value={selectedCourierAccountId}
                    onChange={(e) => setSelectedCourierAccountId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {courierAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountName} ({acc.courierCode.toUpperCase()}) {acc.isDefault ? '• Default' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Special Instructions / Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Notes for Rider (Optional)
                </label>
                <input
                  type="text"
                  value={courierNotes}
                  onChange={(e) => setCourierNotes(e.target.value)}
                  placeholder="e.g. Call before delivery / Fragile item"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCourierModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDispatchCourier}
                disabled={dispatchingCourier || courierAccounts.length === 0}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white shadow-sm shadow-orange-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {dispatchingCourier && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{dispatchingCourier ? 'Sending to Steadfast...' : 'Confirm & Dispatch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECONCILE TIMED-OUT SHIPMENT MODAL */}
      {isReconcileModalOpen && activeShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#121826] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Reconcile Timeout Shipment</h3>
              </div>
              <button onClick={() => setIsReconcileModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              The order dispatch request encountered an ambiguous network timeout. Check your Steadfast merchant dashboard to see if this parcel was created.
            </p>

            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                <input
                  type="radio"
                  name="reconcileAction"
                  value="confirm_found"
                  checked={reconcileAction === 'confirm_found'}
                  onChange={() => setReconcileAction('confirm_found')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Parcel Found on Steadfast
                  </span>
                  <span className="text-[11px] text-slate-400">
                    The parcel was successfully created. Link the tracking code or consignment ID to resume live tracking.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900">
                <input
                  type="radio"
                  name="reconcileAction"
                  value="mark_cancelled"
                  checked={reconcileAction === 'mark_cancelled'}
                  onChange={() => setReconcileAction('mark_cancelled')}
                  className="mt-0.5 text-rose-600"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Parcel NOT Created on Steadfast
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Safely cancel this timed-out record and unlock the order for safe re-dispatch.
                  </span>
                </div>
              </label>

              {reconcileAction === 'confirm_found' && (
                <div className="space-y-2 pt-2 animate-in fade-in">
                  <input
                    type="text"
                    value={reconcileConsignmentId}
                    onChange={(e) => setReconcileConsignmentId(e.target.value)}
                    placeholder="Steadfast Consignment ID (e.g. CID-12345)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                  <input
                    type="text"
                    value={reconcileTrackingCode}
                    onChange={(e) => setReconcileTrackingCode(e.target.value)}
                    placeholder="Steadfast Tracking Code (e.g. SF-TRK-12345)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReconcileModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleReconcile}
                disabled={reconciling}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2"
              >
                {reconciling && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Reconciliation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
