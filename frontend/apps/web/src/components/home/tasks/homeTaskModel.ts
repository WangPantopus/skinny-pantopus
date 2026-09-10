import type { HomeTaskSessionScope } from '@pantopus/api';

export const TASK_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TASK_TYPES = ['chore', 'shopping', 'repair', 'project', 'reminder'] as const;
export const TASK_STATUSES = ['open', 'in_progress', 'done', 'canceled'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export interface HomeTask {
  id: string; home_id: string; created_by?: string;
  task_type: typeof TASK_TYPES[number]; title: string;
  description?: string | null; assigned_to?: string | null; due_at?: string | null;
  recurrence_rule?: string | null; budget?: number | null;
  status: typeof TASK_STATUSES[number]; priority: typeof TASK_PRIORITIES[number];
  capabilities?: { can_edit: boolean; can_complete: boolean; can_delete: boolean };
}
export type HomeTaskFields = Pick<HomeTask, 'task_type' | 'title' | 'description' | 'assigned_to'
  | 'due_at' | 'recurrence_rule' | 'budget' | 'priority'>;
export type HomeTaskPatch = Partial<HomeTaskFields & Pick<HomeTask, 'status'>>;
export interface TaskCollection {
  tasks: HomeTask[]; task_session: HomeTaskSessionScope;
  collection_capabilities: { can_create: boolean };
}
export interface TaskResponse { task: HomeTask; task_session: HomeTaskSessionScope }
export interface TaskCreationReceipt {
  home_id: string; actor_id: string; request_id: string; task_id: string;
  payload_hash: string; created_at: string;
}
export interface TaskCreationResponse extends TaskResponse {
  creation_receipt: TaskCreationReceipt; replayed: boolean;
}
export interface RetainedTaskCreate {
  version: 1; origin: string; actor_id: string; home_id: string; request_id: string;
  payload: HomeTaskFields;
  confirmed?: { task_id: string; payload_hash: string };
}

export function validTask(task: HomeTask, homeId: string, taskId?: string): boolean {
  return !!task && typeof task.id === 'string' && TASK_UUID.test(task.id)
    && task.home_id === homeId && (!taskId || task.id === taskId)
    && typeof task.title === 'string' && !!task.title.trim()
    && TASK_TYPES.includes(task.task_type) && TASK_STATUSES.includes(task.status)
    && TASK_PRIORITIES.includes(task.priority)
    && ['description', 'assigned_to', 'due_at', 'recurrence_rule'].every(key => {
      const value = task[key as keyof HomeTask];
      return value == null || typeof value === 'string';
    }) && (task.budget == null || (typeof task.budget === 'number' && Number.isFinite(task.budget)));
}

export function validTaskFields(fields: HomeTaskPatch, creating: boolean): boolean {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false;
  const allowed = ['task_type', 'title', 'description', 'assigned_to', 'due_at', 'recurrence_rule', 'budget', 'priority', 'status'];
  if (Object.keys(fields).some(key => !allowed.includes(key))) return false;
  if (creating && (!fields.title || !fields.task_type || Object.hasOwn(fields, 'status'))) return false;
  return Object.entries(fields).every(([key, value]) => {
    if (key === 'title') return typeof value === 'string' && value.trim().length > 0 && value.length <= 255;
    if (key === 'task_type') return TASK_TYPES.includes(value as HomeTask['task_type']);
    if (key === 'priority') return TASK_PRIORITIES.includes(value as HomeTask['priority']);
    if (key === 'status') return TASK_STATUSES.includes(value as HomeTask['status']);
    if (value === null) return true;
    if (key === 'budget') return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 9999999999.99;
    if (typeof value !== 'string') return false;
    if (key === 'description') return value.length <= 10000;
    if (key === 'recurrence_rule') return value.length <= 1000;
    if (key === 'assigned_to') return TASK_UUID.test(value);
    return Number.isFinite(Date.parse(value));
  });
}

export function taskPatchMatches(task: HomeTask, patch: HomeTaskPatch): boolean {
  return Object.entries(patch).every(([key, expected]) => {
    const actual = task[key as keyof HomeTask];
    if (expected === null) return actual == null;
    if (key === 'due_at') return typeof expected === 'string' && typeof actual === 'string'
      && Number.isFinite(Date.parse(expected)) && Date.parse(expected) === Date.parse(actual);
    return actual === expected;
  });
}

export function validRetainedTaskCreate(value: RetainedTaskCreate, origin: string, actorId: string, homeId: string): boolean {
  return !!value && value.version === 1 && value.origin === origin && value.actor_id === actorId
    && TASK_UUID.test(actorId) && TASK_UUID.test(homeId) && value.home_id === homeId
    && typeof value.request_id === 'string' && TASK_UUID.test(value.request_id)
    && value.request_id === value.request_id.toLowerCase() && validTaskFields(value.payload, true)
    && Object.keys(value).every(key => ['version', 'origin', 'actor_id', 'home_id', 'request_id', 'payload', 'confirmed'].includes(key))
    && (!value.confirmed || (TASK_UUID.test(value.confirmed.task_id) && /^[a-f0-9]{64}$/.test(value.confirmed.payload_hash)
      && Object.keys(value.confirmed).every(key => ['task_id', 'payload_hash'].includes(key))));
}
