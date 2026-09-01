'use client';

import { useMemo, type ReactNode } from 'react';
import { ClipboardList, Wallet, Calendar, Package, Zap, CircleAlert, Hand } from 'lucide-react';

/**
 * HouseholdCalendar — mini calendar + AI-suggested reminders widget.
 *
 * Sits in the home dashboard overview tab. Aggregates upcoming tasks,
 * bills, and events into a unified "next 7 days" timeline and surfaces
 * smart nudges like "Upcoming bill due in 3 days — auto-pay?"
 */

type CalendarEntry = {
  id: string;
  type: 'task' | 'bill' | 'event' | 'package';
  title: string;
  date: Date;
  meta?: string;
  icon: ReactNode;
  accent: string;
};

type Reminder = {
  id: string;
  icon: ReactNode;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
  accent: string;
};

export default function HouseholdCalendar({
  tasks,
  bills,
  events,
  packages,
}: {
  tasks: Record<string, any>[];
  bills: Record<string, any>[];
  events: Record<string, any>[];
  packages: Record<string, any>[];
}) {
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // ── Build unified timeline entries ──────────────────────────
  const entries = useMemo<CalendarEntry[]>(() => {
    const items: CalendarEntry[] = [];

    // Tasks with due dates
    for (const t of tasks) {
      if (!t.due_at || t.status === 'done' || t.status === 'canceled') continue;
      const d = new Date(t.due_at);
      if (d < now || d > weekAhead) continue;
      items.push({
        id: `task-${t.id}`,
        type: 'task',
        title: t.title,
        date: d,
        meta: t.assigned_to ? 'Assigned' : 'Unassigned',
        icon: <ClipboardList className="w-4 h-4" />,
        accent: 'border-l-violet-400',
      });
    }

    // Bills with due dates
    for (const b of bills) {
      if (b.status === 'paid' || b.status === 'canceled') continue;
      const d = b.due_date ? new Date(b.due_date) : null;
      if (!d || d > weekAhead) continue;
      items.push({
        id: `bill-${b.id}`,
        type: 'bill',
        title: b.provider_name || b.bill_type?.replace('_', ' ') || 'Bill',
        date: d,
        meta: `$${Number(b.amount || 0).toFixed(2)}`,
        icon: <Wallet className="w-4 h-4" />,
        accent: d < now ? 'border-l-red-400' : 'border-l-amber-400',
      });
    }

    // Events
    for (const e of events) {
      const d = e.start_at ? new Date(e.start_at) : null;
      if (!d || d < now || d > weekAhead) continue;
      items.push({
        id: `event-${e.id}`,
        type: 'event',
        title: e.title,
        date: d,
        icon: <Calendar className="w-4 h-4" />,
        accent: 'border-l-blue-400',
      });
    }

    // Packages expected
    for (const p of packages) {
      if (p.status === 'picked_up' || p.status === 'returned') continue;
      const d = p.expected_at ? new Date(p.expected_at) : null;
      if (!d || d < now || d > weekAhead) continue;
      items.push({
        id: `pkg-${p.id}`,
        type: 'package',
        title: p.carrier ? `${p.carrier} package` : 'Package arriving',
        date: d,
        icon: <Package className="w-4 h-4" />,
        accent: 'border-l-emerald-400',
      });
    }

    return items.sort((a, b) => a.date.getTime() - b.date.getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` and `weekAhead` are intentionally excluded; they are computed once per render
  }, [tasks, bills, events, packages]);

  // ── AI-suggested reminders ──────────────────────────────────
  const reminders = useMemo<Reminder[]>(() => {
    const r: Reminder[] = [];

    // Bills due within 3 days
    for (const b of bills) {
      if (b.status === 'paid' || b.status === 'canceled') continue;
      const d = b.due_date ? new Date(b.due_date) : null;
      if (!d) continue;
      const daysUntil = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0 && daysUntil <= 3) {
        const name = b.provider_name || b.bill_type?.replace('_', ' ') || 'Bill';
        r.push({
          id: `remind-bill-${b.id}`,
          icon: <Zap className="w-4 h-4" />,
          text: daysUntil === 0
            ? `${name} ($${Number(b.amount || 0).toFixed(0)}) is due today`
            : `${name} ($${Number(b.amount || 0).toFixed(0)}) due in ${daysUntil} day${daysUntil > 1 ? 's' : ''} — auto-pay?`,
          actionLabel: 'Mark Paid',
          accent: 'bg-amber-50 border-amber-200',
        });
      }
      // Overdue bills
      if (d < now) {
        const daysOverdue = Math.ceil((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        r.push({
          id: `remind-overdue-${b.id}`,
          icon: <CircleAlert className="w-4 h-4 text-red-500" />,
          text: `${b.provider_name || b.bill_type} is ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue ($${Number(b.amount || 0).toFixed(0)})`,
          accent: 'bg-red-50 border-red-200',
        });
      }
    }

    // Tasks due soon with no assignee
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'canceled' || t.assigned_to) continue;
      const d = t.due_at ? new Date(t.due_at) : null;
      if (!d) continue;
      const daysUntil = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil >= 0 && daysUntil <= 2) {
        r.push({
          id: `remind-task-${t.id}`,
          icon: <Hand className="w-4 h-4" />,
          text: `"${t.title}" is due ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil > 1 ? 's' : ''}`} and has no one assigned`,
          actionLabel: 'Assign',
          accent: 'bg-violet-50 border-violet-200',
        });
      }
    }

    return r.slice(0, 4); // cap at 4 reminders
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` is intentionally excluded; it is computed once per render
  }, [tasks, bills]);

  if (entries.length === 0 && reminders.length === 0) return null;

  // ── Group entries by day ────────────────────────────────────
  const dayLabel = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const target = new Date(d);
    target.setHours(0, 0, 0, 0);

    if (target.getTime() === today.getTime()) return 'Today';
    if (target.getTime() === tomorrow.getTime()) return 'Tomorrow';
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const grouped: { label: string; items: CalendarEntry[] }[] = [];
  for (const entry of entries) {
    const lbl = dayLabel(entry.date);
    const last = grouped[grouped.length - 1];
    if (last && last.label === lbl) {
      last.items.push(entry);
    } else {
      grouped.push({ label: lbl, items: [entry] });
    }
  }

  return (
    <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-app-border-subtle">
        <h3 className="text-base font-semibold text-app-text flex items-center gap-2">
          <Calendar className="w-5 h-5" /> This Week
        </h3>
        <p className="text-xs text-app-text-secondary mt-0.5">
          {entries.length} upcoming item{entries.length !== 1 ? 's' : ''}
          {reminders.length > 0 && ` · ${reminders.length} reminder${reminders.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* AI Reminders */}
      {reminders.length > 0 && (
        <div className="px-4 pt-3 pb-1 space-y-2">
          {reminders.map((r) => (
            <div
              key={r.id}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border text-sm ${r.accent}`}
            >
              <span className="flex-shrink-0 mt-0.5">{r.icon}</span>
              <span className="flex-1 text-app-text text-[13px] leading-snug">{r.text}</span>
              {r.actionLabel && (
                <button
                  onClick={r.onAction}
                  className="flex-shrink-0 text-xs font-semibold text-app-text-strong hover:text-app-text underline decoration-dotted underline-offset-2"
                >
                  {r.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {grouped.length > 0 && (
        <div className="px-4 pb-4 pt-2">
          {grouped.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-app-text-muted mb-1.5 px-1">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border-l-[3px] bg-app-surface-raised/60 ${item.accent}`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[13px] font-medium text-app-text truncate block">
                        {item.title}
                      </span>
                      {item.meta && (
                        <span className="text-[11px] text-app-text-secondary">{item.meta}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-app-text-muted flex-shrink-0">
                      {item.date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
