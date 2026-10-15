'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';
import {
  Printer,
  ArrowLeft,
  Globe,
  FileText,
  Receipt,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Package,
} from 'lucide-react';

interface PrintOrderItem {
  id: string;
  productVariantId: string;
  sku?: string;
  productName?: string;
  variantName?: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
}

interface PrintOrderData {
  id: string;
  orderNumber: string;
  orderStatus: string;
  paymentStatus: string;
  source: string;
  subtotalMinor: number;
  deliveryChargeMinor: number;
  discountMinor: number;
  totalMinor: number;
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
  items: PrintOrderItem[];
}

export default function DocumentPrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const documentType = (params?.['type'] as string) || 'invoice'; // 'invoice' | 'packing_slip'
  const initialFormat = (searchParams.get('format') as 'a4' | 'pos_thermal_80mm') || 'a4';
  const initialLang = (searchParams.get('lang') as 'en' | 'bn') || 'en';

  const orderId = searchParams.get('orderId');
  const orderIdsParam = searchParams.get('orderIds');

  const [orders, setOrders] = useState<PrintOrderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [format, setFormat] = useState<'a4' | 'pos_thermal_80mm'>(initialFormat);
  const [lang, setLang] = useState<'en' | 'bn'>(initialLang);
  const [printed, setPrinted] = useState(false);

  // Fetch document order data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const idsToFetch: string[] = [];
        if (orderIdsParam) {
          idsToFetch.push(...orderIdsParam.split(',').filter(Boolean));
        } else if (orderId) {
          idsToFetch.push(orderId);
        }

        if (idsToFetch.length === 0) {
          // Mock data for preview if no order IDs provided
          setOrders([
            {
              id: 'demo-1',
              orderNumber: 'ORD-2026-8819',
              orderStatus: 'confirmed',
              paymentStatus: 'unpaid',
              source: 'facebook',
              subtotalMinor: 245000,
              deliveryChargeMinor: 6000,
              discountMinor: 0,
              totalMinor: 251000,
              createdAt: new Date().toISOString(),
              customer: {
                id: 'cust-1',
                fullName: 'Kamal Hossain',
                phone: '+8801711223344',
              },
              shippingAddress: {
                division: 'Dhaka',
                district: 'Dhaka',
                addressLine1: 'House 42, Road 11, Block D, Banani',
              },
              items: [
                {
                  id: 'it-1',
                  productVariantId: 'v-1',
                  sku: 'TSH-BLK-L',
                  productName: 'Premium Cotton Tee',
                  variantName: 'Black / L',
                  quantity: 2,
                  unitPriceMinor: 85000,
                  totalMinor: 170000,
                },
                {
                  id: 'it-2',
                  productVariantId: 'v-2',
                  sku: 'CAP-NVY-OS',
                  productName: 'Signature Baseball Cap',
                  variantName: 'Navy / One Size',
                  quantity: 1,
                  unitPriceMinor: 75000,
                  totalMinor: 75000,
                },
              ],
            },
          ]);
          setLoading(false);
          return;
        }

        // Fetch each order from API
        const fetched: PrintOrderData[] = [];
        for (const id of idsToFetch) {
          try {
            const res = await api.get(`/orders/${id}`);
            if (res) fetched.push(res);
          } catch (e) {
            console.warn(`Failed to fetch order ${id}`, e);
          }
        }
        setOrders(fetched);
      } catch (err) {
        console.error('Failed to load document data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [orderId, orderIdsParam]);

  // Log print event
  const logPrintAction = async () => {
    try {
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        await api.post('/documents/print-log', {
          documentType,
          orderIds,
          format,
        });
      }
    } catch (e) {
      console.warn('Could not record print log:', e);
    }
  };

  const handlePrint = () => {
    setPrinted(true);
    logPrintAction();
    window.print();
  };

  const formatTaka = (minor: number) => {
    return `৳${(minor / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Translations
  const t = {
    en: {
      invoiceTitle: 'INVOICE / BILL',
      packingTitle: 'PACKING SLIP',
      storeName: 'Growthomic Business OS',
      orderNo: 'Order #',
      date: 'Date & Time',
      paymentMethod: 'Payment Mode',
      paymentStatus: 'Payment Status',
      cod: 'Cash On Delivery (COD)',
      paid: 'Prepaid / Paid',
      unpaid: 'Unpaid (Collect Cash)',
      billTo: 'Customer & Delivery Info',
      items: 'Items Description',
      sku: 'SKU',
      qty: 'Qty',
      unitPrice: 'Unit Price',
      lineTotal: 'Total',
      subtotal: 'Subtotal',
      delivery: 'Delivery Charge',
      discount: 'Discount',
      netPayable: 'Net Payable Amount',
      thankYou: 'Thank you for your business!',
      returnNotice: 'Please inspect package upon delivery. Return window: 3 days with tags intact.',
      preparedBy: 'Prepared by / Staff Signature',
      receivedBy: 'Customer Received Signature',
      channel: 'Sales Channel',
    },
    bn: {
      invoiceTitle: 'ইনভয়েস / ক্যাশ মেমো',
      packingTitle: 'প্যাকিং স্লিপ',
      storeName: 'গ্রোথোমিক বিজনেস ওএস',
      orderNo: 'অর্ডার নম্বর',
      date: 'তারিখ ও সময়',
      paymentMethod: 'মূল্য পরিশোধের মাধ্যম',
      paymentStatus: 'পেমেন্ট স্ট্যাটাস',
      cod: 'ক্যাশ অন ডেলিভারি (কড)',
      paid: 'পরিশোধিত',
      unpaid: 'অপরিশোধিত (ক্যাশ সংগ্রহ করুন)',
      billTo: 'গ্রাহক ও ডেলিভারি তথ্য',
      items: 'পণ্য বিবরণী',
      sku: 'এসকেইউ',
      qty: 'পরিমাণ',
      unitPrice: 'একক মূল্য',
      lineTotal: 'মোট মূল্য',
      subtotal: 'মোট উপমোট',
      delivery: 'ডেলিভারি চার্জ',
      discount: 'ডিসকাউন্ট',
      netPayable: 'সর্বমোট প্রদেয় টাকা',
      thankYou: 'আমাদের সাথে কেনাকাটা করার জন্য ধন্যবাদ!',
      returnNotice: 'ডেলিভারির সময় পণ্য চেক করে নিন। পণ্য ফেরতের মেয়াদ: অক্ষত ট্যাগসহ ৩ দিন।',
      preparedBy: 'প্রস্তুতকারীর স্বাক্ষর',
      receivedBy: 'গ্রাহকের স্বাক্ষর',
      channel: 'বিক্রয় চ্যানেল',
    },
  }[lang];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F17]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Generating document preview...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 md:p-8 print:p-0 print:bg-white text-slate-900">
      {/* SCREEN CONTROL TOOLBAR (Hidden in Print) */}
      <div className="print:hidden max-w-4xl mx-auto mb-6 bg-white dark:bg-[#121826] p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>{documentType === 'invoice' ? 'Invoice / Cash Memo' : 'Packing Slip'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 font-semibold">
                {orders.length} Order{orders.length > 1 ? 's' : ''}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Print-ready formatted document with bilingual support
            </p>
          </div>
        </div>

        {/* Options & Action */}
        <div className="flex items-center gap-3">
          {/* Format Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFormat('a4')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                format === 'a4'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>A4 Normal</span>
            </button>
            <button
              onClick={() => setFormat('pos_thermal_80mm')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                format === 'pos_thermal_80mm'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>80mm Thermal</span>
            </button>
          </div>

          {/* Lang Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setLang('en')}
              className={`px-2.5 py-1.5 rounded-lg transition-all ${
                lang === 'en'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLang('bn')}
              className={`px-2.5 py-1.5 rounded-lg transition-all font-bengali ${
                lang === 'bn'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              বাংলা
            </button>
          </div>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Now</span>
          </button>
        </div>
      </div>

      {/* PRINT CANVAS */}
      <div className="max-w-4xl mx-auto space-y-8 print:space-y-0">
        {orders.map((order, idx) => (
          <div
            key={order.id || idx}
            className={`bg-white shadow-md print:shadow-none print:m-0 mx-auto transition-all ${
              format === 'pos_thermal_80mm'
                ? 'w-[320px] p-4 text-[12px] font-mono border border-slate-200 print:border-none'
                : 'w-full max-w-[800px] p-8 md:p-10 border border-slate-200 print:border-none print:p-6'
            } ${idx > 0 ? 'print:break-before-page' : ''}`}
            style={{
              fontFamily: format === 'pos_thermal_80mm' ? 'monospace' : 'system-ui, sans-serif',
            }}
          >
            {/* 80mm POS THERMAL RECEIPT LAYOUT */}
            {format === 'pos_thermal_80mm' ? (
              <div className="space-y-3 text-slate-900 leading-tight">
                {/* Header */}
                <div className="text-center pb-2 border-b border-dashed border-slate-400">
                  <h2 className="text-sm font-black uppercase tracking-wider">{t.storeName}</h2>
                  <p className="text-[11px] font-bold mt-0.5">
                    {documentType === 'invoice' ? t.invoiceTitle : t.packingTitle}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {t.orderNo}: <span className="font-bold">{order.orderNumber}</span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(order.createdAt).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                {/* Customer Details */}
                <div className="text-[11px] pb-2 border-b border-dashed border-slate-400">
                  <p className="font-bold">{order.customer?.fullName || 'Walk-in Customer'}</p>
                  <p className="font-semibold">{order.customer?.phone}</p>
                  <p className="text-[10px] text-slate-700 mt-0.5">
                    {order.shippingAddress?.district}, {order.shippingAddress?.division}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    {order.shippingAddress?.addressLine1}
                  </p>
                </div>

                {/* Items */}
                <div className="pb-2 border-b border-dashed border-slate-400">
                  <div className="flex justify-between font-bold text-[10px] uppercase pb-1 mb-1 border-b border-slate-300">
                    <span>{t.items}</span>
                    <span>{t.lineTotal}</span>
                  </div>
                  <div className="space-y-1.5">
                    {order.items.map((item, i) => (
                      <div key={item.id || i} className="text-[11px]">
                        <div className="font-bold flex justify-between">
                          <span className="truncate max-w-[200px]">
                            {item.productName || item.variantName || 'Item'}
                          </span>
                          <span>{formatTaka(item.totalMinor)}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 flex justify-between">
                          <span>
                            {item.sku} · {item.quantity} x {formatTaka(item.unitPriceMinor)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Financial Summary */}
                <div className="text-[11px] space-y-1 pb-2 border-b border-dashed border-slate-400">
                  <div className="flex justify-between">
                    <span>{t.subtotal}:</span>
                    <span>{formatTaka(order.subtotalMinor)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t.delivery}:</span>
                    <span>{formatTaka(order.deliveryChargeMinor)}</span>
                  </div>
                  {order.discountMinor > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>{t.discount}:</span>
                      <span>-{formatTaka(order.discountMinor)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-black pt-1 border-t border-slate-300">
                    <span>{t.netPayable}:</span>
                    <span>{formatTaka(order.totalMinor)}</span>
                  </div>
                </div>

                {/* Payment Badge */}
                <div className="text-center py-1">
                  <span className="inline-block px-2 py-0.5 border border-slate-800 text-[10px] font-black uppercase">
                    {order.paymentStatus === 'paid' ? t.paid : t.cod}
                  </span>
                </div>

                {/* Footer Note */}
                <div className="text-center text-[10px] text-slate-600 space-y-1 pt-1">
                  <p>{t.thankYou}</p>
                  <p className="text-[9px]">{t.returnNotice}</p>
                </div>
              </div>
            ) : (
              /* A4 PROFESSIONAL INVOICE / PACKING SLIP LAYOUT */
              <div className="space-y-6 text-slate-900">
                {/* Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                  <div>
                    <h2 className="text-xl font-black tracking-tight uppercase text-slate-900">
                      {t.storeName}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      Modern Multi-Channel Commerce & Inventory OS
                    </p>
                    <div className="mt-3 text-xs text-slate-600 space-y-0.5">
                      <p>Dhaka, Bangladesh · support@growthomic.com</p>
                      <p>Helpline: +880 9612-000000</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-bold tracking-widest uppercase rounded">
                      {documentType === 'invoice' ? t.invoiceTitle : t.packingTitle}
                    </div>
                    <div className="mt-2 text-xs">
                      <p className="text-slate-400 font-semibold">{t.orderNo}</p>
                      <p className="text-base font-black text-slate-900">{order.orderNumber}</p>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      <p>
                        {new Date(order.createdAt).toLocaleDateString(
                          lang === 'bn' ? 'bn-BD' : 'en-US',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recipient & Meta Section */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      {t.billTo}
                    </h3>
                    <p className="text-sm font-bold text-slate-900">
                      {order.customer?.fullName || 'Walk-in Customer'}
                    </p>
                    <p className="text-xs font-semibold text-blue-600 mt-0.5">
                      {order.customer?.phone}
                    </p>
                    <p className="text-xs text-slate-700 mt-1">
                      {order.shippingAddress?.addressLine1}
                    </p>
                    <p className="text-xs text-slate-600">
                      {order.shippingAddress?.district}, {order.shippingAddress?.division}
                    </p>
                  </div>

                  <div className="text-right flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        {t.paymentStatus}
                      </h3>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-slate-300">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            order.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                        />
                        <span>{order.paymentStatus === 'paid' ? t.paid : t.cod}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-3">
                      <span>{t.channel}: </span>
                      <span className="font-bold uppercase text-slate-800">
                        {order.source || 'Direct'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[11px] border-b border-slate-200">
                        <th className="py-2.5 px-4 w-10 text-center">#</th>
                        <th className="py-2.5 px-4">{t.items}</th>
                        <th className="py-2.5 px-4 w-28">{t.sku}</th>
                        <th className="py-2.5 px-4 text-center w-16">{t.qty}</th>
                        <th className="py-2.5 px-4 text-right w-28">{t.unitPrice}</th>
                        <th className="py-2.5 px-4 text-right w-28">{t.lineTotal}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {order.items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-center text-slate-400 font-semibold">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">
                              {item.productName || 'Product'}
                            </span>
                            {item.variantName && (
                              <span className="text-[11px] text-slate-500 block">
                                {item.variantName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {item.sku || 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-900">
                            {item.quantity}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 font-medium">
                            {formatTaka(item.unitPriceMinor)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatTaka(item.totalMinor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals & Notes */}
                <div className="grid grid-cols-2 gap-6 pt-2">
                  <div className="text-xs text-slate-500 space-y-2 pr-4">
                    <p className="font-bold text-slate-700">{t.returnNotice}</p>
                    <p>{t.thankYou}</p>
                  </div>

                  <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>{t.subtotal}:</span>
                      <span className="font-medium text-slate-900">
                        {formatTaka(order.subtotalMinor)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>{t.delivery}:</span>
                      <span className="font-medium text-slate-900">
                        {formatTaka(order.deliveryChargeMinor)}
                      </span>
                    </div>
                    {order.discountMinor > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>{t.discount}:</span>
                        <span className="font-medium">-{formatTaka(order.discountMinor)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-300">
                      <span>{t.netPayable}:</span>
                      <span className="text-base text-blue-700">{formatTaka(order.totalMinor)}</span>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-12 pt-12 mt-6 border-t border-slate-200 text-center text-xs text-slate-500">
                  <div>
                    <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
                    <span>{t.preparedBy}</span>
                  </div>
                  <div>
                    <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
                    <span>{t.receivedBy}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
