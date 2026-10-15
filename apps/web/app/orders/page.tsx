'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { api } from '../../lib/api';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  AlertTriangle,
  X,
  ChevronRight,
  User,
  Phone,
  MapPin,
  DollarSign,
  ArrowUpDown,
  Calendar,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Check,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Printer,
} from 'lucide-react';
import {
  BANGLADESH_DIVISIONS,
  getDistrictsByDivision,
  normalizeBdPhone,
} from '@growthomic/shared';

interface OrderItem {
  id?: string;
  productVariantId: string;
  variantSku?: string;
  variantName?: string;
  productName?: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}

interface Order {
  id: string;
  orderNumber: string;
  orderStatus: 'pending' | 'confirmed' | 'processing' | 'ready_to_ship' | 'shipped' | 'delivered' | 'cancelled' | 'on_hold' | 'returned';
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid' | 'refunded';
  source: 'manual' | 'facebook' | 'instagram' | 'whatsapp' | 'website' | 'phone';
  totalMinor: number;
  subtotalMinor: number;
  deliveryChargeMinor: number;
  discountMinor: number;
  hasDuplicateWarning: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | 'insufficient_data' | 'manual_review_required' | null;
  riskScore?: number | null;
  riskDecision?: 'approved' | 'rejected' | 'flagged' | null;
  createdAt: string;
  customer?: {
    id: string;
    fullName?: string | null;
    phone: string;
  } | null;
  shippingAddress?: {
    division?: string | null;
    district?: string | null;
    addressLine1?: string | null;
  } | null;
  items?: OrderItem[];
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Quick Order Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productsList, setProductsList] = useState<any[]>([]);

  // Quick Order Form State
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);

  // Address
  const [selectedDivision, setSelectedDivision] = useState('Dhaka');
  const [selectedDistrict, setSelectedDistrict] = useState('Dhaka');
  const [streetAddress, setStreetAddress] = useState('');

  // Items
  const [orderItems, setOrderItems] = useState<Array<{ variantId: string; name: string; sku: string; priceMinor: number; quantity: number }>>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');

  // Financials & Options
  const [deliveryCharge, setDeliveryCharge] = useState(60); // ৳60 inside Dhaka
  const [discount, setDiscount] = useState(0);
  const [orderSource, setOrderSource] = useState<'facebook' | 'instagram' | 'whatsapp' | 'phone' | 'manual'>('facebook');
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [internalNotes, setInternalNotes] = useState('');

  // Available districts for chosen division
  const availableDistricts = useMemo(() => {
    return getDistrictsByDivision(selectedDivision);
  }, [selectedDivision]);

  // Handle division change to adjust district and default delivery charge
  const handleDivisionChange = (division: string) => {
    setSelectedDivision(division);
    const districts = getDistrictsByDivision(division);
    if (districts.length > 0 && districts[0]) {
      setSelectedDistrict(districts[0].name);
    }
    // Inside Dhaka vs Outside Dhaka standard courier charge
    if (division.toLowerCase() === 'dhaka') {
      setDeliveryCharge(60);
    } else {
      setDeliveryCharge(120);
    }
  };

  // Fetch orders and catalog
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get(`/orders?${params.toString()}`);
      setOrders(res.items || []);
    } catch (err: any) {
      console.warn('Backend unavailable, using initial demo orders:', err);
      // Fallback demo dataset
      setOrders([
        {
          id: 'ord-demo-1',
          orderNumber: 'ORD-1001',
          orderStatus: 'pending',
          paymentStatus: 'unpaid',
          source: 'facebook',
          totalMinor: 145000,
          subtotalMinor: 139000,
          deliveryChargeMinor: 6000,
          discountMinor: 0,
          hasDuplicateWarning: false,
          createdAt: new Date().toISOString(),
          customer: {
            id: 'c-1',
            fullName: 'Rafiqul Islam',
            phone: '+8801712345678',
          },
          shippingAddress: {
            division: 'Dhaka',
            district: 'Dhaka',
            addressLine1: 'House 42, Road 11, Banani',
          },
          items: [
            {
              productVariantId: 'v-1',
              variantSku: 'WPK-BLK-L',
              variantName: 'Windproof Winter Parka (Black / L)',
              quantity: 1,
              unitPriceMinor: 139000,
              totalMinor: 139000,
            },
          ],
        },
        {
          id: 'ord-demo-2',
          orderNumber: 'ORD-1002',
          orderStatus: 'confirmed',
          paymentStatus: 'unpaid',
          source: 'whatsapp',
          totalMinor: 228000,
          subtotalMinor: 216000,
          deliveryChargeMinor: 12000,
          discountMinor: 0,
          hasDuplicateWarning: true,
          createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
          customer: {
            id: 'c-2',
            fullName: 'Nusrat Jahan',
            phone: '+8801819998877',
          },
          shippingAddress: {
            division: 'Chittagong',
            district: 'Chittagong',
            addressLine1: 'GEC Circle, Nasirabad',
          },
          items: [
            {
              productVariantId: 'v-2',
              variantSku: 'CSH-CRM-M',
              variantName: 'Cashmere Knit Sweater (Cream / M)',
              quantity: 2,
              unitPriceMinor: 108000,
              totalMinor: 216000,
            },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsCatalog = async () => {
    try {
      const res = await api.get('/products?limit=100');
      const flattened: any[] = [];
      (res.items || []).forEach((prod: any) => {
        (prod.variants || []).forEach((v: any) => {
          flattened.push({
            variantId: v.id,
            name: `${prod.name} (${v.name || v.sku})`,
            sku: v.sku,
            priceMinor: v.retailPrice,
            onHand: v.onHand || 0,
            available: v.available || 0,
          });
        });
      });
      setProductsList(flattened);
      if (flattened.length > 0 && !selectedVariantId) {
        setSelectedVariantId(flattened[0].variantId);
      }
    } catch (err) {
      console.warn('Could not load products catalog for drawer:', err);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchProductsCatalog();
  }, [statusFilter, sourceFilter]);

  // Phone auto-lookup
  const handlePhoneChange = async (val: string) => {
    setCustomerPhone(val);
    const norm = normalizeBdPhone(val);
    setPhoneValid(norm.isValid);

    if (norm.isValid && norm.e164) {
      try {
        setPhoneLookupLoading(true);
        const res = await api.get(`/customers/lookup?phone=${encodeURIComponent(norm.e164)}`);
        if (res && res.id) {
          setCustomerId(res.id);
          if (res.fullName && !customerName) {
            setCustomerName(res.fullName);
          }
          if (res.addresses && res.addresses.length > 0) {
            const addr = res.addresses[0];
            if (addr.division) setSelectedDivision(addr.division);
            if (addr.district) setSelectedDistrict(addr.district);
            if (addr.addressLine1) setStreetAddress(addr.addressLine1);
          }
        }
      } catch (err) {
        // Customer not found, new customer flow
        setCustomerId(null);
      } finally {
        setPhoneLookupLoading(false);
      }
    } else {
      setCustomerId(null);
    }
  };

  // Add Item to quick order
  const handleAddItem = () => {
    if (!selectedVariantId) return;
    const selected = productsList.find((p) => p.variantId === selectedVariantId);
    if (!selected) return;

    setOrderItems((prev) => {
      const existing = prev.find((item) => item.variantId === selectedVariantId);
      if (existing) {
        return prev.map((item) =>
          item.variantId === selectedVariantId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          variantId: selected.variantId,
          name: selected.name,
          sku: selected.sku,
          priceMinor: selected.priceMinor,
          quantity: 1,
        },
      ];
    });
  };

  const handleRemoveItem = (variantId: string) => {
    setOrderItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const handleUpdateItemQty = (variantId: string, delta: number) => {
    setOrderItems((prev) =>
      prev
        .map((i) => {
          if (i.variantId === variantId) {
            const newQty = Math.max(1, i.quantity + delta);
            return { ...i, quantity: newQty };
          }
          return i;
        })
        .filter((i) => i.quantity > 0)
    );
  };

  // Calculations
  const calculatedSubtotal = useMemo(() => {
    return orderItems.reduce((acc, item) => acc + item.priceMinor * item.quantity, 0);
  }, [orderItems]);

  const calculatedTotal = useMemo(() => {
    const sub = calculatedSubtotal;
    const del = deliveryCharge * 100;
    const disc = discount * 100;
    return Math.max(0, sub + del - disc);
  }, [calculatedSubtotal, deliveryCharge, discount]);

  // Handle Quick Order Create
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim()) {
      setNotification({ message: 'Please enter customer phone number', type: 'error' });
      return;
    }
    if (orderItems.length === 0) {
      setNotification({ message: 'Please add at least one product item', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        customer: {
          fullName: customerName.trim() || undefined,
          phone: customerPhone.trim(),
        },
        shippingAddress: {
          division: selectedDivision,
          district: selectedDistrict,
          addressLine1: streetAddress.trim() || undefined,
        },
        items: orderItems.map((item) => ({
          productVariantId: item.variantId,
          quantity: item.quantity,
          unitPriceMinor: item.priceMinor,
        })),
        source: orderSource,
        deliveryChargeMinor: deliveryCharge * 100,
        discountMinor: discount * 100,
        initialStatus: autoConfirm ? 'confirmed' : 'pending',
        internalNotes: internalNotes.trim() || undefined,
      };

      const res = await api.post('/orders', payload);
      setNotification({
        message: `Order #${res.orderNumber} successfully created${autoConfirm ? ' and stock reserved' : ''}!`,
        type: 'success',
      });

      // Reset form and close drawer
      setIsDrawerOpen(false);
      setCustomerPhone('');
      setCustomerName('');
      setStreetAddress('');
      setOrderItems([]);
      setInternalNotes('');
      fetchOrders();
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to create order', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk actions
  const handleBulkAction = async (action: 'confirm' | 'ready_to_ship' | 'cancel') => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await api.post('/orders/bulk-action', {
        orderIds: selectedOrderIds,
        action,
        reason: action === 'cancel' ? 'Bulk cancelled by seller' : undefined,
      });
      setNotification({
        message: `Bulk ${action} processed: ${res.successful} succeeded, ${res.failed} failed.`,
        type: res.failed === 0 ? 'success' : 'error',
      });
      setSelectedOrderIds([]);
      fetchOrders();
    } catch (err: any) {
      setNotification({ message: err.message || 'Bulk operation failed', type: 'error' });
    }
  };

  // Toggle selection
  const toggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === orders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map((o) => o.id));
    }
  };

  // Status Badge Helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pending
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Confirmed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Processing
          </span>
        );
      case 'ready_to_ship':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Ready to Ship
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
            <Truck className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            Shipped
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            Delivered
          </span>
        );
      case 'on_hold':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/60">
            <Clock className="w-3 h-3 text-orange-600 dark:text-orange-400" />
            On Hold
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60">
            <X className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  const getSourceBadge = (source: string) => {
    const s = source?.toLowerCase() || 'manual';
    if (s === 'facebook') return <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md">FB</span>;
    if (s === 'whatsapp') return <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">WA</span>;
    if (s === 'instagram') return <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/50 px-2 py-0.5 rounded-md">IG</span>;
    return <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">Manual</span>;
  };

  const getRiskBadge = (riskLevel?: string | null, score?: number | null, decision?: string | null) => {
    if (decision === 'approved') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800" title="Manually approved by manager">
          <ShieldCheck className="w-3 h-3 text-blue-500" />
          <span>Approved</span>
        </span>
      );
    }
    if (decision === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800" title="Manually rejected by manager">
          <ShieldX className="w-3 h-3 text-rose-500" />
          <span>Rejected</span>
        </span>
      );
    }
    switch (riskLevel) {
      case 'low':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Low Risk</span>
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>Medium</span>
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/80 animate-pulse">
            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            <span>High Risk</span>
          </span>
        );
      case 'manual_review_required':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/60">
            <AlertTriangle className="w-3 h-3 text-purple-600" />
            <span>Review</span>
          </span>
        );
      case 'insufficient_data':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60" title="Order count below threshold or new customer">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <span>New Customer</span>
          </span>
        );
    }
  };

  // Format Paisa to Taka
  const formatTaka = (paisaMinor: number) => {
    return `৳${(paisaMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Summary counts
  const summary = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.orderStatus === 'pending').length;
    const confirmed = orders.filter((o) => o.orderStatus === 'confirmed' || o.orderStatus === 'processing').length;
    const shipped = orders.filter((o) => o.orderStatus === 'shipped' || o.orderStatus === 'ready_to_ship').length;
    const delivered = orders.filter((o) => o.orderStatus === 'delivered').length;
    const cancelled = orders.filter((o) => o.orderStatus === 'cancelled').length;
    return { total, pending, confirmed, shipped, delivered, cancelled };
  }, [orders]);

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] transition-colors">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
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
              <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header & Quick Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Order Management & CRM
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                F-Commerce order intake, Bangladesh division dispatch, stock reservations, and duplicate fraud alerts.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchOrders}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Quick Order Intake</span>
              </button>
            </div>
          </div>

          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Total Orders
              </span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.total}
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">All channels</span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider block mb-1">
                Pending
              </span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.pending}
              </div>
              <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1 block">Awaiting confirm</span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider block mb-1">
                Confirmed / Pack
              </span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.confirmed}
              </div>
              <span className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1 block">Stock reserved</span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-indigo-500 uppercase tracking-wider block mb-1">
                In Transit / Courier
              </span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.shipped}
              </div>
              <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-1 block">Dispatched</span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider block mb-1">
                Delivered
              </span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.delivered}
              </div>
              <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">Successful COD</span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider block mb-1">
                Cancelled
              </span>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {summary.cancelled}
              </div>
              <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1 block">Released stock</span>
            </div>
          </div>

          {/* Filters Bar & Status Pills */}
          <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by order #, phone, customer name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Channel:</span>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">All Channels</option>
                  <option value="facebook">Facebook Shop</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="instagram">Instagram</option>
                  <option value="phone">Phone Call</option>
                  <option value="manual">Manual Entry</option>
                </select>
              </div>
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin border-t border-slate-100 dark:border-slate-800/60 pt-3">
              {[
                { label: 'All', value: 'all' },
                { label: 'Pending', value: 'pending' },
                { label: 'Confirmed', value: 'confirmed' },
                { label: 'Processing', value: 'processing' },
                { label: 'Ready to Ship', value: 'ready_to_ship' },
                { label: 'Shipped', value: 'shipped' },
                { label: 'Delivered', value: 'delivered' },
                { label: 'On Hold', value: 'on_hold' },
                { label: 'Cancelled', value: 'cancelled' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    statusFilter === tab.value
                      ? 'bg-blue-600 text-white font-semibold shadow-sm shadow-blue-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Action Bar (if rows selected) */}
          {selectedOrderIds.length > 0 && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center justify-between animate-in fade-in duration-150">
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {selectedOrderIds.length} orders selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('confirm')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Confirm Orders
                </button>
                <button
                  onClick={() => handleBulkAction('ready_to_ship')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
                >
                  Mark Ready to Ship
                </button>
                <button
                  onClick={() => handleBulkAction('cancel')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
                >
                  Cancel Orders
                </button>
                <a
                  href={`/print/invoice?orderIds=${selectedOrderIds.join(',')}&format=a4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Bulk Print Invoices</span>
                </a>
                <button
                  onClick={() => setSelectedOrderIds([])}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Orders Table */}
          <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="p-4 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="py-4 px-3">Order # & Source</th>
                    <th className="py-4 px-3">Customer & Phone</th>
                    <th className="py-4 px-3">Delivery Area</th>
                    <th className="py-4 px-3">Items</th>
                    <th className="py-4 px-3">Total Amount</th>
                    <th className="py-4 px-3">Risk Protection</th>
                    <th className="py-4 px-3">Order Status</th>
                    <th className="py-4 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <span>Loading orders...</span>
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No orders found</p>
                        <p className="text-xs text-slate-400 mt-1">Click "Quick Order Intake" to record your first sale.</p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => {
                      const isSelected = selectedOrderIds.includes(order.id);
                      return (
                        <tr
                          key={order.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectOrder(order.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/orders/${order.id}`}
                                className="font-bold text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                {order.orderNumber}
                              </Link>
                              {getSourceBadge(order.source)}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {new Date(order.createdAt).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {order.hasDuplicateWarning && (
                              <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="w-2.5 h-2.5" />
                                <span>Duplicate Warning (24h)</span>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-3">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {order.customer?.fullName || 'Walk-in Customer'}
                            </div>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                              {order.customer?.phone || 'No phone'}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{order.shippingAddress?.district || 'Dhaka'}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[150px] mt-0.5">
                              {order.shippingAddress?.division} · {order.shippingAddress?.addressLine1 || 'Standard delivery'}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <span className="font-medium text-slate-900 dark:text-white">
                              {order.items ? `${order.items.length} item(s)` : '1 item'}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            <div className="font-bold text-slate-900 dark:text-white">
                              {formatTaka(order.totalMinor)}
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider block mt-0.5 ${
                                order.paymentStatus === 'paid'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {order.paymentStatus === 'paid' ? 'Paid' : 'Cash On Delivery'}
                            </span>
                          </td>
                          <td className="py-4 px-3">
                            {getRiskBadge(order.riskLevel, order.riskScore, order.riskDecision)}
                          </td>
                          <td className="py-4 px-3">{getStatusBadge(order.orderStatus)}</td>
                          <td className="py-4 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <a
                                href={`/print/invoice?orderId=${order.id}&format=a4`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Print Invoice (A4)"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </a>
                              <Link
                                href={`/orders/${order.id}`}
                                className="px-2.5 py-1.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
                              >
                                <span>View</span>
                                <ChevronRight className="w-3.5 h-3.5" />
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
        </div>
      </main>

      {/* QUICK ORDER SLIDE-OVER DRAWER */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !isSubmitting && setIsDrawerOpen(false)}
          />

          {/* Drawer Body */}
          <div className="relative w-full max-w-xl bg-white dark:bg-[#121826] shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span>Quick Order Intake (F-Commerce)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fast order entry with phone autofill & Bangladesh address hierarchy.
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateOrder} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              {/* SECTION 1: CUSTOMER PHONE & LOOKUP */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  1. Customer & Contact
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="017xxxxxxxx"
                        value={customerPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                      {phoneLookupLoading && (
                        <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                    {phoneValid === true && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                        ✓ Valid BD mobile (+8801...)
                      </span>
                    )}
                    {phoneValid === false && (
                      <span className="text-[11px] text-rose-500 mt-0.5 block">
                        Must be valid 11-digit BD number
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mahfuzur Rahman"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* SECTION 2: BANGLADESH ADDRESS */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    2. Bangladesh Delivery Address
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Division
                      </label>
                      <select
                        value={selectedDivision}
                        onChange={(e) => handleDivisionChange(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {BANGLADESH_DIVISIONS.map((div) => (
                          <option key={div.id} value={div.name}>
                            {div.name} ({div.bnName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        District
                      </label>
                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        {availableDistricts.map((dist) => (
                          <option key={dist.id} value={dist.name}>
                            {dist.name} ({dist.bnName})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Street / Thana / Area Address
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. House 14, Road 4, Sector 7, Uttara, Dhaka"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                {/* SECTION 3: ORDER ITEMS */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    3. Order Items & Stock Selection
                  </span>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedVariantId}
                      onChange={(e) => setSelectedVariantId(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {productsList.length === 0 ? (
                        <option value="">No variants available</option>
                      ) : (
                        productsList.map((p) => (
                          <option key={p.variantId} value={p.variantId}>
                            {p.name} — ৳{(p.priceMinor / 100).toFixed(2)} (Stock: {p.available})
                          </option>
                        ))
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-3.5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      + Add
                    </button>
                  </div>

                  {/* Selected Items List */}
                  {orderItems.length > 0 && (
                    <div className="space-y-2 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/60">
                      {orderItems.map((item) => (
                        <div
                          key={item.variantId}
                          className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200/40 dark:border-slate-800/40 last:border-0"
                        >
                          <div className="flex-1 min-w-0 pr-3">
                            <span className="font-semibold text-slate-900 dark:text-white block truncate">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              ৳{(item.priceMinor / 100).toFixed(2)} × {item.quantity}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.variantId, -1)}
                                className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                              >
                                -
                              </button>
                              <span className="px-2 font-bold text-xs">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(item.variantId, 1)}
                                className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.variantId)}
                              className="text-slate-400 hover:text-rose-500 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECTION 4: SHIPPING & TOTAL */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    4. Shipping, Source & Financials
                  </span>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Channel Source
                      </label>
                      <select
                        value={orderSource}
                        onChange={(e: any) => setOrderSource(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                      >
                        <option value="facebook">Facebook</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                        <option value="phone">Phone Call</option>
                        <option value="manual">Manual Entry</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Delivery (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={deliveryCharge}
                        onChange={(e) => setDeliveryCharge(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Discount (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Immediate Confirmation Toggle */}
                  <div className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Confirm & Reserve Stock Immediately
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Locks inventory balance atomically in database.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoConfirm}
                      onChange={(e) => setAutoConfirm(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  {/* Summary Box */}
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Items Subtotal:</span>
                      <span>৳{(calculatedSubtotal / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 dark:text-slate-400">
                      <span>Delivery Charge:</span>
                      <span>৳{deliveryCharge.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Discount:</span>
                        <span>-৳{discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span>Grand Total:</span>
                      <span className="text-blue-600 dark:text-blue-400">
                        ৳{(calculatedTotal / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || orderItems.length === 0}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Order...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Create Order ({formatTaka(calculatedTotal)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
