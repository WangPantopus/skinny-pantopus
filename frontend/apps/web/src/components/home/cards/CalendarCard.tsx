'use client';

import { useState } from 'react';
import { Calendar, ChevronLeft } from 'lucide-react';
import DashboardCard from '../DashboardCard';
import HouseholdCalendar from '../HouseholdCalendar';

type ViewMode = 'agenda' | 'week' | 'month';

// ---- Preview ----

export function CalendarCardPreview({
  events,
  onExpand,
}: {
  events: Record<string, any>[];
  onExpand: () => void;
}) {
  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.start_at) >= now)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 3);

  return (
    <DashboardCard
      title="Calendar"
      icon={<Calendar className="w-5 h-5" />}
      visibility="members"
      count={upcoming.length}
      onClick={onExpand}
    >
      {upcoming.length > 0 ? (
        <div className="space-y-2">
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-sm">
              <span className="text-app-text-muted text-xs flex-shrink-0">
                {new Date(e.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-app-text-strong truncate">{e.title}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="text-xl mb-1"><Calendar className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No upcoming events</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded ----

export default function CalendarCard({
  tasks,
  bills,
  events,
  packages,
  onBack,
}: {
  tasks: Record<string, any>[];
  bills: Record<string, any>[];
  events: Record<string, any>[];
  packages: Record<string, any>[];
  onBack: () => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('agenda');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><Calendar className="w-5 h-5" /> Calendar</h2>
        </div>

        <div className="flex gap-1 bg-app-surface-sunken rounded-lg p-0.5">
          {(['agenda', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition ${
                viewMode === mode ? 'bg-app-surface shadow-sm text-app-text' : 'text-app-text-secondary hover:text-app-text-strong'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Agenda view — reuses HouseholdCalendar */}
      {viewMode === 'agenda' && (
        <HouseholdCalendar tasks={tasks} bills={bills} events={events} packages={packages} />
      )}

      {/* Week view */}
      {viewMode === 'week' && (
        <WeekView events={events} tasks={tasks} bills={bills} />
      )}

      {/* Month view */}
      {viewMode === 'month' && (
        <MonthView events={events} tasks={tasks} bills={bills} />
      )}
    </div>
  );
}

// ---- Week view ----

function WeekView({ events, tasks, bills }: { events: Record<string, any>[]; tasks: Record<string, any>[]; bills: Record<string, any>[] }) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const getEventsForDay = (date: Date): Array<Record<string, any> & { id: string; title: string; _type: 'event' | 'task' | 'bill' }> => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const dayEvents = events.filter((e) => {
      const start = new Date(e.start_at);
      return start >= dayStart && start <= dayEnd;
    });

    const dayTasks = tasks.filter((t) => {
      if (!t.due_at) return false;
      const due = new Date(t.due_at);
      return due >= dayStart && due <= dayEnd;
    });

    const dayBills = bills.filter((b) => {
      if (!b.due_date) return false;
      const due = new Date(b.due_date);
      return due >= dayStart && due <= dayEnd;
    });

    return [
      ...dayEvents.map((e) => ({ ...e, id: String(e.id), title: String(e.title || 'Event'), _type: 'event' as const })),
      ...dayTasks.map((t) => ({ ...t, id: String(t.id), title: String(t.title || 'Task'), _type: 'task' as const })),
      ...dayBills.map((b) => ({ ...b, id: String(b.id), title: String(b.provider_name || b.bill_type || 'Bill'), _type: 'bill' as const })),
    ];
  };

  const isToday = (d: Date) => d.toDateString() === now.toDateString();

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 divide-x divide-app-border-subtle">
        {days.map((day) => (
          <div key={day.toISOString()} className="min-h-[120px]">
            <div className={`text-center py-2 border-b border-app-border-subtle ${isToday(day) ? 'bg-blue-50' : ''}`}>
              <div className="text-[10px] text-app-text-muted uppercase">
                {day.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-sm font-semibold ${isToday(day) ? 'text-blue-600' : 'text-app-text'}`}>
                {day.getDate()}
              </div>
            </div>
            <div className="p-1 space-y-0.5">
              {getEventsForDay(day).slice(0, 4).map((item, i) => (
                <div
                  key={`${item.id}-${i}`}
                  className={`text-[10px] px-1 py-0.5 rounded truncate ${
                    item._type === 'event' ? 'bg-blue-100 text-blue-700' :
                    item._type === 'task' ? 'bg-purple-100 text-purple-700' :
                    'bg-amber-100 text-amber-700'
                  }`}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Month view ----

function MonthView({ events, tasks, bills }: { events: Record<string, any>[]; tasks: Record<string, any>[]; bills: Record<string, any>[] }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let i = 1; i <= totalDays; i++) cells.push(new Date(year, month, i));

  const hasItemsOnDay = (date: Date | null) => {
    if (!date) return false;
    const dayStr = date.toISOString().split('T')[0];
    return (
      events.some((e) => e.start_at?.startsWith(dayStr)) ||
      tasks.some((t) => t.due_at?.startsWith(dayStr)) ||
      bills.some((b) => b.due_date?.startsWith(dayStr))
    );
  };

  const isToday = (d: Date | null) => d?.toDateString() === now.toDateString();

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm p-4">
      <h3 className="text-sm font-semibold text-app-text mb-3">
        {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-[10px] text-app-text-muted font-medium py-1">{d}</div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            className={`relative text-xs py-1.5 rounded-lg ${
              cell ? 'text-app-text-strong' : ''
            } ${isToday(cell) ? 'bg-blue-100 text-blue-700 font-bold' : ''}`}
          >
            {cell?.getDate()}
            {hasItemsOnDay(cell) && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
