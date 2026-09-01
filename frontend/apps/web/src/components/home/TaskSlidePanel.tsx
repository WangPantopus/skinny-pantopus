'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Paintbrush, ShoppingCart, Wrench, Hammer, Bell } from 'lucide-react';
import SlidePanel from './SlidePanel';
import FileUpload from '@/components/FileUpload';

const TASK_TYPES: { value: string; label: string; icon: ReactNode }[] = [
  { value: 'chore', label: 'Chore', icon: <Paintbrush className="w-4 h-4" /> },
  { value: 'shopping', label: 'Shopping', icon: <ShoppingCart className="w-4 h-4" /> },
  { value: 'repair', label: 'Repair', icon: <Wrench className="w-4 h-4" /> },
  { value: 'project', label: 'Project', icon: <Hammer className="w-4 h-4" /> },
  { value: 'reminder', label: 'Reminder', icon: <Bell className="w-4 h-4" /> },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', dot: 'bg-gray-300' },
  { value: 'medium', label: 'Medium', dot: 'bg-blue-400' },
  { value: 'high', label: 'High', dot: 'bg-orange-400' },
  { value: 'urgent', label: 'Urgent', dot: 'bg-red-500' },
];

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'canceled', label: 'Canceled' },
];

export default function TaskSlidePanel({
  open,
  onClose,
  onSave,
  task,
  members,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  task?: Record<string, any> | null; // null = create, object = edit
  members: Record<string, any>[];
  homeId?: string;
}) {
  const isEdit = !!task;

  const [taskType, setTaskType] = useState('chore');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('open');
  const [dueAt, setDueAt] = useState('');
  const [budget, setBudget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (task) {
      setTaskType(task.task_type || 'chore');
      setTitle(task.title || '');
      setDescription(task.description || '');
      setAssignedTo(task.assigned_to || '');
      setPriority(task.priority || 'medium');
      setStatus(task.status || 'open');
      setDueAt(task.due_at ? task.due_at.split('T')[0] : '');
      setBudget(task.budget ? String(task.budget) : '');
      setMediaFiles([]);
    } else {
      // Reset for create
      setTaskType('chore');
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setPriority('medium');
      setStatus('open');
      setDueAt('');
      setBudget('');
      setMediaFiles([]);
    }
    setError('');
    setUploadProgress('');
  }, [task, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: Record<string, any> = {
        task_type: taskType,
        title: title.trim(),
        description: description.trim() || undefined,
        assigned_to: assignedTo || undefined,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        budget: budget ? parseFloat(budget) : undefined,
        _mediaFiles: mediaFiles.length > 0 ? mediaFiles : undefined,
      };
      if (isEdit) {
        payload.status = status;
      }
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  return (
    <SlidePanel
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Task' : 'New Task'}
      subtitle={isEdit ? task?.title : 'Add a task to your home'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Task Type */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {TASK_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTaskType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  taskType === t.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-app-surface text-app-text-strong border-app-border hover:border-app-border'
                }`}
              >
                <span className="flex items-center gap-1">{t.icon} {t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Fix leaky faucet"
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            maxLength={200}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details, notes, or instructions..."
            rows={3}
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
          />
        </div>

        {/* Assign + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Assign to</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id || m.id} value={m.user_id || m.id}>
                  {m.user?.name || m.user?.username || m.name || m.username || 'Member'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Priority</label>
            <div className="flex gap-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition ${
                    priority === p.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.dot} ${priority === p.value ? 'opacity-80' : ''}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Due date + Budget row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Due date</label>
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Budget ($)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Media (optional) */}
        <FileUpload
          label="Attachments (optional)"
          accept={['image', 'video', 'document']}
          maxFiles={10}
          maxSize={100 * 1024 * 1024}
          files={mediaFiles}
          onFilesSelected={setMediaFiles}
          helperText="Upload photos, videos, or documents related to this task."
          compact
        />

        {/* Upload progress */}
        {uploadProgress && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            {uploadProgress}
          </div>
        )}

        {/* Status (edit only) */}
        {isEdit && (
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Status</label>
            <div className="flex gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                    status === s.value
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-app-surface text-app-text-secondary border-app-border hover:border-app-border'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-3 border-t border-app-border-subtle">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}
