import { supabase } from './supabase';

const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  // Attach Supabase JWT session token if available
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  } else {
    // Check localStorage fallback for demo/test session, or default to demo admin in dev
    if (typeof window !== 'undefined') {
      const mockToken =
        localStorage.getItem('demo_auth_token') ||
        'test-token:00000000-0000-0000-0000-000000000001:demo@growthomic.com';
      if (mockToken) {
        headers.set('Authorization', `Bearer ${mockToken}`);
      }
    }
  }

  // Attach active tenant ID if present in localStorage or default demo tenant
  if (typeof window !== 'undefined') {
    const activeTenantId =
      localStorage.getItem('active_tenant_id') ||
      '00000000-0000-0000-0000-000000000001';
    if (activeTenantId && !headers.has('x-tenant-id')) {
      headers.set('x-tenant-id', activeTenantId);
    }
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = (data && typeof data === 'object' && data.message)
      ? Array.isArray(data.message) ? data.message.join(', ') : data.message
      : response.statusText || 'Request failed';
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(path: string, options?: RequestInit) =>
    apiFetch<T>(path, { ...options, method: 'GET' }),
  post: <T = any>(path: string, body?: any, options?: RequestInit) => {
    const init: RequestInit = { ...options, method: 'POST' };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return apiFetch<T>(path, init);
  },
  patch: <T = any>(path: string, body?: any, options?: RequestInit) => {
    const init: RequestInit = { ...options, method: 'PATCH' };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return apiFetch<T>(path, init);
  },
  put: <T = any>(path: string, body?: any, options?: RequestInit) => {
    const init: RequestInit = { ...options, method: 'PUT' };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return apiFetch<T>(path, init);
  },
  delete: <T = any>(path: string, options?: RequestInit) =>
    apiFetch<T>(path, { ...options, method: 'DELETE' }),

  // M10 Subscriptions & Billing
  subscriptions: {
    getPlans: () => api.get<any[]>('/subscriptions/plans'),
    getCurrent: () => api.get<any>('/subscriptions/current'),
    submitManualPayment: (body: any) => api.post<any>('/subscriptions/manual-payment', body),
    getManualPayments: () => api.get<any[]>('/subscriptions/manual-payments'),
    getInvoices: () => api.get<any[]>('/subscriptions/invoices'),
  },

  // M10 Platform Super-Admin
  admin: {
    getPendingPayments: () => api.get<any[]>('/admin/payments/pending'),
    verifyPayment: (id: string, body: { decision: 'verified' | 'rejected'; rejectionReason?: string | undefined }) =>
      api.post<any>(`/admin/payments/${id}/verify`, body),
    getTenants: () => api.get<any[]>('/admin/tenants'),
    getStats: () => api.get<any>('/admin/stats'),
  },

  // M11 Onboarding & Setup Wizard
  onboarding: {
    getStatus: () => api.get<any>('/onboarding/status'),
    saveStoreProfile: (body: any) => api.post<any>('/onboarding/store-profile', body),
    saveWarehouse: (body: any) => api.post<any>('/onboarding/warehouse', body),
    saveCourier: (body: any) => api.post<any>('/onboarding/courier', body),
    saveProduct: (body: any) => api.post<any>('/onboarding/product', body),
    complete: () => api.post<any>('/onboarding/complete'),
  },

  // M11 Data Import Tools & Undo
  imports: {
    dryRun: (body: { entityType: string; fileName: string; rows: any[] }) =>
      api.post<any>('/imports/dry-run', body),
    commit: (body: { entityType: string; fileName: string; rows: any[] }) =>
      api.post<any>('/imports/commit', body),
    listBatches: (page = 1, limit = 20) =>
      api.get<any>(`/imports/batches?page=${page}&limit=${limit}`),
    undoBatch: (batchId: string) =>
      api.post<any>(`/imports/batches/${batchId}/undo`),
  },

  // Customer Privacy / Anonymization
  customers: {
    anonymize: (customerId: string) =>
      api.post<any>(`/customers/${customerId}/anonymize`),
  },
};

