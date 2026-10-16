'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  Warehouse,
  Truck,
  Package,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { BANGLADESH_DIVISIONS } from '@growthomic/shared';

const STEPS = [
  { id: 1, title: 'Store Profile', icon: Store, desc: 'Shop identity & contact' },
  { id: 2, title: 'Warehouse', icon: Warehouse, desc: 'Primary fulfillment hub' },
  { id: 3, title: 'Courier Setup', icon: Truck, desc: 'Steadfast or Pathao API' },
  { id: 4, title: 'First Product', icon: Package, desc: 'Initial catalog & stock' },
  { id: 5, title: 'Ready to Sell', icon: Sparkles, desc: 'Review & finish' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Step 1: Store Profile
  const [storeName, setStoreName] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeWebsite, setStoreWebsite] = useState('');
  const [facebookPage, setFacebookPage] = useState('');

  // Step 2: Warehouse
  const [warehouseName, setWarehouseName] = useState('Central Warehouse');
  const [warehouseAddress, setWarehouseAddress] = useState('Gulshan-2, Dhaka');
  const [warehouseDivision, setWarehouseDivision] = useState('Dhaka');
  const [warehouseDistrict, setWarehouseDistrict] = useState('Dhaka');

  // Step 3: Courier
  const [courierName, setCourierName] = useState<'steadfast' | 'pathao'>('steadfast');
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  // Step 4: Product
  const [productName, setProductName] = useState('Cotton Casual Shirt');
  const [productSku, setProductSku] = useState('CCS-001');
  const [productPrice, setProductPrice] = useState(1250);
  const [productStock, setProductStock] = useState(25);

  // Status stats
  const [stats, setStats] = useState<{ warehousesCount: number; couriersCount: number; productsCount: number }>({
    warehousesCount: 0,
    couriersCount: 0,
    productsCount: 0,
  });

  useEffect(() => {
    async function loadStatus() {
      try {
        setLoading(true);
        const res = await api.onboarding.getStatus();
        if (res.completed) {
          setCurrentStep(5);
        } else if (res.currentStep) {
          setCurrentStep(res.currentStep);
        }
        if (res.storeName) setStoreName(res.storeName);
        if (res.stats) setStats(res.stats);
      } catch (err: any) {
        console.error('Failed to load onboarding status:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  const handleNextStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setErrorMsg('Store name is required');
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      await api.onboarding.saveStoreProfile({
        organizationName: storeName.trim(),
        phone: storePhone.trim() || undefined,
        streetAddress: storeAddress.trim() || undefined,
        website: storeWebsite.trim() || undefined,
        facebookPage: facebookPage.trim() || undefined,
      });
      setSuccessMsg('Store profile saved!');
      setTimeout(() => setSuccessMsg(null), 2500);
      setCurrentStep(2);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save store profile');
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseName.trim() || !warehouseAddress.trim()) {
      setErrorMsg('Warehouse name and street address are required');
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      await api.onboarding.saveWarehouse({
        name: warehouseName.trim(),
        streetAddress: warehouseAddress.trim(),
        division: warehouseDivision,
        district: warehouseDistrict,
      });
      setStats((prev) => ({ ...prev, warehousesCount: prev.warehousesCount + 1 }));
      setSuccessMsg('First warehouse configured!');
      setTimeout(() => setSuccessMsg(null), 2500);
      setCurrentStep(3);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to configure warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleNextStep3 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !secretKey.trim()) {
      setErrorMsg('API Key and Secret Key are required to connect courier');
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      await api.onboarding.saveCourier({
        courierName,
        apiKey: apiKey.trim(),
        secretKey: secretKey.trim(),
      });
      setStats((prev) => ({ ...prev, couriersCount: prev.couriersCount + 1 }));
      setSuccessMsg(`${courierName === 'steadfast' ? 'Steadfast' : 'Pathao'} credentials saved!`);
      setTimeout(() => setSuccessMsg(null), 2500);
      setCurrentStep(4);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save courier credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep3 = () => {
    setCurrentStep(4);
  };

  const handleNextStep4 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !productSku.trim()) {
      setErrorMsg('Product name and SKU are required');
      return;
    }
    setErrorMsg(null);
    setSaving(true);
    try {
      await api.onboarding.saveProduct({
        name: productName.trim(),
        sku: productSku.trim(),
        retailPrice: Number(productPrice),
        stockQuantity: Number(productStock),
      });
      setStats((prev) => ({ ...prev, productsCount: prev.productsCount + 1 }));
      setSuccessMsg('First product & stock balance created!');
      setTimeout(() => setSuccessMsg(null), 2500);
      setCurrentStep(5);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save initial product');
    } finally {
      setSaving(false);
    }
  };

  const handleSkipStep4 = () => {
    setCurrentStep(5);
  };

  const handleComplete = async () => {
    setErrorMsg(null);
    setSaving(true);
    try {
      await api.onboarding.complete();
      setSuccessMsg('Onboarding complete! Redirecting to Dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete onboarding');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500 font-medium">Loading store setup wizard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Shopeers Onboarding Wizard</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Set up your eCommerce Operating System
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
            Get your store ready for multi-channel sales, automated courier booking (Steadfast/Pathao), and inventory tracking in minutes.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isPassed = currentStep > s.id;
              const isCurrent = currentStep === s.id;
              return (
                <div
                  key={s.id}
                  className={`flex flex-col items-center text-center p-3 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-blue-50 dark:bg-blue-950/50 border border-blue-300 dark:border-blue-700'
                      : isPassed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-4 ring-blue-100 dark:ring-blue-900/50'
                        : isPassed
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {s.title}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:block truncate max-w-[120px]">
                    {s.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Containers */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
          {/* STEP 1: Store Profile */}
          {currentStep === 1 && (
            <form onSubmit={handleNextStep1} className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Store className="w-5 h-5 text-blue-600" />
                  Step 1: Store Identity & Contact
                </h2>
                <p className="text-xs text-slate-500">
                  This name and phone number will appear on customer invoices, packaging slips, and SMS updates.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Store / Business Name *
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="e.g. Dhaka Artisan Lifestyle"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Official Phone (+880)
                  </label>
                  <input
                    type="text"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                    placeholder="01712345678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Website URL (optional)
                  </label>
                  <input
                    type="url"
                    value={storeWebsite}
                    onChange={(e) => setStoreWebsite(e.target.value)}
                    placeholder="https://mystore.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Registered Business Address
                  </label>
                  <input
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    placeholder="e.g. House 42, Road 11, Banani, Dhaka"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Facebook Page Link (optional)
                  </label>
                  <input
                    type="text"
                    value={facebookPage}
                    onChange={(e) => setFacebookPage(e.target.value)}
                    placeholder="https://facebook.com/mybrand"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Next: Configure Warehouse</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: First Warehouse */}
          {currentStep === 2 && (
            <form onSubmit={handleNextStep2} className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-blue-600" />
                  Step 2: First Warehouse / Fulfillment Center
                </h2>
                <p className="text-xs text-slate-500">
                  Every order is deducted and fulfilled from a warehouse. You can add more warehouses later.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Warehouse Name *
                  </label>
                  <input
                    type="text"
                    value={warehouseName}
                    onChange={(e) => setWarehouseName(e.target.value)}
                    placeholder="e.g. Main Hub Dhaka"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Division *
                  </label>
                  <select
                    value={warehouseDivision}
                    onChange={(e) => setWarehouseDivision(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {BANGLADESH_DIVISIONS.map((d: any) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    District / City *
                  </label>
                  <input
                    type="text"
                    value={warehouseDistrict}
                    onChange={(e) => setWarehouseDistrict(e.target.value)}
                    placeholder="Dhaka"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Street Address & Landmarks *
                  </label>
                  <input
                    type="text"
                    value={warehouseAddress}
                    onChange={(e) => setWarehouseAddress(e.target.value)}
                    placeholder="e.g. 12/A Mirpur Road, Dhanmondi, Dhaka"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Next: Connect Courier</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Courier Credentials */}
          {currentStep === 3 && (
            <form onSubmit={handleNextStep3} className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  Step 3: Connect Automated Courier Gateway
                </h2>
                <p className="text-xs text-slate-500">
                  Connect Steadfast Courier or Pathao to enable 1-click parcel generation, live tracking, and COD settlement reconciliation.
                </p>
              </div>

              {/* Courier Selection Radio Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <div
                  onClick={() => setCourierName('steadfast')}
                  className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col items-center text-center gap-2 ${
                    courierName === 'steadfast'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-red-600 text-white font-bold flex items-center justify-center text-xs">
                    ST
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Steadfast Courier</h3>
                    <p className="text-[11px] text-slate-400">Recommended for nationwide COD</p>
                  </div>
                </div>

                <div
                  onClick={() => setCourierName('pathao')}
                  className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col items-center text-center gap-2 ${
                    courierName === 'pathao'
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-rose-600 text-white font-bold flex items-center justify-center text-xs">
                    PT
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pathao Courier</h3>
                    <p className="text-[11px] text-slate-400">Fast intra-city & district delivery</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {courierName === 'steadfast' ? 'Steadfast API Key *' : 'Pathao Client ID / API Key *'}
                  </label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API Key"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {courierName === 'steadfast' ? 'Steadfast Secret Key *' : 'Pathao Client Secret / Password *'}
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder="Enter your Secret Key"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSkipStep3}
                    className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold"
                  >
                    Skip for now
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>Next: Add Product</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 4: Initial Product / Inventory */}
          {currentStep === 4 && (
            <form onSubmit={handleNextStep4} className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Step 4: Create Your First Product & Inventory
                </h2>
                <p className="text-xs text-slate-500">
                  Add a sample item or start building your live inventory. You can also bulk import products via CSV later.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Cotton Panjabi"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    SKU (Stock Keeping Unit) *
                  </label>
                  <input
                    type="text"
                    value={productSku}
                    onChange={(e) => setProductSku(e.target.value)}
                    placeholder="e.g. PANJ-001"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Retail Price (BDT ৳) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={productPrice}
                    onChange={(e) => setProductPrice(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Initial Stock Count (Units) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productStock}
                    onChange={(e) => setProductStock(Number(e.target.value))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSkipStep4}
                    className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold"
                  >
                    I will import via CSV
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>Next: Review & Finish</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* STEP 5: Review & Finish */}
          {currentStep === 5 && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Congratulations! Your Store is Ready.
                </h2>
                <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                  You have configured your business profile, primary warehouse, courier routing, and initial inventory.
                </p>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-xl mx-auto">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Warehouses</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {stats.warehousesCount || 1} Active
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Couriers</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {stats.couriersCount ? `${stats.couriersCount} Connected` : 'Manual Booking'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">Products</span>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {stats.productsCount} In Catalog
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => router.push('/settings/import')}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-sm transition-all"
                >
                  Import CSV Data (Products/Customers)
                </button>

                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={saving}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>Enter Dashboard & Start Selling</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
