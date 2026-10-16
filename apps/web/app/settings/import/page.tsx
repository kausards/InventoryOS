'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Package,
  Users,
  ShoppingCart,
  Download,
  Loader2,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { api } from '@/lib/api';

type ImportEntityType = 'products' | 'customers' | 'orders';

interface ImportBatch {
  id: string;
  entityType: string;
  fileName: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  status: 'completed' | 'reverted';
  createdAt: string;
  revertedAt?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export default function DataImportPage() {
  const [activeTab, setActiveTab] = useState<ImportEntityType>('products');
  const [rawCsv, setRawCsv] = useState<string>('');
  const [fileName, setFileName] = useState<string>('import.csv');
  const [validating, setValidating] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [loadingBatches, setLoadingBatches] = useState<boolean>(true);
  const [undoingBatchId, setUndoingBatchId] = useState<string | null>(null);

  // Dry run result
  const [dryRunResult, setDryRunResult] = useState<{
    totalRows: number;
    validRows: number;
    invalidRows: number;
    errors: ValidationError[];
    preview: any[];
  } | null>(null);

  // Batches history
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  // Messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Templates
  const templates: Record<ImportEntityType, { csv: string; headers: string[]; desc: string }> = {
    products: {
      csv: `name,sku,category,retailPrice,purchaseCost,stockQuantity\nPremium Cotton Panjabi,PANJ-001,Clothing,2500,1200,50\nEmbroidered Silk Saree,SAR-002,Women Fashion,5800,2800,20\nFormal Slim Fit Shirt,SHRT-003,Men Fashion,1450,700,35`,
      headers: ['name', 'sku', 'category', 'retailPrice', 'purchaseCost', 'stockQuantity'],
      desc: 'Import product titles, SKUs, pricing (in BDT ৳), cost, and initial stock quantities into the default warehouse.',
    },
    customers: {
      csv: `name,phone,address,division,district,upazilaThana\nFarhan Ahmed,01712345678,House 14 Road 5 Dhanmondi,Dhaka,Dhaka,Dhanmondi\nNusrat Jahan,01819876543,GEC Circle Nasirabad,Chattogram,Chattogram,Panchlaish\nZahid Hasan,01911223344,Kazir Dewri,Chattogram,Chattogram,Kotwali`,
      headers: ['name', 'phone', 'address', 'division', 'district', 'upazilaThana'],
      desc: 'Import customer contacts with normalized Bangladeshi phone numbers (+880) and delivery addresses.',
    },
    orders: {
      csv: `customerName,customerPhone,sku,quantity,unitPrice,deliveryCharge,orderStatus,paymentMethod\nTanvir Rahman,01711223344,PANJ-001,2,2500,60,delivered,cod\nSadia Islam,01822334455,SAR-002,1,5800,120,delivered,bkash`,
      headers: ['customerName', 'customerPhone', 'sku', 'quantity', 'unitPrice', 'deliveryCharge', 'orderStatus', 'paymentMethod'],
      desc: 'Import historical past orders for lifetime value reporting and customer purchase history.',
    },
  };

  // Set default raw CSV when tab switches
  useEffect(() => {
    setRawCsv(templates[activeTab].csv);
    setFileName(`${activeTab}-import.csv`);
    setDryRunResult(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [activeTab]);

  // Load batch history
  const fetchBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await api.imports.listBatches(1, 20);
      setBatches(res.items || []);
    } catch (err: any) {
      console.error('Failed to load import batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  // Parse CSV string to JSON records
  const parseCsvToJson = (csv: string): any[] => {
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]!;
      // Simple regex parser handling quoted commas
      const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      const rowObj: Record<string, any> = {};
      headers.forEach((header, idx) => {
        let val = matches[idx] ? matches[idx]!.trim().replace(/^"|"$/g, '') : '';
        rowObj[header] = val;
      });
      rows.push(rowObj);
    }
    return rows;
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      setRawCsv(text);
      setDryRunResult(null);
    };
    reader.readAsText(file);
  };

  // Run Dry-Run Validation
  const handleDryRun = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const rows = parseCsvToJson(rawCsv);
    if (rows.length === 0) {
      setErrorMsg('No valid data rows found in CSV. Please ensure header and at least 1 record exist.');
      return;
    }

    setValidating(true);
    try {
      const res = await api.imports.dryRun({
        entityType: activeTab,
        fileName,
        rows,
      });
      setDryRunResult(res);
      if (res.invalidRows === 0) {
        setSuccessMsg(`Dry-Run passed! All ${res.validRows} rows are valid and ready to commit.`);
      } else {
        setErrorMsg(`Dry-Run detected ${res.invalidRows} issue(s) across rows. Please review below.`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Dry-run validation failed');
    } finally {
      setValidating(false);
    }
  };

  // Commit Import
  const handleCommit = async () => {
    const rows = parseCsvToJson(rawCsv);
    if (rows.length === 0) return;

    setCommitting(true);
    setErrorMsg(null);
    try {
      const res = await api.imports.commit({
        entityType: activeTab,
        fileName,
        rows,
      });
      setSuccessMsg(res.message || 'Import completed successfully!');
      setDryRunResult(null);
      await fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit import');
    } finally {
      setCommitting(false);
    }
  };

  // Undo Last Batch
  const handleUndoBatch = async (batchId: string) => {
    if (!confirm('Are you sure you want to rollback this import? All entities created by this batch will be safely removed.')) {
      return;
    }

    setUndoingBatchId(batchId);
    setErrorMsg(null);
    try {
      const res = await api.imports.undoBatch(batchId);
      setSuccessMsg(res.message || `Batch reverted successfully. Rolled back ${res.revertedCount} records.`);
      await fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to rollback import batch');
    } finally {
      setUndoingBatchId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Data Import Tools
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Bulk import catalog products, customers, and order history with formula injection protection and 1-click undo.
          </p>
        </div>

        {/* Anti-Formula Injection Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4" />
          <span>Formula Injection Guard Active</span>
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

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'products'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Products & Stock</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'customers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Customers & CRM</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'orders'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Historical Orders</span>
        </button>
      </div>

      {/* Main Import Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Editor & Upload */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white capitalize">
                  {activeTab} CSV Data
                </h2>
                <p className="text-xs text-slate-500">{templates[activeTab].desc}</p>
              </div>

              {/* Upload button */}
              <label className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Upload CSV File</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* CSV Textarea */}
            <div className="space-y-1.5">
              <textarea
                value={rawCsv}
                onChange={(e) => {
                  setRawCsv(e.target.value);
                  setDryRunResult(null);
                }}
                rows={9}
                className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                placeholder="Paste CSV rows here..."
              />
              <span className="text-[11px] text-slate-400">
                Active file name: <strong className="text-slate-700 dark:text-slate-300">{fileName}</strong>
              </span>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRawCsv(templates[activeTab].csv)}
                className="text-xs text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
              >
                Reset to sample template
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleDryRun}
                  disabled={validating || committing}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                  <span>Dry-Run Validate</span>
                </button>

                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={committing || validating || !dryRunResult || dryRunResult.validRows === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {committing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>Commit Import ({dryRunResult ? dryRunResult.validRows : 0} Rows)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dry Run Preview & Errors */}
          {dryRunResult && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Dry-Run Preview & Validation Results
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                    Total: {dryRunResult.totalRows}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Valid: {dryRunResult.validRows}
                  </span>
                  {dryRunResult.invalidRows > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold">
                      Invalid: {dryRunResult.invalidRows}
                    </span>
                  )}
                </div>
              </div>

              {/* Error list */}
              {dryRunResult.errors.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-1.5 text-xs text-rose-700 dark:text-rose-300">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Validation Errors ({dryRunResult.errors.length})
                  </div>
                  <ul className="list-disc pl-5 space-y-1 max-h-36 overflow-y-auto">
                    {dryRunResult.errors.map((err, i) => (
                      <li key={i}>
                        Row {err.row}: <strong>{err.field}</strong> — {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      {templates[activeTab].headers.map((h) => (
                        <th key={h} className="py-2.5 px-3 font-semibold uppercase text-[10px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {dryRunResult.preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        {templates[activeTab].headers.map((h) => (
                          <td key={h} className="py-2 px-3 text-slate-700 dark:text-slate-300 truncate max-w-[160px]">
                            {String(row[h] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Specifications & Instructions */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600" />
              CSV Format Specifications
            </h3>

            <div className="space-y-2 text-slate-600 dark:text-slate-400">
              <p>
                Columns must exactly match the header names below.
              </p>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 font-mono text-[11px] text-blue-600 dark:text-blue-400 break-words">
                {templates[activeTab].headers.join(', ')}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 space-y-2">
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                Formula Injection Protection
              </h4>
              <p className="text-slate-500 leading-relaxed">
                Shopeers automatically neutralizes spreadsheet formula injection attacks. Any cell starting with{' '}
                <code className="text-rose-500 font-mono">=</code>, <code className="text-rose-500 font-mono">+</code>,{' '}
                <code className="text-rose-500 font-mono">-</code>, or <code className="text-rose-500 font-mono">@</code>{' '}
                is stripped on intake and escaped on export to prevent malicious code execution in Excel or Google Sheets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Undo Last Batch / History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-blue-600" />
              Import History & Undo Last Batch
            </h3>
            <p className="text-xs text-slate-500">
              Made a mistake with an import? You can safely revert any completed batch.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchBatches}
            className="text-xs text-blue-600 hover:underline"
          >
            Refresh
          </button>
        </div>

        {loadingBatches ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : batches.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No previous import batches found for this store.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Entity</th>
                  <th className="py-2.5 px-3 font-semibold">File Name</th>
                  <th className="py-2.5 px-3 font-semibold">Rows</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Date</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold capitalize text-slate-900 dark:text-white">
                      {batch.entityType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {batch.fileName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {batch.successfulRows} / {batch.totalRows}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          batch.status === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {batch.status === 'completed' ? 'Active' : 'Reverted'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(batch.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {batch.status === 'completed' ? (
                        <button
                          type="button"
                          onClick={() => handleUndoBatch(batch.id)}
                          disabled={undoingBatchId === batch.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-semibold transition-all disabled:opacity-50"
                        >
                          {undoingBatchId === batch.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Undo Batch</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">Rolled back</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
