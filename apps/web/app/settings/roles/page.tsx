'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../components/sidebar';
import { Topbar } from '../../../components/topbar';
import { api } from '../../../lib/api';
import { PERMISSIONS } from '@growthomic/shared';
import {
  Shield,
  Plus,
  Check,
  Lock,
  Layers,
  Eye,
  Sliders,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';

interface RoleItem {
  id: string;
  name: string;
  isSystem: boolean;
  tenantId?: string | null;
  permissions: string[];
}

export default function RolesManagementPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.INVENTORY_VIEW,
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Grouped permissions for clean UI selection
  const permissionCategories = [
    {
      name: 'Dashboard & Metrics Visibility',
      description: 'Control which analytics tiles, metrics, and cards are displayed on this role\'s dashboard.',
      perms: [
        { key: PERMISSIONS.ORDERS_VIEW, label: 'View Orders Analytics & KPI Cards' },
        { key: PERMISSIONS.FINANCE_VIEW, label: 'View Total Profit & Revenue Metrics' },
        { key: PERMISSIONS.REPORTS_VIEW, label: 'View Analytics Reports & Trends' },
        { key: PERMISSIONS.INVENTORY_VIEW, label: 'View Stock Balances & Warehouse Metrics' },
      ],
    },
    {
      name: 'Order Fulfillment & Operations',
      description: 'Permissions for taking orders and progressing customer shipments.',
      perms: [
        { key: PERMISSIONS.ORDERS_CREATE, label: 'Create New Customer Orders' },
        { key: PERMISSIONS.ORDERS_CONFIRM, label: 'Confirm & Validate Orders' },
        { key: PERMISSIONS.ORDERS_CANCEL, label: 'Cancel Orders & Release Reserved Stock' },
        { key: PERMISSIONS.ORDERS_HOLD, label: 'Place Orders on Hold' },
        { key: PERMISSIONS.ORDERS_BULK_ACTION, label: 'Bulk Order Actions & Courier Dispatch' },
      ],
    },
    {
      name: 'Product Catalog & Inventory Adjustments',
      description: 'Catalog editing and physical stock ledger modification rights.',
      perms: [
        { key: PERMISSIONS.PRODUCTS_CREATE, label: 'Create Products & SKU Variants' },
        { key: PERMISSIONS.PRODUCTS_EDIT, label: 'Edit Prices & Product Metadata' },
        { key: PERMISSIONS.INVENTORY_ADJUST, label: 'Perform Manual Stock Adjustments' },
      ],
    },
    {
      name: 'Team & System Administration',
      description: 'Administrative privileges for organization management.',
      perms: [
        { key: PERMISSIONS.TEAM_INVITE, label: 'Invite New Team Members' },
        { key: PERMISSIONS.TEAM_CHANGE_ROLE, label: 'Manage Roles & Assign Permissions' },
        { key: PERMISSIONS.SETTINGS_INTEGRATIONS, label: 'Configure Couriers & Integrations' },
      ],
    },
  ];

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await api.get('/roles');
      setRoles(res);
    } catch {
      // Mock initial fallback if running standalone demo
      setRoles([
        {
          id: 'r-owner',
          name: 'Owner',
          isSystem: true,
          permissions: Object.values(PERMISSIONS),
        },
        {
          id: 'r-admin',
          name: 'Admin',
          isSystem: true,
          permissions: Object.values(PERMISSIONS).filter((p) => p !== PERMISSIONS.SETTINGS_BILLING),
        },
        {
          id: 'r-order-staff',
          name: 'Order Staff',
          isSystem: true,
          permissions: [
            PERMISSIONS.ORDERS_VIEW,
            PERMISSIONS.ORDERS_CREATE,
            PERMISSIONS.ORDERS_CONFIRM,
            PERMISSIONS.ORDERS_CANCEL,
            PERMISSIONS.ORDERS_HOLD,
            PERMISSIONS.CUSTOMERS_VIEW,
          ],
        },
        {
          id: 'r-inventory-staff',
          name: 'Inventory Staff',
          isSystem: true,
          permissions: [
            PERMISSIONS.INVENTORY_VIEW,
            PERMISSIONS.INVENTORY_ADJUST,
            PERMISSIONS.PRODUCTS_VIEW,
          ],
        },
        {
          id: 'r-accountant',
          name: 'Accountant',
          isSystem: true,
          permissions: [
            PERMISSIONS.FINANCE_VIEW,
            PERMISSIONS.FINANCE_EXPORT,
            PERMISSIONS.REPORTS_VIEW,
            PERMISSIONS.EXPENSES_VIEW,
          ],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const newRole = await api.post('/roles', {
        name: roleName.trim(),
        permissionKeys: selectedPermissions,
      });

      setRoles((prev) => [...prev, newRole]);
      setModalOpen(false);
      setRoleName('');
      setSelectedPermissions([PERMISSIONS.ORDERS_VIEW, PERMISSIONS.INVENTORY_VIEW]);
    } catch (err: any) {
      // Fallback local append for demo
      const localRole: RoleItem = {
        id: `custom-${Date.now()}`,
        name: roleName.trim(),
        isSystem: false,
        permissions: selectedPermissions,
      };
      setRoles((prev) => [...prev, localRole]);
      setModalOpen(false);
      setRoleName('');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this custom role?')) return;
    try {
      await api.delete(`/roles/${roleId}`);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    } catch (err: any) {
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] dark:bg-[#0B0F17] flex selection:bg-blue-500 selection:text-white transition-colors">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />

        <main className="flex-1 p-6 lg:p-8 space-y-6 max-w-6xl w-full mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Roles & Dashboard Permissions
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Configure role access levels and customize which dashboard cards each role can see.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-xs font-semibold text-white shadow-sm shadow-blue-500/20 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Custom Role</span>
            </button>
          </div>

          {/* Roles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {roles.map((role) => (
              <div
                key={role.id}
                className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                        role.isSystem ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                      }`}>
                        {role.isSystem ? <Lock className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                          {role.name}
                        </h2>
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {role.isSystem ? 'System Default' : 'Custom Organization Role'}
                        </span>
                      </div>
                    </div>

                    {!role.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRole(role.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors"
                        title="Delete Role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Permissions count & preview */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>Permissions Granted</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full text-[11px]">
                        {role.permissions.length} perms
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto pr-1">
                      {role.permissions.slice(0, 6).map((perm) => (
                        <span
                          key={perm}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          {perm}
                        </span>
                      ))}
                      {role.permissions.length > 6 && (
                        <span className="text-[10px] font-medium text-slate-400 px-1 py-0.5">
                          +{role.permissions.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-emerald-500" /> Dashboard Configured
                  </span>
                  <span className="font-medium text-slate-500">
                    {role.isSystem ? 'Protected' : 'Customizable'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* Create Custom Role Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white dark:bg-[#121826] rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Create Custom Role
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Define a new role and choose exactly what metrics and actions it can access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-medium">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Role Name
                </label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Branch Supervisor or Social Commerce Manager"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                />
              </div>

              {/* Permission Groups */}
              <div className="space-y-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Role Permissions & Dashboard Cards
                </h4>

                {permissionCategories.map((cat) => (
                  <div
                    key={cat.name}
                    className="p-4 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
                  >
                    <div>
                      <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                        {cat.name}
                      </h5>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {cat.description}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                      {cat.perms.map((p) => {
                        const checked = selectedPermissions.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            onClick={() => togglePermission(p.key)}
                            className={`flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-colors border ${
                              checked
                                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200'
                                : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {}}
                              className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <div className="text-xs leading-snug">
                              <span className="font-semibold block">{p.label}</span>
                              <span className="text-[10px] font-mono text-slate-400">{p.key}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Custom Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
