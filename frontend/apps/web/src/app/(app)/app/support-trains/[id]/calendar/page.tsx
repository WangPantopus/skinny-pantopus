'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, List, Printer,
  ChefHat, ShoppingCart, Truck,
} from 'lucide-react';

// ============================================================
// SUPPORT TRAIN CALENDAR VIEW (Web)
// Month grid + list toggle, print-friendly
// ============================================================

type ViewMode = 'calendar' | 'list';

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  open:      { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  full:      { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
  canceled:  { bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-600 dark:text-red-300', dot: 'bg-red-400' },
  completed: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-300', dot: 'bg-blue-500' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SupportTrainCalendarPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const fetchData = useCallback(async () => {
    if (!getAuthToken()) { router.push('/login'); return; }
    try {
      const result = await api.supportTrains.getSupportTrain(id);
      setData(result);
    } catch { /* handled by empty state */ }
  }, [id, router]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const slots: any[] = data?.slots || [];

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of slots) {
      (map[s.slot_date] ||= []).push(s);
    }
    return map;
  }, [slots]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ date: string | null; day: number }> = [];

    for (let i = 0; i < firstDay; i++) days.push({ date: null, day: 0 });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, day: d });
    }
    return days;
  }, [currentMonth]);

  // List view: group by week
  const weekGroups = useMemo(() => {
    const sorted = [...slots].sort((a, b) => a.slot_date.localeCompare(b.slot_date));
    const groups: Array<{ weekLabel: string; slots: any[] }> = [];
    let currentWeek = '';

    for (const s of sorted) {
      const d = new Date(s.slot_date + 'T00:00:00Z');
      const weekStart = new Date(d);
      weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

      if (label !== currentWeek) {
        groups.push({ weekLabel: `Week of ${label}`, slots: [] });
        currentWeek = label;
      }
      groups[groups.length - 1].slots.push(s);
    }
    return groups;
  }, [slots]);

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/app/support-trains/${id}`)} className="text-sm text-app-text-secondary hover:text-app-text flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />Back
          </button>
          <h1 className="text-xl font-bold text-app-text">{data?.title || 'Support Train'} — Schedule</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-lg transition ${viewMode === 'calendar' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-app-text-muted hover:bg-app-surface-sunken'}`}>
            <Calendar className="w-5 h-5" />
          </button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition ${viewMode === 'list' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-app-text-muted hover:bg-app-surface-sunken'}`}>
            <List className="w-5 h-5" />
          </button>
          <button onClick={() => window.print()} className="p-2 rounded-lg text-app-text-muted hover:bg-app-surface-sunken transition print:hidden">
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs print:mb-2">
        {Object.entries(STATUS_COLORS).map(([status, c]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
            <span className="text-app-text-secondary capitalize">{status}</span>
          </span>
        ))}
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <>
          <div className="flex items-center justify-between mb-4 print:hidden">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-app-surface-sunken">
              <ChevronLeft className="w-5 h-5 text-app-text-secondary" />
            </button>
            <h2 className="text-lg font-semibold text-app-text">{monthLabel}</h2>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-app-surface-sunken">
              <ChevronRight className="w-5 h-5 text-app-text-secondary" />
            </button>
          </div>
          <div className="hidden print:block text-center text-lg font-semibold mb-4">{monthLabel}</div>

          <div className="grid grid-cols-7 border border-app-border rounded-xl overflow-hidden">
            {DAYS.map(d => (
              <div key={d} className="p-2 text-center text-xs font-semibold text-app-text-muted bg-app-surface-sunken border-b border-app-border">{d}</div>
            ))}
            {calendarDays.map((cell, i) => {
              const daySlots = cell.date ? (slotsByDate[cell.date] || []) : [];
              return (
                <div key={i} className={`min-h-[80px] p-1.5 border-b border-r border-app-border last:border-r-0 ${!cell.date ? 'bg-app-surface-sunken/50' : 'bg-app-surface'}`}>
                  {cell.date && (
                    <>
                      <span className="text-xs text-app-text-muted">{cell.day}</span>
                      <div className="space-y-1 mt-1">
                        {daySlots.map((s: any) => {
                          const c = STATUS_COLORS[s.status] || STATUS_COLORS.open;
                          const ModeIcon = s.support_mode === 'meal' ? ChefHat : s.support_mode === 'groceries' ? ShoppingCart : Truck;
                          return (
                            <div key={s.id} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${c.bg} ${c.text} cursor-pointer hover:opacity-80 transition`}>
                              <ModeIcon className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{s.slot_label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-6">
          {weekGroups.length === 0 ? (
            <p className="text-center py-16 text-app-text-secondary">No slots scheduled</p>
          ) : (
            weekGroups.map((group, gi) => (
              <div key={gi}>
                <h3 className="text-sm font-semibold text-app-text-muted mb-3">{group.weekLabel}</h3>
                <div className="space-y-2">
                  {group.slots.map((s: any) => {
                    const c = STATUS_COLORS[s.status] || STATUS_COLORS.open;
                    const d = new Date(s.slot_date + 'T00:00:00Z');
                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
                    const ModeIcon = s.support_mode === 'meal' ? ChefHat : s.support_mode === 'groceries' ? ShoppingCart : Truck;

                    return (
                      <div key={s.id} className={`flex items-center gap-4 p-3 rounded-lg border border-app-border ${c.bg}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg}`}>
                          <ModeIcon className={`w-4 h-4 ${c.text}`} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${c.text}`}>{s.slot_label} — {dateStr}</p>
                          {s.start_time && <p className="text-xs text-app-text-muted">{s.start_time}{s.end_time ? ` - ${s.end_time}` : '+'}</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text} capitalize`}>{s.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-5xl, .max-w-5xl * { visibility: visible; }
          .max-w-5xl { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:mb-2 { margin-bottom: 0.5rem; }
        }
      `}</style>
    </div>
  );
}
