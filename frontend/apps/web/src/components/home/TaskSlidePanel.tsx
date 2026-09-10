'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import * as api from '@pantopus/api';
import TaskAttachmentList from './TaskAttachmentList';
import { Paintbrush, ShoppingCart, Wrench, Hammer, Bell } from 'lucide-react';
import SlidePanel from './SlidePanel';
import { useHomeTaskForm } from './tasks/useHomeTaskForm';
import type { HomeTask } from './tasks/homeTaskModel';
import type { HomeTaskClient } from './tasks/HomeTaskClient';
import { PendingHomeTaskUploadStore, type TaskUploadSnapshot } from './tasks/PendingHomeTaskUploadStore';

function uploadStore(client: HomeTaskClient, taskId: string) {
  client.requireCurrent();
  if (!client.actorId) throw api.taskSessionChanged();
  return new PendingHomeTaskUploadStore(client.origin, client.actorId, client.homeId, taskId);
}

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

export default function TaskSlidePanel({ open, onClose, onSaved, task, members, homeId, openingScope }: {
  open: boolean;
  onClose: () => void;
  onSaved: (task: HomeTask) => void;
  task?: { id: string } | null;
  members: { id?: string; user_id?: string; name?: string; username?: string; user?: { name?: string; username?: string } }[];
  homeId?: string;
  openingScope: api.HomeTaskSessionScope | null;
}) {
  const form = useHomeTaskForm(open, homeId, task?.id, openingScope);
  const { taskType, title, description, assignedTo, priority, status, dueAt, budget } = form.fields;
  const savedTaskId = form.task?.id;
  const isEdit = !!savedTaskId;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [canUpload, setCanUpload] = useState(false);
  const [attachmentRevision, setAttachmentRevision] = useState(0);
  const [retiredUpload, setRetiredUpload] = useState<TaskUploadSnapshot | null>(null);
  const uploadRequests = useRef(new Map<File, TaskUploadSnapshot>());
  const [pendingUpload, setPendingUpload] = useState<TaskUploadSnapshot | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const currentForm = form.current;
  const activeSave = useRef(false);
  const completed = useRef(false);
  const generation = useRef(0);
  const picker = useRef<{ client: HomeTaskClient; revision: number; taskId?: string } | null>(null);

  useEffect(() => {
    const invalidate = () => { generation.current++; picker.current = null; };
    invalidate(); activeSave.current = false; completed.current = false;
    uploadRequests.current.clear(); setPendingUpload(null); setRecoveryError(''); picker.current = null;
    setSaving(false); setMediaFiles([]); setError(''); setUploadProgress(''); setRetiredUpload(null); setCanUpload(false);
    return invalidate;
  }, [open, homeId, task?.id]);
  useEffect(() => {
    if (form.retired) {
      generation.current++; picker.current = null; uploadRequests.current.clear(); setPendingUpload(null); setRecoveryError('');
      setMediaFiles([]); setSaving(false); setError(''); setUploadProgress(''); setRetiredUpload(null);
    }
  }, [form.retired]);

  useEffect(() => {
    if (!open || !savedTaskId || !form.ready) return;
    let active = true;
    const request = generation.current;
    void (async () => {
      try {
        const { client } = currentForm(); const revision = client.revision;
        const saved = await uploadStore(client, savedTaskId).load();
        client.requireCurrent(revision);
        if (active && request === generation.current) { setPendingUpload(saved); setRecoveryError(''); }
      } catch (failure) {
        if (active && request === generation.current) setRecoveryError(failure instanceof Error ? failure.message : 'Attachment recovery is unavailable. Reopen this task.');
      }
    })();
    return () => { active = false; };
  }, [open, savedTaskId, form.ready, currentForm]);

  const close = () => { generation.current++; completed.current = true; picker.current = null; form.close(); onClose(); };
  const requireAction = (client: HomeTaskClient, revision: number, request: number) => {
    if (request !== generation.current || completed.current || form.current().client !== client) throw new Error('Reopen this task before continuing.');
    client.requireCurrent(revision);
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (activeSave.current || completed.current) return;
    const request = generation.current;
    activeSave.current = true; setSaving(true); setError('');
    try {
      const { client } = form.current(); const revision = client.revision;
      const saved = await form.save();
      requireAction(client, revision, request);
      onSaved(saved);
      const scope = client.currentScope;
      if (!scope) throw api.taskSessionChanged();
      for (const file of mediaFiles) {
        requireAction(client, revision, request);
        await api.assertHomeTaskSession(scope, saved.id);
        requireAction(client, revision, request);
        const store = uploadStore(client, saved.id);
        const current = () => { try { requireAction(client, revision, request); return true; } catch { return false; } };
        const original = await store.prepare(file, uploadRequests.current.get(file), current);
        requireAction(client, revision, request);
        uploadRequests.current.set(file, original); setPendingUpload(original); setRecoveryError('');
        const uploadId = original.draft.upload_id;
        const selected = new File([file], original.draft.filename, { type: original.draft.mime_type });
        setUploadProgress(`Uploading ${file.name}…`);
        try {
          await api.upload.uploadHomeTaskMedia(client.homeId, saved.id, [selected], [uploadId], scope,
            () => requireAction(client, revision, request));
        } catch (failure) {
          requireAction(client, revision, request);
          const response = failure as { statusCode?: number; code?: string; data?: { code?: string } };
          if (response?.code === 'SESSION_SCOPE_CHANGED') throw failure;
          if (response?.statusCode === 409 && (response.code || response.data?.code) === 'HOME_TASK_UPLOAD_RETIRED') {
            setRetiredUpload(original);
            throw new Error('This upload was removed. Acknowledge it before selecting another file.');
          }
          throw new Error('The task is saved. Some attachments were not confirmed; retry the same remaining files.');
        }
        await api.assertHomeTaskSession(scope, saved.id);
        requireAction(client, revision, request);
        const confirmed = await store.confirm(original, current);
        requireAction(client, revision, request);
        setPendingUpload(confirmed); uploadRequests.current.delete(file);
        setMediaFiles(previous => previous.filter(candidate => candidate !== file));
        setAttachmentRevision(value => value + 1);
      }
      requireAction(client, revision, request);
      close();
    } catch (failure) {
      if (request === generation.current && !completed.current) setError(failure instanceof Error ? failure.message : 'The task was not confirmed. Retry.');
    } finally {
      if (request === generation.current) { activeSave.current = false; setSaving(false); setUploadProgress(''); }
    }
  };
  const acknowledge = async (upload: TaskUploadSnapshot | null) => {
    if (activeSave.current || completed.current) return;
    const request = generation.current;
    activeSave.current = true; setSaving(true); setError('');
    try {
      const { client } = form.current(); const revision = client.revision;
      if (upload) {
        if (upload !== retiredUpload || !savedTaskId) throw new Error('Reload the original upload before continuing.');
        await client.detail(savedTaskId, revision);
        requireAction(client, revision, request);
        await uploadStore(client, savedTaskId).clear(upload, () => {
          try { requireAction(client, revision, request); return true; } catch { return false; }
        });
        requireAction(client, revision, request);
        const removed = new Set([...uploadRequests.current.entries()].filter(([, value]) => value.draft.upload_id === upload.draft.upload_id).map(([file]) => file));
        for (const file of removed) uploadRequests.current.delete(file);
        setMediaFiles(previous => previous.filter(file => !removed.has(file)));
        setRetiredUpload(null); setPendingUpload(null);
        setAttachmentRevision(value => value + 1);
      } else {
        await form.acknowledge(); requireAction(client, revision, request); close();
      }
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : 'The original request could not be cleared.');
    } finally {
      if (request === generation.current) { activeSave.current = false; setSaving(false); }
    }
  };
  const checkPreviousUpload = async () => {
    if (activeSave.current || completed.current || !savedTaskId) return;
    const request = generation.current; activeSave.current = true; setSaving(true); setError('');
    try {
      const { client } = currentForm(); const revision = client.revision;
      await client.detail(savedTaskId, revision); requireAction(client, revision, request);
      const store = uploadStore(client, savedTaskId); const original = await store.load();
      requireAction(client, revision, request);
      const scope = client.currentScope;
      if (!scope || !original || original.revision !== pendingUpload?.revision) throw new Error('Attachment recovery changed. Reopen this task.');
      const result = await api.upload.getHomeTaskMedia(client.homeId, savedTaskId, scope);
      requireAction(client, revision, request);
      const row = result.media.find(item => item.id === original.draft.upload_id);
      const ext = original.draft.filename.match(/\.([a-zA-Z0-9]{1,5})$/)?.[1]?.toLowerCase() || 'bin';
      if (!row || row.uploaded_by !== client.actorId || row.file_name !== `task-attachment-${original.draft.upload_id}.${ext}`
        || row.file_size !== original.draft.size || row.mime_type !== original.draft.mime_type) {
        throw new Error('The original upload is still unconfirmed. Reselect the same file to retry it.');
      }
      if (row.state === 'retired' && !row.available) { setRetiredUpload(original); return; }
      if (row.state !== 'ready' || !row.available) throw new Error('The original upload is incomplete. Reselect the same file, or remove its reservation below.');
      const confirmed = await store.confirm(original, () => {
        try { requireAction(client, revision, request); return true; } catch { return false; }
      });
      requireAction(client, revision, request); setPendingUpload(confirmed); setRecoveryError('');
      const recovered = new Set([...uploadRequests.current.entries()].filter(([, value]) => value.draft.upload_id === original.draft.upload_id).map(([file]) => file));
      setMediaFiles(previous => previous.filter(file => !recovered.has(file)));
      for (const file of recovered) uploadRequests.current.delete(file); setAttachmentRevision(value => value + 1);
    } catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : 'The attachment is still unconfirmed.');
    } finally { if (request === generation.current) { activeSave.current = false; setSaving(false); } }
  };
  const startAnother = async () => {
    if (activeSave.current || completed.current) return;
    const request = generation.current;
    activeSave.current = true; setSaving(true); setError('');
    try { await form.startAnother(); }
    catch (failure) {
      if (request === generation.current) setError(failure instanceof Error ? failure.message : 'The saved task request changed. Reopen the form.');
    } finally {
      if (request === generation.current) { activeSave.current = false; setSaving(false); }
    }
  };
  const canChangeFields = form.canEdit && !form.pending && !saving;
  const scope = form.ready ? form.scope : null;
  if (form.retired) return <SlidePanel open={open} onClose={close} title="Reopen this task"><p role="alert">Your signed-in session changed or could not be verified. Close this panel and refresh the Home before continuing.</p></SlidePanel>;
  if (!form.ready) return <SlidePanel open={open} onClose={close} title="Tasks">
    <p role="status">{form.loading ? 'Checking current task access…' : 'Task access could not be confirmed.'}</p>
    {form.error && <p role="alert">{form.error}</p>}
    {!form.loading && <button type="button" onClick={form.reload}>Reload task</button>}
  </SlidePanel>;

  return (
    <SlidePanel
      open={open}
      onClose={close}
      title={isEdit ? 'Edit Task' : 'New Task'}
      subtitle={isEdit ? form.task?.title : 'Add a task to your home'}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {form.pending?.confirmed && <div className="space-y-2 text-sm">
          <p>Your previous task was saved. Open that exact task, or explicitly start another task.</p>
          <button type="button" disabled={saving || !form.canEdit} onClick={() => void startAnother()} className="underline">Start another task</button>
        </div>}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {form.pending && !form.pending.confirmed && <p role="status" className="text-sm">A previous create request is unconfirmed. Retry that original request to recover the exact task.</p>}
        {form.canAcknowledge && <button type="button" disabled={saving} onClick={() => void acknowledge(null)}>Acknowledge unavailable request</button>}
        {retiredUpload && <button type="button" disabled={saving} onClick={() => void acknowledge(retiredUpload)}>Acknowledge removed upload</button>}
        {/* Task Type */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-2">Type</label>
          <div className="flex flex-wrap gap-2">
            {TASK_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={!canChangeFields} onClick={() => form.change('taskType', t.value)}
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
            disabled={!canChangeFields} value={title}
            onChange={(e) => form.change('title', e.target.value)}
            placeholder="e.g., Fix leaky faucet"
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            maxLength={255}
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1">Description</label>
          <textarea
            disabled={!canChangeFields} value={description}
            onChange={(e) => form.change('description', e.target.value)}
            placeholder="Add details, notes, or instructions..."
            maxLength={10000} rows={3}
            className="w-full px-3 py-2 border border-app-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
          />
        </div>

        {/* Assign + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Assign to</label>
            <select
              disabled={!canChangeFields} value={assignedTo}
              onChange={(e) => form.change('assignedTo', e.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {assignedTo && !members.some(member => (member.user_id || member.id) === assignedTo) && <option value={assignedTo}>Current assignee</option>}
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
                  disabled={!canChangeFields} onClick={() => form.change('priority', p.value)}
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
              disabled={!canChangeFields} value={dueAt}
              onChange={(e) => form.change('dueAt', e.target.value)}
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Budget ($)</label>
            <input
              type="number"
              disabled={!canChangeFields} value={budget}
              onChange={(e) => form.change('budget', e.target.value)}
              placeholder="0"
              min="0" max="9999999999.99"
              step="0.01"
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {open && homeId && savedTaskId && scope && <TaskAttachmentList key={`${homeId}:${savedTaskId}`} homeId={homeId} taskId={savedTaskId} revision={attachmentRevision} onAccess={setCanUpload} openingScope={scope} />}
        {recoveryError && <p role="alert">{recoveryError}</p>}
        {pendingUpload && !pendingUpload.draft.confirmed && <div className="space-y-2 text-sm">
          <p>An attachment is unconfirmed: {pendingUpload.draft.filename}. Reselect that same file to retry the original upload. File bytes are not saved for automatic replay.</p>
          <button type="button" disabled={saving} onClick={() => void checkPreviousUpload()} className="underline">Check previous attachment</button>
        </div>}
        {(savedTaskId ? canUpload : form.canEdit) && <div>
          <label className="block text-sm font-medium text-app-text-strong mb-1" htmlFor="task-private-attachments">Attachments (optional)</label>
          <input id="task-private-attachments" type="file" multiple disabled={saving || !!retiredUpload || !!form.pending || !!recoveryError}
            onClick={() => {
              try { const { client } = form.current(); picker.current = { client, revision: client.revision, taskId: savedTaskId }; }
              catch { picker.current = null; }
            }}
            accept="application/pdf,text/plain,image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={event => {
              const captured = picker.current; picker.current = null;
              try {
                if (!captured || captured.client !== form.current().client || captured.taskId !== savedTaskId) throw new Error('Reopen the picker after checking task access.');
                captured.client.requireCurrent(captured.revision);
              } catch { event.target.value = ''; return; }
              const picked = Array.from(event.target.files || []);
              if (picked.some(file => file.size === 0 || file.size > 25 * 1024 * 1024) || mediaFiles.length + picked.length > 10) {
                setError('Choose up to ten nonempty attachments, each 25 MB or less.'); return;
              }
              setMediaFiles(previous => [...previous, ...picked]); event.target.value = '';
            }} />
          <p className="text-xs text-app-text-secondary mt-1">PDF, text, JPEG, PNG, WebP or HEIC. Attachments follow this task’s access.</p>
          {mediaFiles.map((file, index) => <p key={`${file.name}-${index}`} className="text-sm mt-1">{file.name} <button type="button" disabled={saving || uploadRequests.current.has(file)} onClick={() => setMediaFiles(previous => previous.filter((_, i) => i !== index))} className="underline">Remove selected file</button></p>)}
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
                  disabled={!form.canComplete || saving} onClick={() => form.change('status', s.value)}
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
            onClick={close}
            disabled={saving}
            className="flex-1 px-4 py-2.5 border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !!retiredUpload || !title.trim() || (!form.pending && !form.canEdit && !form.canComplete && !mediaFiles.length)}
            className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : form.pending?.confirmed ? 'Open saved task' : form.pending ? 'Retry original request' : isEdit ? 'Save Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </SlidePanel>
  );
}
