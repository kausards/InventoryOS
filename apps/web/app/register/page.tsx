'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
import { ThemeToggle } from '../../components/theme-toggle';
import { ArrowRight, Building2, Lock, Mail, User, ShieldCheck, Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Sign up user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const userId = authData.user?.id || crypto.randomUUID();

      // 2. Call backend SaaS onboarding endpoint to create tenant and owner membership
      const signupRes = await api.post('/auth/signup', {
        userId,
        email,
        fullName,
        organizationName,
        timezone: 'Asia/Dhaka',
        currency: 'BDT',
      });

      if (signupRes.tenant?.id) {
        localStorage.setItem('active_tenant_id', signupRes.tenant.id);
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to create account and organization.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <header className="flex items-center justify-between max-w-6xl w-full mx-auto py-2">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <span className="text-lg tracking-tighter">S</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Shopeers
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md mx-auto my-8">
        <div className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="mb-6 text-center sm:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Create an organization
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Start managing multiple warehouses, orders, and sales channels.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Your Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Tanvir Ahmed"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Store / Company Name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="e.g. Apex Lifestyle Ltd"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold shadow-sm shadow-blue-500/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating Workspace...
                </>
              ) : (
                <>
                  Create Organization <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
            Already registered?{' '}
            <Link href="/login" className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Sign in to your organization
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Tenant Isolation Guarded by Supabase Postgres RLS</span>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400 dark:text-slate-600 py-2">
        Growthomic Inventory OS &copy; {new Date().getFullYear()} — Built for Bangladesh & Global E-Commerce
      </footer>
    </div>
  );
}
