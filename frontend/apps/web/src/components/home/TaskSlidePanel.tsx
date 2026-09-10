'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import * as api from '@pantopus/api';
import TaskAttachmentList from './TaskAttachmentList';
import { Paintbrush, ShoppingCart, Wrench, Hammer, Bell } from 'lucide-react';
import SlidePanel from './SlidePanel';

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
  homeId,
  openingScope,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<Record<string, any>>;
  task?: Record<string, any> | null; // null = create, object = edit
  members: Record<string, any>[];
  homeId?: string;
  openingScope: api.HomeTaskSessionScope | null;
}) {
  const [savedTaskId, setSavedTaskId] = useState<string | null>(task?.id || null);
  const isEdit = !!savedTaskId;

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
  const [canUpload, setCanUpload] = useState(!task);
  const [attachmentRevision, setAttachmentRevision] = useState(0);
  const uploadIds = useRef(new Map<File, string>());
  const generation = useRef(0);
  const activeSave = useRef(false);
  const scope = useRef<api.HomeTaskSessionScope | null>(null);
  const [sessionChanged, setSessionChanged] = useState(!openingScope || openingScope.home_id !== homeId);

  // Populate form when editing
  useEffect(() => {
    generation.current++;
    activeSave.current = false;
    scope.current = openingScope && openingScope.home_id === homeId ? { ...openingScope } : null;
    setSessionChanged(!scope.current);
    setSavedTaskId(task?.id || null);
    setCanUpload(!task);
    uploadIds.current.clear();
    setSaving(false);
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
    return () => { generation.current++; };
  // A refreshed object for the same task must not discard a failed upload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, open, homeId]);

  useEffect(() => {
    if (open && scope.current && (openingScope?.session_scope !== scope.current.session_scope || openingScope?.actor_id !== scope.current.actor_id)) {
      generation.current++; setSessionChanged(true); setSaving(false);
    }
  }, [openingScope?.session_scope, openingScope?.actor_id, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeSave.current || sessionChanged || !scope.current) return;
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const request = generation.current;
    const requestScope = scope.current;
    activeSave.current = true;
    setSaving(true);
    setError('');
    try {
      await api.assertHomeTaskSession(requestScope, savedTaskId);
      if (request !== generation.current) return;
      const payload: Record<string, any> = {
        task_type: taskType,
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: assignedTo || null,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        budget: budget ? parseFloat(budget) : undefined,
        _savedTaskId: savedTaskId || undefined,
        _sessionScope: requestScope,
      };
      if (isEdit) {
        payload.status = status;
      }
      const saved = await onSave(payload);
      await api.assertHomeTaskSession(requestScope, saved?.id || null);
      if (request !== generation.current) return;
      if (!saved?.id || (savedTaskId && saved.id !== savedTaskId) || (homeId && saved.home_id !== homeId)) throw new Error('Task save was not confirmed. Refresh before retrying.');
      // Commit the saved identity before any attachment request can fail.
      setSavedTaskId(saved.id);
      for (const file of mediaFiles) {
        if (request !== generation.current) return;
        if (!homeId) throw new Error('The task is saved. Reopen it to upload attachments.');
        let uploadId = uploadIds.current.get(file);
        if (!uploadId) { uploadId = crypto.randomUUID(); uploadIds.current.set(file, uploadId); }
        setUploadProgress(`Uploading ${file.name}…`);
        try { await api.upload.uploadHomeTaskMedia(homeId, saved.id, [file], [uploadId], requestScope); }
        catch (error) {
          if ((error as { code?: string })?.code === 'SESSION_SCOPE_CHANGED') throw error;
          throw new Error('The task is saved. Some attachments were not confirmed; retry to upload the remaining files.');
        }
        await api.assertHomeTaskSession(requestScope, saved.id);
        if (request !== generation.current) return;
        setMediaFiles(previous => previous.filter(candidate => candidate !== file));
        setAttachmentRevision(value => value + 1);
      }
      if (request === generation.current) onClose();
    } catch (err: unknown) {
      if (request === generation.current) {
        if ((err as { code?: string })?.code === 'SESSION_SCOPE_CHANGED') setSessionChanged(true);
        setError(err instanceof Error ? err.message : 'Failed to save task');
      }
    } finally {
      if (request === generation.current) { activeSave.current = false; setSaving(false); setUploadProgress(''); }
    }
  };

  if (sessionChanged) return <SlidePanel open={open} onClose={onClose} title="Reopen this task"><p role="alert">Your signed-in session changed or could not be verified. Close this panel and refresh the Home before continuing.</p></SlidePanel>;

  return (
    <SlidePanel
      open={open}
      onClose={() => { if (!saving) onClose(); }}
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

        {open && homeId && savedTaskId && <TaskAttachmentList key={`${homeId}:${savedTaskId}`} homeId={homeId} taskId={savedTaskId} revision={attachmentRevision} onAccess={setCanUpload} openingScope={scope.current!} />}
        {canUpload && <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1" htmlFor="task-private-attachments">Attachments (optional)</label>
          <input id="task-private-attachments" type="file" multiple disabled={saving}
            accept="application/pdf,text/plain,image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={event => {
              const picked = Array.from(event.target.files || []);
              if (picked.some(file => file.size === 0 || file.size > 25 * 1024 * 1024) || mediaFiles.length + picked.length > 10) {
                setError('Choose up to ten nonempty attachments, each 25 MB or less.'); return;
              }
              setMediaFiles(previous => [...previous, ...picked]); event.target.value = '';
            }} />
          <p className="text-xs text-app-text-secondary mt-1">PDF, text, JPEG, PNG, WebP or HEIC. Attachments follow this task’s access.</p>
          {mediaFiles.map((file, index) => <p key={`${file.name}-${index}`} className="text-sm mt-1">{file.name} <button type="button" disabled={saving} onClick={() => setMediaFiles(previous => previous.filter((_, i) => i !== index))} className="underline">Remove selected file</button></p>)}
        </div>}

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
            disabled={saving}
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
