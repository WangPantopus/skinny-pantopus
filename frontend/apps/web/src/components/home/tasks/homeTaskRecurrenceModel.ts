import type { HomeTaskSessionScope } from '@pantopus/api';
import { TASK_UUID } from './homeTaskModel';

export type RecurrenceFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type RecurrenceCommand = { action: 'pause'; expected_revision: number } | {
  action: 'start'; expected_revision: number; expected_task_updated_at: string;
  frequency: RecurrenceFrequency; interval: number; timezone: string;
};
export interface RecurrenceConfiguration {
  id: string; revision: number; state: 'active' | 'paused' | 'needs_review'; reason: string | null;
  frequency: RecurrenceFrequency; interval: number; timezone: string; anchor_at: string;
  next_due_at: string | null; last_due_at: string | null; last_task_id: string | null; generated_count: number;
}
export interface RecurrenceState {
  ok: true; home_id: string; task_id: string; can_manage: boolean; task_updated_at: string;
  revision: number; configuration: RecurrenceConfiguration | null; task_session: HomeTaskSessionScope;
}
export interface RecurrenceReceipt {
  request_id: string; actor_id: string; home_id: string; task_id: string; action: 'start' | 'pause';
  revision: number; request_hash: string; created_at: string;
}
export interface RecurrenceResponse extends RecurrenceState { replayed: boolean; receipt: RecurrenceReceipt }
export interface PendingRecurrence {
  version: 1; origin: string; actor_id: string; home_id: string; task_id: string; request_id: string;
  command: RecurrenceCommand; confirmed?: RecurrenceReceipt;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const version = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 999999999999999;
export function validTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 100) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}
export function validRecurrenceCommand(value: unknown): value is RecurrenceCommand {
  if (!object(value) || !version(value.expected_revision)) return false;
  if (value.action === 'pause') return Object.keys(value).every(key => ['action', 'expected_revision'].includes(key));
  return value.action === 'start' && Object.keys(value).every(key => ['action', 'expected_revision', 'expected_task_updated_at', 'frequency', 'interval', 'timezone'].includes(key))
    && date(value.expected_task_updated_at) && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(value.frequency as string)
    && Number.isInteger(value.interval) && (value.interval as number) >= 1 && (value.interval as number) <= 365 && validTimezone(value.timezone);
}
export function validRecurrenceState(value: unknown, homeId: string, taskId: string): value is RecurrenceState {
  if (!object(value) || value.ok !== true || value.home_id !== homeId || value.task_id !== taskId
    || typeof value.can_manage !== 'boolean' || !version(value.revision) || !date(value.task_updated_at)) return false;
  const c = value.configuration;
  if (c === null) return value.revision === 0;
  return object(c) && typeof c.id === 'string' && TASK_UUID.test(c.id) && c.revision === value.revision
    && ['active', 'paused', 'needs_review'].includes(c.state as string)
    && ['DAILY', 'WEEKLY', 'MONTHLY'].includes(c.frequency as string)
    && Number.isInteger(c.interval) && (c.interval as number) >= 1 && (c.interval as number) <= 365
    && validTimezone(c.timezone) && date(c.anchor_at) && version(c.generated_count)
    && (c.last_task_id === null || (typeof c.last_task_id === 'string' && TASK_UUID.test(c.last_task_id)))
    && (c.last_due_at === null || date(c.last_due_at)) && (c.reason === null || typeof c.reason === 'string')
    && (c.state === 'active' ? date(c.next_due_at) : c.next_due_at === null);
}
export function validRecurrenceReceipt(value: unknown, pending: Omit<PendingRecurrence, 'confirmed'>): value is RecurrenceReceipt {
  if (!object(value) || Object.keys(value).some(key => !['request_id', 'actor_id', 'home_id', 'task_id', 'action', 'revision', 'request_hash', 'created_at'].includes(key))) return false;
  const expected = pending.command.expected_revision + (pending.command.action === 'start' || pending.command.expected_revision > 0 ? 1 : 0);
  return value.request_id === pending.request_id && value.actor_id === pending.actor_id && value.home_id === pending.home_id
    && value.task_id === pending.task_id && value.action === pending.command.action && value.revision === expected
    && typeof value.request_hash === 'string' && /^[a-f0-9]{64}$/.test(value.request_hash) && date(value.created_at);
}
export function validPendingRecurrence(value: unknown, origin: string, actorId: string, homeId: string, taskId: string): value is PendingRecurrence {
  if (!object(value) || Object.keys(value).some(key => !['version', 'origin', 'actor_id', 'home_id', 'task_id', 'request_id', 'command', 'confirmed'].includes(key))
    || value.version !== 1 || value.origin !== origin || value.actor_id !== actorId || value.home_id !== homeId || value.task_id !== taskId
    || typeof value.request_id !== 'string' || !TASK_UUID.test(value.request_id) || !validRecurrenceCommand(value.command)) return false;
  return value.confirmed === undefined || validRecurrenceReceipt(value.confirmed, value as unknown as PendingRecurrence);
}
