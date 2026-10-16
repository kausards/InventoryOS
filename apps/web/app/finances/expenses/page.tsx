'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import {
  Receipt,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  Edit2,
  Tag,
  Calendar,
  Building,
  TrendingDown,
} from 'lucide-react';

interface ExpenseItem {
  id: string;
  expenseNumber: string;
  title: string;
  category: string;
  amountMinor: number;
  currency: string;
  expenseDate: string;
  paymentStatus: string;
  paymentMethod: string;
  description: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

interface CategorySummaryItem {
  category: string;
  totalMinor: number;
  count: number;
  percentage: number;
}

export default function OperatingExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummaryItem[]>([]);
  const [grandTotalMinor, setGrandTotalMinor] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    category: 'marketing' as const,
    amountMajor: '',
    paymentStatus: 'paid' as 'paid' | 'unpaid' | 'partial',
    paymentMethod: 'bank' as const,
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedStatus !== 'all') params.append('paymentStatus', selectedStatus);

      const [expensesRes, summaryRes] = await Promise.all([
        api.get(`/expenses?${params.toString()}`),
        api.get('/expenses/summary'),
      ]);

      if (expensesRes && Array.isArray(expensesRes.items)) {
        setExpenses(expensesRes.items);
        setTotal(expensesRes.total ?? expensesRes.items.length);
      } else {
        setExpenses([]);
      }

      if (summaryRes && Array.isArray(summaryRes.categories)) {
        setCategorySummary(summaryRes.categories);
        setGrandTotalMinor(summaryRes.grandTotalMinor ?? 0);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load operating expenses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedCategory, selectedStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(form.amountMajor);
    if (isNaN(amountVal) || amountVal <= 0) {
      setNotification({ message: 'Please enter a valid positive amount', type: 'error' });
      return;
    }

    try {
      setSubmitting(true);
      const amountMinor = Math.round(amountVal * 100);

      if (editingId) {
        await api.put(`/expenses/${editingId}`, {
          title: form.title,
          category: form.category,
          amountMinor,
          paymentStatus: form.paymentStatus,
          paymentMethod: form.paymentMethod,
          description: form.description || undefined,
        });
        setNotification({ message: 'Expense updated successfully', type: 'success' });
      } else {
        await api.post('/expenses', {
          title: form.title,
          category: form.category,
          amountMinor,
          paymentStatus: form.paymentStatus,
          paymentMethod: form.paymentMethod,
          description: form.description || undefined,
        });
        setNotification({
          message: 'Expense created and posted to financial ledger',
          type: 'success',
        });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setForm({
        title: '',
        category: 'marketing',
        amountMajor: '',
        paymentStatus: 'paid',
        paymentMethod: 'bank',
        description: '',
      });
      fetchData();
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to save expense', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (exp: ExpenseItem) => {
    setEditingId(exp.id);
    setForm({
      title: exp.title,
      category: exp.category as any,
      amountMajor: (exp.amountMinor / 100).toString(),
      paymentStatus: exp.paymentStatus as any,
      paymentMethod: exp.paymentMethod as any,
      description: exp.description || '',
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, expNumber: string) => {
    if (!window.confirm(`Delete expense ${expNumber}?`)) return;

    try {
      await api.delete(`/expenses/${id}`);
      setNotification({ message: `Expense ${expNumber} deleted`, type: 'success' });
      fetchData();
    } catch (err: any) {
      setNotification({ message: err?.message || 'Failed to delete expense', type: 'error' });
    }
  };

  const formatTaka = (minor: number) => {
    const taka = minor / 100;
    return `৳${taka.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredExpenses = expenses.filter((e) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(term) ||
      e.expenseNumber.toLowerCase().includes(term) ||
      (e.description && e.description.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0c111d] text-slate-900 dark:text-slate-100 antialiased overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Topbar />

        <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Operating Expenses (Opex)
                </h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  PRD R.8
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Track overhead, rent, marketing, utilities, and software. Paid expenses auto-post to the ledger.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    title: '',
                    category: 'marketing',
                    amountMajor: '',
                    paymentStatus: 'paid',
                    paymentMethod: 'bank',
                    description: '',
                  });
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Expense</span>
              </button>

              <button
                onClick={fetchData}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm"
                title="Refresh Expenses"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2">
            <Link
              href="/finances"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              P&L Overview
            </Link>
            <Link
              href="/finances/ledger"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Transaction Ledger
            </Link>
            <Link
              href="/finances/expenses"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
            >
              Operating Expenses
            </Link>
            <Link
              href="/finances/settlements"
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              COD Settlements
            </Link>
          </div>

          {notification && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
                notification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                )}
                <span>{notification.message}</span>
              </div>
              <button onClick={() => setNotification(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Category Metrics Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs col-span-2 sm:col-span-1">
              <div className="text-[11px] text-slate-500 font-medium">Total Opex</div>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-1">
                {formatTaka(grandTotalMinor)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{total} recorded bills</div>
            </div>

            {categorySummary.slice(0, 5).map((cat) => (
              <div
                key={cat.category}
                className="p-3.5 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs"
              >
                <div className="text-[11px] text-slate-500 font-medium capitalize truncate">
                  {cat.category.replace('_', ' ')}
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                  {formatTaka(cat.totalMinor)}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">
                  {cat.percentage}% of total
                </div>
              </div>
            ))}
          </div>

          {/* Filters Bar */}
          <div className="p-4 rounded-xl bg-white dark:bg-[#121826] border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                <option value="all">All Categories</option>
                <option value="marketing">Marketing & Ads</option>
                <option value="rent">Rent & Facilities</option>
                <option value="utilities">Utilities & Bills</option>
                <option value="packaging_supplies">Packaging Supplies</option>
                <option value="software">Software & Apps</option>
                <option value="salaries">Salaries & Staff</option>
                <option value="maintenance">Maintenance</option>
                <option value="office">Office Supplies</option>
                <option value="other">Other</option>
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                <option value="all">All Payment Statuses</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid / Due</option>
                <option value="partial">Partially Paid</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search expense title or ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white dark:bg-[#121826] rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Expense #</th>
                    <th className="px-4 py-3">Title / Details</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Method & Status</th>
                    <th className="px-4 py-3 text-right">Amount (BDT)</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                        Loading expenses...
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-sans">
                        No operating expenses recorded yet. Click &quot;Add Expense&quot; to add one.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {new Date(exp.expenseDate).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">{exp.expenseNumber}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-white">{exp.title}</span>
                            {exp.description && (
                              <span className="text-[11px] text-slate-400 truncate max-w-xs">
                                {exp.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                            {exp.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="capitalize text-slate-500">{exp.paymentMethod}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                exp.paymentStatus === 'paid'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                              }`}
                            >
                              {exp.paymentStatus}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatTaka(exp.amountMinor)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(exp)}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title="Edit Expense"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(exp.id, exp.expenseNumber)}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Showing {filteredExpenses.length} of {total} expenses</span>
              <span>All amounts stored in paisa</span>
            </div>
          </div>

          {/* Add / Edit Expense Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#121826] rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {editingId ? 'Edit Operating Expense' : 'Add Operating Expense'}
                  </h3>
                  <button onClick={() => setIsModalOpen(false)}>
                    <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Expense Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Facebook Ads campaign, Office internet..."
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Category *
                      </label>
                      <select
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="marketing">Marketing & Ads</option>
                        <option value="rent">Rent & Facilities</option>
                        <option value="utilities">Utilities & Bills</option>
                        <option value="packaging_supplies">Packaging Supplies</option>
                        <option value="software">Software & Apps</option>
                        <option value="salaries">Salaries & Staff</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="office">Office Supplies</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Amount in BDT (৳) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 2500.00"
                        value={form.amountMajor}
                        onChange={(e) => setForm({ ...form, amountMajor: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Payment Status
                      </label>
                      <select
                        value={form.paymentStatus}
                        onChange={(e) => setForm({ ...form, paymentStatus: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="paid">Paid (Posts to Ledger)</option>
                        <option value="unpaid">Unpaid / Bill Due</option>
                        <option value="partial">Partially Paid</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={form.paymentMethod}
                        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="bank">Bank Transfer</option>
                        <option value="bkash">bKash</option>
                        <option value="nagad">Nagad</option>
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Description / Reference Note
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Invoice number, vendor name, or period note..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !form.title.trim() || !form.amountMajor}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>{editingId ? 'Update Expense' : 'Save & Post'}</span>
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
