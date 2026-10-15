'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/sidebar';
import { Topbar } from '../../components/topbar';
import { api } from '../../lib/api';
import {
  Users,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Phone,
  MapPin,
  Tag,
  DollarSign,
  ShoppingCart,
  Calendar,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Award,
} from 'lucide-react';
import {
  BANGLADESH_DIVISIONS,
  getDistrictsByDivision,
  normalizeBdPhone,
} from '@growthomic/shared';

interface CustomerTag {
  id: string;
  name: string;
  colorHex?: string | null;
}

interface CustomerAddress {
  id: string;
  division?: string | null;
  district?: string | null;
  addressLine1?: string | null;
  isDefaultShipping?: boolean;
}

interface Customer {
  id: string;
  fullName?: string | null;
  phone: string;
  email?: string | null;
  totalOrdersCount: number;
  deliveredOrdersCount: number;
  totalSpentMinor: number;
  deliveredRate: number;
  tags?: CustomerTag[];
  addresses?: CustomerAddress[];
  createdAt: string;
  updatedAt: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string>('all');
  const [tagsList, setTagsList] = useState<CustomerTag[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formDivision, setFormDivision] = useState('Dhaka');
  const [formDistrict, setFormDistrict] = useState('Dhaka');
  const [formAddressLine1, setFormAddressLine1] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (selectedTagId !== 'all') params.set('tagId', selectedTagId);

      const res = await api.get(`/customers?${params.toString()}`);
      setCustomers(res.items || []);
    } catch (err: any) {
      console.warn('Could not fetch customers from API, using demo CRM:', err);
      // Demo Fallback
      setCustomers([
        {
          id: 'c-1',
          fullName: 'Rafiqul Islam',
          phone: '+8801712345678',
          email: 'rafiqul@example.com',
          totalOrdersCount: 6,
          deliveredOrdersCount: 6,
          totalSpentMinor: 894000,
          deliveredRate: 100,
          tags: [{ id: 't-1', name: 'VIP Buyer', colorHex: '#2563EB' }],
          addresses: [
            {
              id: 'a-1',
              division: 'Dhaka',
              district: 'Dhaka',
              addressLine1: 'House 42, Road 11, Banani',
              isDefaultShipping: true,
            },
          ],
          createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'c-2',
          fullName: 'Nusrat Jahan',
          phone: '+8801819998877',
          email: null,
          totalOrdersCount: 4,
          deliveredOrdersCount: 4,
          totalSpentMinor: 572000,
          deliveredRate: 100,
          tags: [{ id: 't-2', name: 'Repeat Customer', colorHex: '#10B981' }],
          addresses: [
            {
              id: 'a-2',
              division: 'Chittagong',
              district: 'Chittagong',
              addressLine1: 'GEC Circle, Nasirabad',
              isDefaultShipping: true,
            },
          ],
          createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'c-3',
          fullName: 'Tanvir Hossain',
          phone: '+8801912445566',
          email: null,
          totalOrdersCount: 2,
          deliveredOrdersCount: 1,
          totalSpentMinor: 240000,
          deliveredRate: 50,
          tags: [{ id: 't-3', name: 'Cash On Delivery', colorHex: '#F59E0B' }],
          addresses: [
            {
              id: 'a-3',
              division: 'Rajshahi',
              district: 'Rajshahi',
              addressLine1: 'Kazihata, Rajshahi Sadar',
              isDefaultShipping: true,
            },
          ],
          createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await api.get('/customers/tags');
      setTagsList(res || []);
    } catch (err) {
      setTagsList([
        { id: 't-1', name: 'VIP Buyer', colorHex: '#2563EB' },
        { id: 't-2', name: 'Repeat Customer', colorHex: '#10B981' },
        { id: 't-3', name: 'Cash On Delivery', colorHex: '#F59E0B' },
      ]);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchTags();
  }, [selectedTagId]);

  const availableDistricts = useMemo(() => {
    return getDistrictsByDivision(formDivision);
  }, [formDivision]);

  const handleOpenDrawer = (customer?: Customer) => {
    if (customer) {
      setSelectedCustomer(customer);
      setFormName(customer.fullName || '');
      setFormPhone(customer.phone);
      setFormEmail(customer.email || '');
      if (customer.addresses && customer.addresses.length > 0) {
        setFormDivision(customer.addresses[0]?.division || 'Dhaka');
        setFormDistrict(customer.addresses[0]?.district || 'Dhaka');
        setFormAddressLine1(customer.addresses[0]?.addressLine1 || '');
      } else {
        setFormDivision('Dhaka');
        setFormDistrict('Dhaka');
        setFormAddressLine1('');
      }
      setSelectedTagIds(customer.tags?.map((t) => t.id) || []);
    } else {
      setSelectedCustomer(null);
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setFormDivision('Dhaka');
      setFormDistrict('Dhaka');
      setFormAddressLine1('');
      setSelectedTagIds([]);
    }
    setIsDrawerOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPhone.trim()) {
      setNotification({ message: 'Phone number is required', type: 'error' });
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        fullName: formName.trim() || undefined,
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
        defaultAddress: {
          division: formDivision,
          district: formDistrict,
          addressLine1: formAddressLine1.trim() || undefined,
        },
        tagIds: selectedTagIds,
      };

      if (selectedCustomer) {
        await api.patch(`/customers/${selectedCustomer.id}`, payload);
        setNotification({ message: 'Customer updated successfully!', type: 'success' });
      } else {
        await api.post('/customers', payload);
        setNotification({ message: 'Customer created successfully!', type: 'success' });
      }

      setIsDrawerOpen(false);
      fetchCustomers();
    } catch (err: any) {
      setNotification({ message: err.message || 'Operation failed', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTaka = (paisaMinor: number) => {
    return `৳${(paisaMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const total = customers.length;
    const repeat = customers.filter((c) => c.totalOrdersCount > 1).length;
    const totalSpent = customers.reduce((acc, c) => acc + c.totalSpentMinor, 0);
    const avgSpent = total > 0 ? totalSpent / total : 0;
    const avgDeliveredRate =
      total > 0
        ? Math.round(customers.reduce((acc, c) => acc + c.deliveredRate, 0) / total)
        : 100;
    return { total, repeat, avgSpent, avgDeliveredRate };
  }, [customers]);

  return (
    <div className="flex min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] transition-colors">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <div className="p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Notification */}
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

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Customer CRM & Buyer Profiles
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Normalized +8801 phone registry, delivery success rate, segmentation tags, and order history.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={fetchCustomers}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenDrawer()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Customer</span>
              </button>
            </div>
          </div>

          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                Total Customers
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</div>
              <span className="text-[11px] text-slate-400 mt-1 block">Registered in tenant CRM</span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider block mb-1">
                Repeat Buyers
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stats.repeat}</div>
              <span className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1 block">
                {stats.total > 0 ? Math.round((stats.repeat / stats.total) * 100) : 0}% repeat rate
              </span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider block mb-1">
                Delivered Success Rate
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.avgDeliveredRate}%
              </div>
              <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">
                Low COD return risk
              </span>
            </div>

            <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
              <span className="text-[11px] font-semibold text-purple-500 uppercase tracking-wider block mb-1">
                Avg Lifetime Spend
              </span>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatTaka(stats.avgSpent)}
              </div>
              <span className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1 block">Per customer</span>
            </div>
          </div>

          {/* Search & Tags Filter */}
          <div className="bg-white dark:bg-[#121826] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search customers by name, phone (+8801...)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchCustomers()}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedTagId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  selectedTagId === 'all'
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                All Customers
              </button>
              {tagsList.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagId(tag.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    selectedTagId === tag.id
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Customer CRM Table */}
          <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-4">Customer & Phone</th>
                    <th className="py-4 px-4">Primary Address</th>
                    <th className="py-4 px-4 text-center">Orders</th>
                    <th className="py-4 px-4 text-center">Delivered Rate</th>
                    <th className="py-4 px-4 text-right">Total Spent</th>
                    <th className="py-4 px-4">Tags</th>
                    <th className="py-4 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                        <span>Loading CRM profiles...</span>
                      </td>
                    </tr>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No customers found</p>
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => {
                      const primaryAddr = c.addresses?.[0];
                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-4 px-4">
                            <span className="font-bold text-slate-900 dark:text-white text-sm block">
                              {c.fullName || 'Walk-in Buyer'}
                            </span>
                            <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                              {c.phone}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            {primaryAddr ? (
                              <div>
                                <span className="font-medium text-slate-800 dark:text-slate-200 block">
                                  {primaryAddr.district}, {primaryAddr.division}
                                </span>
                                <span className="text-[11px] text-slate-400 block truncate max-w-[180px]">
                                  {primaryAddr.addressLine1 || '—'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">No saved address</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {c.totalOrdersCount}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {c.deliveredOrdersCount} delivered
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                                c.deliveredRate >= 80
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                  : c.deliveredRate >= 50
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                              }`}
                            >
                              {c.deliveredRate}%
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-bold text-slate-900 dark:text-white">
                            {formatTaka(c.totalSpentMinor)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {c.tags && c.tags.length > 0 ? (
                                c.tags.map((t) => (
                                  <span
                                    key={t.id}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50"
                                  >
                                    {t.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              onClick={() => handleOpenDrawer(c)}
                              className="px-3 py-1.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Edit Profile
                            </button>
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

      {/* CUSTOMER PROFILE DRAWER */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => !isSubmitting && setIsDrawerOpen(false)}
          />

          <div className="relative w-full max-w-md bg-white dark:bg-[#121826] shadow-2xl h-full flex flex-col z-10 animate-in slide-in-from-right duration-200">
            <div className="p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>{selectedCustomer ? 'Edit Customer Profile' : 'New Customer Profile'}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  CRM record with Bangladesh address & tags.
                </p>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nusrat Jahan"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mobile Phone (+8801...) *
                </label>
                <input
                  type="text"
                  placeholder="017xxxxxxxx"
                  required
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="customer@domain.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Bangladesh Address */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Primary Address
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Division
                    </label>
                    <select
                      value={formDivision}
                      onChange={(e) => {
                        const divName = e.target.value;
                        setFormDivision(divName);
                        const dists = getDistrictsByDivision(divName);
                        if (dists.length > 0 && dists[0]) {
                          setFormDistrict(dists[0].name);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {BANGLADESH_DIVISIONS.map((d) => (
                        <option key={d.id} value={d.name}>
                          {d.name} ({d.bnName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      District
                    </label>
                    <select
                      value={formDistrict}
                      onChange={(e) => setFormDistrict(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      {availableDistricts.map((dst) => (
                        <option key={dst.id} value={dst.name}>
                          {dst.name} ({dst.bnName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Street Address / Thana
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Flat 3B, House 12, Road 4, Dhanmondi"
                    value={formAddressLine1}
                    onChange={(e) => setFormAddressLine1(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Tags */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Customer Tags
                </span>
                <div className="flex flex-wrap gap-2">
                  {tagsList.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setSelectedTagIds((prev) =>
                            isSelected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                          )
                        }
                        className={`px-3 py-1 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isSubmitting ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
