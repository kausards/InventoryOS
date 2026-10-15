'use client';

import React from 'react';
import { X, PieChart, BarChart2, TrendingUp, Users, Check } from 'lucide-react';

interface WidgetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WidgetDrawer({ isOpen, onClose }: WidgetDrawerProps) {
  const [selectedWidgets, setSelectedWidgets] = React.useState<string[]>(['overview', 'orders']);

  if (!isOpen) return null;

  const widgets = [
    {
      id: 'visitors-by-device',
      title: 'Visitors by Device',
      description: 'Track how customers access your store across mobile, desktop, and tablet.',
      tag: '#Audience Insights',
      icon: PieChart,
      iconColor: 'text-blue-500 bg-blue-50 dark:bg-blue-950/50',
    },
    {
      id: 'dashboard-overview',
      title: 'Dashboard Overview',
      description: 'View key business metrics and performance trends in one consolidated place.',
      tag: '#Performance',
      icon: TrendingUp,
      iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      id: 'orders-performance',
      title: 'Orders Performance',
      description: 'Monitor order volume, fulfillment status, and sales velocity in real-time.',
      tag: '#Operations',
      icon: BarChart2,
      iconColor: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/50',
    },
    {
      id: 'trend-analysis',
      title: 'Trend Analysis',
      description: 'Group customers by buying behavior and seasonal demographics for targeted strategy.',
      tag: '#Strategy',
      icon: TrendingUp,
      iconColor: 'text-amber-500 bg-amber-50 dark:bg-amber-950/50',
    },
    {
      id: 'customer-segmentation',
      title: 'Customer Segmentation',
      description: 'Breakdown of Retailers, Distributors, and Wholesalers by Lifetime Value.',
      tag: '#Retention',
      icon: Users,
      iconColor: 'text-rose-500 bg-rose-50 dark:bg-rose-950/50',
    },
  ];

  const toggleWidget = (id: string) => {
    setSelectedWidgets((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Card Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-[#121826] h-full shadow-2xl flex flex-col z-10 border-l border-slate-200/80 dark:border-slate-800/80 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Add Widget
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Customize and pin live analytics tiles to your dashboard
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Widgets */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {widgets.map((widget) => {
            const isSelected = selectedWidgets.includes(widget.id);
            const Icon = widget.icon;

            return (
              <div
                key={widget.id}
                className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-blue-400/50 dark:hover:border-blue-500/50 transition-all"
              >
                <div className="flex items-start gap-3.5 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${widget.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      {widget.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {widget.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/40 dark:border-slate-800/60">
                  <span className="text-[10px] font-medium text-slate-400 bg-white dark:bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700">
                    {widget.tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleWidget(widget.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3 h-3" /> Selected
                      </>
                    ) : (
                      'Select'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20"
          >
            Apply to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
