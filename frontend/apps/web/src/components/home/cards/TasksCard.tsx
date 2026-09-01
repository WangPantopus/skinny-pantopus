'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { ClipboardList, ChevronLeft, Paintbrush, ShoppingCart, Hammer, Bell, Wrench, Pin, PartyPopper, Check } from 'lucide-react';
import DashboardCard from '../DashboardCard';
import VisibilityChip from '../VisibilityChip';

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

type SubTab = 'today' | 'upcoming' | 'recurring' | 'completed';

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority?: string;
  due_at?: string;
  assigned_to?: string;
  recurring?: boolean;
  task_type?: string;
  converted_to_gig_id?: string;
  visibility?: 'public' | 'members' | 'managers' | 'sensitive';
  [key: string]: unknown;
}

interface MemberItem {
  user_id: string;
  display_name?: string;
  username?: string;
  [key: string]: unknown;
}

// ---- Preview (dashboard grid) ----

export function TasksCardPreview({
  tasks,
  members,
  activeTasks,
  onExpand,
}: {
  tasks: TaskItem[];
  members: MemberItem[];
  activeTasks: number;
  onExpand: () => void;
}) {
  const topTasks = tasks
    .filter((t) => t.status === 'open' || t.status === 'in_progress')
    .slice(0, 3);

  const getMemberName = (userId: string) => {
    const m = members.find((m) => m.user_id === userId);
    return m?.display_name || m?.username || null;
  };

  return (
    <DashboardCard
      title="Tasks"
      icon={<ClipboardList className="w-5 h-5" />}
      visibility="members"
      count={activeTasks}
      onClick={onExpand}
    >
      {topTasks.length > 0 ? (
        <div className="space-y-2">
	          {topTasks.map((t) => (
	            <div key={t.id} className="flex items-center gap-2 text-sm">
	              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority || 'low'] || PRIORITY_DOT.low}`} />
              <span className="text-app-text-strong truncate flex-1">{t.title}</span>
              {t.assigned_to && (
                <span className="text-[10px] text-app-text-muted flex-shrink-0">
                  {getMemberName(t.assigned_to)}
                </span>
              )}
              {t.due_at && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-app-surface-sunken text-app-text-secondary flex-shrink-0">
                  {new Date(t.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
          ))}
          {tasks.filter((t) => t.status !== 'done').length > 3 && (
            <p className="text-xs text-app-text-muted">+{tasks.filter((t) => t.status !== 'done').length - 3} more</p>
          )}
        </div>
      ) : (
        <div className="text-center py-2">
          <div className="mb-1"><ClipboardList className="w-5 h-5 mx-auto text-app-text-muted" /></div>
          <p className="text-xs text-app-text-muted">No tasks yet</p>
        </div>
      )}
    </DashboardCard>
  );
}

// ---- Expanded detail view ----

export default function TasksCard({
  tasks,
  members,
  onAddTask,
  onTaskClick,
  onTaskStatusChange,
  onTaskDelete,
  onBack,
}: {
  tasks: TaskItem[];
  members: MemberItem[];
  homeId: string;
  onAddTask: () => void;
  onTaskClick: (task: TaskItem) => void;
  onTaskStatusChange: (taskId: string, newStatus: string) => void;
  onTaskDelete: (taskId: string) => void;
  onBack: () => void;
}) {
	  const [subTab, setSubTab] = useState<SubTab>('today');
	  const now = new Date();

  const todayEnd = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  }, []);

  const filteredTasks = useMemo(() => {
    switch (subTab) {
      case 'today':
        return tasks.filter(
          (t) =>
            (t.status === 'open' || t.status === 'in_progress') &&
            t.due_at &&
            new Date(t.due_at) <= todayEnd
        );
      case 'upcoming':
        return tasks.filter(
          (t) =>
            (t.status === 'open' || t.status === 'in_progress') &&
            (!t.due_at || new Date(t.due_at) > todayEnd)
        );
      case 'recurring':
        return tasks.filter((t) => t.recurring || t.task_type === 'reminder');
      case 'completed':
        return tasks.filter((t) => t.status === 'done');
      default:
        return tasks;
    }
  }, [tasks, subTab, todayEnd]);

  const getMemberName = (userId: string) => {
    const m = members.find((m) => m.user_id === userId);
    return m?.display_name || m?.username || null;
  };

  const SUB_TABS: { key: SubTab; label: string; count: number }[] = [
    { key: 'today', label: 'Today', count: tasks.filter((t) => (t.status === 'open' || t.status === 'in_progress') && t.due_at && new Date(t.due_at) <= todayEnd).length },
    { key: 'upcoming', label: 'Upcoming', count: tasks.filter((t) => (t.status === 'open' || t.status === 'in_progress') && (!t.due_at || new Date(t.due_at) > todayEnd)).length },
    { key: 'recurring', label: 'Recurring', count: tasks.filter((t) => t.recurring || t.task_type === 'reminder').length },
    { key: 'completed', label: 'Completed', count: tasks.filter((t) => t.status === 'done').length },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-sm text-app-text-secondary hover:text-app-text-strong transition flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-lg font-semibold text-app-text flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Tasks</h2>
        </div>
        <button
          onClick={onAddTask}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-800 transition"
        >
          + Add Task
        </button>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
              subTab === t.key ? 'bg-gray-900 text-white' : 'text-app-text-secondary hover:bg-app-hover'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center ${
                subTab === t.key ? 'bg-glass/20 text-white' : 'bg-app-surface-sunken text-app-text-secondary'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="bg-app-surface rounded-xl border border-app-border shadow-sm divide-y divide-app-border-subtle">
        {filteredTasks.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <div className="mb-2">{subTab === 'completed' ? <PartyPopper className="w-8 h-8 mx-auto text-app-text-muted" /> : <ClipboardList className="w-8 h-8 mx-auto text-app-text-muted" />}</div>
            <p className="text-sm text-app-text-secondary">
              {subTab === 'completed' ? 'No completed tasks' : subTab === 'today' ? 'Nothing due today!' : 'No tasks here'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="px-4 py-3 flex items-center gap-3 hover:bg-app-hover/50 transition cursor-pointer group"
              onClick={() => onTaskClick(task)}
            >
              {/* Checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const next = task.status === 'done' ? 'open' : task.status === 'open' ? 'in_progress' : 'done';
                  onTaskStatusChange(task.id, next);
                }}
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                  task.status === 'done'
                    ? 'bg-green-500 border-green-500 text-white'
                    : task.status === 'in_progress'
                    ? 'bg-amber-400 border-amber-400 text-white'
                    : 'border-app-border hover:border-gray-400'
                }`}
              >
                {task.status === 'done' && <Check className="w-3 h-3" />}
                {task.status === 'in_progress' && <span className="text-[8px]">●</span>}
              </button>

              {/* Type icon */}
	              <span className="text-sm flex-shrink-0">{TYPE_ICON[task.task_type || ''] || <Pin className="w-4 h-4" />}</span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium ${task.status === 'done' ? 'text-app-text-muted line-through' : 'text-app-text'}`}>
                  {task.title}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {task.assigned_to && (
                    <span className="text-[10px] text-app-text-muted">{getMemberName(task.assigned_to) || 'Assigned'}</span>
                  )}
                  {task.converted_to_gig_id && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Linked to Task
                    </span>
                  )}
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {task.visibility && <VisibilityChip visibility={task.visibility} />}
                {task.due_at && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    new Date(task.due_at) < now && task.status !== 'done'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-app-surface-sunken text-app-text-secondary'
                  }`}>
                    {new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
	                <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority || 'low'] || PRIORITY_DOT.low}`} />
              </div>

              {/* Delete on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskDelete(task.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-app-text-muted hover:text-red-500 p-1 transition flex-shrink-0"
                title="Delete"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Request outside help hint */}
      {tasks.filter((t) => t.status === 'open' && !t.assigned_to && !t.converted_to_gig_id).length > 0 && (
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 flex items-center gap-3">
          <Hammer className="w-5 h-5 text-emerald-700" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-emerald-800">Need outside help?</p>
            <p className="text-xs text-emerald-600">Unassigned tasks can be posted to find local help.</p>
          </div>
	          <button
	            onClick={() => {
	              const firstOpenTask = tasks.find((t) => t.status === 'open' && !t.assigned_to);
	              if (firstOpenTask) onTaskClick(firstOpenTask);
	            }}
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition flex-shrink-0"
          >
            View Task
          </button>
        </div>
      )}
    </div>
  );
}
