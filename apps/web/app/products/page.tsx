'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { api } from '../../lib/api';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Layers,
  AlertTriangle,
  Barcode,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  ChevronRight,
  TrendingUp,
  Tag,
  Printer,
  Sparkles,
} from 'lucide-react';

interface Variant {
  id?: string;
  sku: string;
  barcode?: string | null;
  name: string;
  options?: Record<string, string>;
  retailPrice: number; // in paisa
  wholesalePrice?: number | null;
  purchaseCost: number; // in paisa
  lowStockThreshold: number;
  onHand?: number;
  available?: number;
  initialStock?: number;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  type: 'standard' | 'bundle';
  status: string;
  categoryName?: string | null;
  brandName?: string | null;
  variantCount: number;
  totalOnHand: number;
  totalAvailable: number;
  variants: Variant[];
  createdAt: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  
  // Drawer & Modal States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [barcodeVariant, setBarcodeVariant] = useState<Variant | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New Product Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'standard' | 'bundle'>('standard');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formVariants, setFormVariants] = useState<Variant[]>([
    {
      sku: 'SKU-001',
      name: 'Default',
      retailPrice: 99000, // ৳990.00
      purchaseCost: 65000, // ৳650.00
      lowStockThreshold: 5,
      initialStock: 20,
    },
  ]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      setProducts(res.items || []);
    } catch (err: any) {
      console.warn('Backend unavailable, using initial demo inventory:', err);
      // Demo fallback showcasing Shopeers UI immediately
      setProducts([
        {
          id: 'demo-1',
          name: 'Premium Oxford Cotton Shirt',
          slug: 'premium-oxford-cotton-shirt',
          type: 'standard',
          status: 'active',
          categoryName: 'Apparel',
          brandName: 'Fabrics BD',
          variantCount: 3,
          totalOnHand: 48,
          totalAvailable: 44,
          createdAt: new Date().toISOString(),
          variants: [
            { id: 'v1', sku: 'SHT-WHT-M', name: 'White / M', retailPrice: 125000, purchaseCost: 80000, lowStockThreshold: 5, onHand: 18, available: 16 },
            { id: 'v2', sku: 'SHT-WHT-L', name: 'White / L', retailPrice: 125000, purchaseCost: 80000, lowStockThreshold: 5, onHand: 20, available: 19 },
            { id: 'v3', sku: 'SHT-BLU-L', name: 'Navy / L', retailPrice: 135000, purchaseCost: 85000, lowStockThreshold: 5, onHand: 10, available: 9 },
          ],
        },
        {
          id: 'demo-2',
          name: 'Wireless Noise-Cancelling Earbuds Pro',
          slug: 'wireless-earbuds-pro',
          type: 'standard',
          status: 'active',
          categoryName: 'Electronics',
          brandName: 'SoundWave',
          variantCount: 1,
          totalOnHand: 14,
          totalAvailable: 12,
          createdAt: new Date().toISOString(),
          variants: [
            { id: 'v4', sku: 'EAR-BLK-01', name: 'Midnight Black', retailPrice: 249000, purchaseCost: 160000, lowStockThreshold: 5, onHand: 14, available: 12 },
          ],
        },
        {
          id: 'demo-3',
          name: 'Weekend Combo: Shirt + Leather Belt Gift Pack',
          slug: 'weekend-combo-gift-pack',
          type: 'bundle',
          status: 'active',
          categoryName: 'Gift Sets',
          brandName: 'Growthomic Special',
          variantCount: 1,
          totalOnHand: 15,
          totalAvailable: 15,
          createdAt: new Date().toISOString(),
          variants: [
            { id: 'v5', sku: 'BDL-WKND-01', name: 'Combo Pack', retailPrice: 185000, purchaseCost: 110000, lowStockThreshold: 3, onHand: 15, available: 15 },
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showNotification('Product name is required', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/products', {
        name: formName,
        type: formType,
        description: formDescription,
        variants: formVariants.map((v) => ({
          sku: v.sku,
          name: v.name,
          retailPrice: Number(v.retailPrice),
          purchaseCost: Number(v.purchaseCost),
          lowStockThreshold: Number(v.lowStockThreshold),
          initialStock: Number(v.initialStock || 0),
          options: v.options || {},
        })),
      });

      showNotification('Product created successfully with opening inventory!', 'success');
      setIsDrawerOpen(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      showNotification(err.message || 'Failed to create product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormType('standard');
    setFormDescription('');
    setFormVariants([
      {
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        name: 'Regular',
        retailPrice: 99000,
        purchaseCost: 60000,
        lowStockThreshold: 5,
        initialStock: 10,
      },
    ]);
  };

  const addVariantRow = () => {
    setFormVariants([
      ...formVariants,
      {
        sku: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        name: `Option ${formVariants.length + 1}`,
        retailPrice: 99000,
        purchaseCost: 60000,
        lowStockThreshold: 5,
        initialStock: 10,
      },
    ]);
  };

  const removeVariantRow = (index: number) => {
    if (formVariants.length <= 1) return;
    setFormVariants(formVariants.filter((_, i) => i !== index));
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.variants.some((v) => v.sku.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;

    if (stockFilter === 'in_stock') return p.totalAvailable > 5;
    if (stockFilter === 'low_stock') return p.totalAvailable > 0 && p.totalAvailable <= 5;
    if (stockFilter === 'out_of_stock') return p.totalAvailable === 0;

    return true;
  });

  // KPI calculations
  const totalProductsCount = products.length;
  const totalSkusCount = products.reduce((acc, p) => acc + p.variantCount, 0);
  const lowStockCount = products.filter((p) => p.totalAvailable > 0 && p.totalAvailable <= 5).length;
  const totalValuation = products.reduce((acc, p) => {
    return acc + p.variants.reduce((vAcc, v) => vAcc + (v.onHand || 0) * (v.purchaseCost / 100), 0);
  }, 0);

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 font-sans transition-colors">
      <Sidebar activeTenantName="Growthomic Store" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar onOpenAddWidget={() => {}} />

        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Notification Toast */}
          {notification && (
            <div
              className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-md transition-all ${
                notification.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              <span>{notification.message}</span>
              <button onClick={() => setNotification(null)} className="opacity-70 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Header & Main Actions */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Products & Catalog
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-500/10">
                  {totalProductsCount} Items
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage your multi-variant SKUs, bundles, real-time stock balances and barcodes.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  resetForm();
                  setIsDrawerOpen(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Products</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalProductsCount}</span>
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full">
                  Standard & Bundles
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total SKUs / Variants</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{totalSkusCount}</span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Tracked In Warehouse
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Low Stock Alerts</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">{lowStockCount}</span>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                  Need Restock
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Inventory Valuation</span>
              <div className="flex items-baseline justify-between mt-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  ৳{totalValuation.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </span>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  At Cost Basis
                </span>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name, SKU, or scan barcode..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
              <button
                onClick={() => setStockFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  stockFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All Products
              </button>
              <button
                onClick={() => setStockFilter('in_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  stockFilter === 'in_stock'
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                In Stock (&gt;5)
              </button>
              <button
                onClick={() => setStockFilter('low_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  stockFilter === 'low_stock'
                    ? 'bg-amber-600 text-white shadow-sm shadow-amber-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Low Stock (1-5)
              </button>
              <button
                onClick={() => setStockFilter('out_of_stock')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  stockFilter === 'out_of_stock'
                    ? 'bg-rose-600 text-white shadow-sm shadow-rose-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Out of Stock (0)
              </button>
            </div>
          </div>

          {/* Products Table */}
          <div className="rounded-2xl bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-semibold text-slate-400 bg-slate-50/50 dark:bg-slate-900/30">
                    <th className="py-3.5 px-4">Product Name</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4">Variants / SKU</th>
                    <th className="py-3.5 px-4">Retail Price (BDT)</th>
                    <th className="py-3.5 px-4">Available Stock</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        Loading products catalog...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                        No products found matching the criteria. Click "Add Product" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-semibold text-xs border border-slate-200 dark:border-slate-700">
                              <Package className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white block">
                                {product.name}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {product.categoryName || 'General'} · {product.brandName || 'No Brand'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {product.type === 'bundle' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              <Layers className="w-3 h-3" />
                              Bundle
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              Standard
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {product.variants[0]?.sku || 'No SKU'}
                            </span>
                            {product.variantCount > 1 && (
                              <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                +{product.variantCount - 1} more variants
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          ৳{( (product.variants[0]?.retailPrice || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                product.totalAvailable > 5
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                                  : product.totalAvailable > 0
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {product.totalAvailable} in stock
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setBarcodeVariant(product.variants[0] || null)}
                              title="Print Barcode"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Barcode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                              }}
                              title="View Details"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Slide-over Drawer: Add Product */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end">
            <div className="w-full max-w-xl bg-white dark:bg-[#121826] h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Create New Product</h2>
                      <p className="text-[11px] text-slate-500">Configure catalog details, variants, and opening stock</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form id="createProductForm" onSubmit={handleCreateProduct} className="space-y-5">
                  {/* General Information */}
                  <div className="space-y-3">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Slim Fit Denim Jeans"
                      className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                  </div>

                  {/* Type Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Product Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFormType('standard')}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center gap-2.5 transition-all ${
                          formType === 'standard'
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Package className="w-4 h-4" />
                        <div>
                          <div>Standard Product</div>
                          <div className="text-[10px] font-normal text-slate-400">Own inventory & variants</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormType('bundle')}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center gap-2.5 transition-all ${
                          formType === 'bundle'
                            ? 'border-purple-600 bg-purple-50/50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                        <div>
                          <div>Bundle / Combo</div>
                          <div className="text-[10px] font-normal text-slate-400">Deducts component items</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Optional details, fabric specification, sizing..."
                      className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                    />
                  </div>

                  {/* Variants Section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900 dark:text-white">
                        Product Variants & Opening Stock
                      </label>
                      <button
                        type="button"
                        onClick={addVariantRow}
                        className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Variant
                      </button>
                    </div>

                    <div className="space-y-3">
                      {formVariants.map((v, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-500">Variant #{idx + 1}</span>
                            {formVariants.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeVariantRow(idx)}
                                className="text-slate-400 hover:text-rose-500"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-1">SKU *</span>
                              <input
                                type="text"
                                required
                                value={v.sku}
                                onChange={(e) => {
                                  const updated = [...formVariants];
                                  updated[idx]!.sku = e.target.value;
                                  setFormVariants(updated);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-700 font-mono"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-1">Variant Name *</span>
                              <input
                                type="text"
                                required
                                value={v.name}
                                onChange={(e) => {
                                  const updated = [...formVariants];
                                  updated[idx]!.name = e.target.value;
                                  setFormVariants(updated);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-1">Retail Price (BDT) *</span>
                              <input
                                type="number"
                                required
                                min="0"
                                value={v.retailPrice / 100}
                                onChange={(e) => {
                                  const updated = [...formVariants];
                                  updated[idx]!.retailPrice = Math.round(Number(e.target.value) * 100);
                                  setFormVariants(updated);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-700 font-semibold"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-1">Cost (BDT)</span>
                              <input
                                type="number"
                                min="0"
                                value={v.purchaseCost / 100}
                                onChange={(e) => {
                                  const updated = [...formVariants];
                                  updated[idx]!.purchaseCost = Math.round(Number(e.target.value) * 100);
                                  setFormVariants(updated);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-700"
                              />
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block mb-1">Opening Stock</span>
                              <input
                                type="number"
                                min="0"
                                value={v.initialStock || 0}
                                onChange={(e) => {
                                  const updated = [...formVariants];
                                  updated[idx]!.initialStock = Number(e.target.value);
                                  setFormVariants(updated);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-700 font-bold text-blue-600 dark:text-blue-400"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0B0F17]/50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="createProductForm"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Create Product'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barcode Print Modal */}
        {barcodeVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
            <div className="bg-white dark:bg-[#121826] max-w-sm w-full rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-blue-600" />
                  Print Product Barcode
                </h3>
                <button onClick={() => setBarcodeVariant(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Printable Barcode Label Card */}
              <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center space-y-2">
                <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Growthomic Store</div>
                <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{barcodeVariant.name}</div>
                
                {/* Visual Barcode SVG Generator */}
                <div className="py-2 flex justify-center">
                  <div className="h-12 w-48 bg-slate-900 dark:bg-white flex items-stretch justify-around px-2">
                    {[...Array(28)].map((_, i) => (
                      <div
                        key={i}
                        className={`${i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-transparent'} ${
                          i % 3 === 0 ? 'w-1' : 'w-0.5'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="font-mono text-xs font-bold tracking-wider text-slate-700 dark:text-slate-300">
                  {barcodeVariant.sku}
                </div>
                <div className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                  ৳{(barcodeVariant.retailPrice / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setBarcodeVariant(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    window.print();
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Label
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
