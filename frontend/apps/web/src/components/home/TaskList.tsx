'use client';

import { useState, type ReactNode } from 'react';
import { Paintbrush, ShoppingCart, Hammer, Bell, Wrench, ClipboardList, Sparkles, Play, Check } from 'lucide-react';
import { TASK_STATUS, statusClasses, statusLabel } from '@/components/statusColors';

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-300',
};

const TYPE_ICON: Record<string, ReactNode> = {
  chore: <Paintbrush className="w-4 h-4" />,
  shopping: <ShoppingCart className="w-4 h-4" />,
  project: <Hammer className="w-4 h-4" />,
  reminder: <Bell className="w-4 h-4" />,
  repair: <Wrench className="w-4 h-4" />,
};

export default function TaskList({
  tasks,
  members,
  onAdd,
  onStatusChange,
  onTaskClick,
}: {
  tasks: Record<string, any>[];
  members: Record<string, any>[];
  onAdd?: () => void;
  onStatusChange?: (taskId: string, newStatus: string) => void;
  onTaskClick?: (task: Record<string, any>) => void;
  onDelete?: (taskId: string) => void | Promise<void>;
  embedded?: boolean;
}) {
  const [filter, setFilter] = useState<string>('all');

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const memberName = (uid: string) => {
    const m = members.find((mb: Record<string, any>) => mb.user_id === uid || mb.id === uid);
    return m?.user?.name || m?.user?.username || m?.name || m?.username || 'Unassigned';
  };

  return (
    <div className="bg-app-surface rounded-xl border border-app-border shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-app-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-app-text">Tasks</h3>
          <p className="text-xs text-app-text-secondary mt-0.5">
            {tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filters */}
          <div className="flex bg-app-surface-sunken rounded-lg p-0.5 text-xs">
            {['all', 'open', 'in_progress', 'done'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-md capitalize transition ${
                  filter === f ? 'bg-app-surface text-app-text shadow-sm font-medium' : 'text-app-text-secondary hover:text-app-text'
                }`}
              >
                {f === 'in_progress' ? 'Active' : f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
          {onAdd && (
            <button
              onClick={onAdd}
              className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
            >
              + Add
            </button>
          )}
        </div>
      </div>

      {/* Task rows */}
      {filtered.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <div className="mb-2"><Sparkles className="w-8 h-8 mx-auto text-app-text-muted" /></div>
          <p className="text-sm text-app-text-secondary">No tasks here. All clear!</p>
        </div>
      ) : (
        <div className="divide-y divide-app-border-subtle">
          {filtered.map((task) => (
            <div
              key={task.id}
              className={`px-5 py-3.5 flex items-center gap-3 hover:bg-app-hover/50 transition group ${
                onTaskClick ? 'cursor-pointer' : ''
              }`}
              onClick={() => onTaskClick?.(task)}
            >
              {/* Priority dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium
                }`}
              />

              {/* Type icon */}
              <span className="flex-shrink-0">
                {TYPE_ICON[task.task_type] || <ClipboardList className="w-4 h-4" />}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-medium ${
                      task.status === 'done' ? 'line-through text-app-text-muted' : 'text-app-text'
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.assigned_to && (
                    <span className="text-xs text-app-text-secondary">
                      → {memberName(task.assigned_to)}
                    </span>
                  )}
                  {task.due_at && (
                    <span className="text-xs text-app-text-muted">
                      Due {new Date(task.due_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Status chip */}
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${
                  statusClasses(TASK_STATUS, task.status)
                }`}
              >
                {statusLabel(TASK_STATUS, task.status)}
              </span>

              {/* Quick status toggle */}
              {onStatusChange && task.status !== 'done' && task.status !== 'canceled' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStatusChange(
                      task.id,
                      task.status === 'open' ? 'in_progress' : 'done'
                    );
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-app-text-secondary hover:text-green-600 transition flex-shrink-0"
                  title={task.status === 'open' ? 'Start' : 'Complete'}
                >
                  {task.status === 'open' ? <Play className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
