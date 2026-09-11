import type { HomeTaskSessionScope } from '@pantopus/api';
import { TASK_UUID } from './homeTaskModel';

export interface TaskGigState {
  ok: true; home_id: string; task_id: string; task_updated_at: string;
  can_publish: boolean; gig_id: string | null; task_session: HomeTaskSessionScope;
}
export interface TaskGigFields {
  title: string; description: string; price: number; category: string;
  cancellation_policy: 'flexible' | 'standard' | 'strict';
  location: { mode: 'address'; latitude: number; longitude: number; address: string; city?: string; state?: string; zip?: string };
}
export interface TaskGigReceipt {
  home_id: string; actor_id: string; task_id: string; request_id: string; gig_id: string;
  request_hash: string; created_at: string;
}
export interface PendingTaskGig {
  version: 1; origin: string; actor_id: string; home_id: string; task_id: string;
  request_id: string; expected_updated_at: string; fields: TaskGigFields; confirmed?: TaskGigReceipt;
}
export interface TaskGigResponse {
  replayed: boolean; publication_receipt: TaskGigReceipt; task_session: HomeTaskSessionScope;
  gig: { id: string; user_id: string; created_by: string; title: string; description: string; price: number; status: string };
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
export function validTaskGigState(value: unknown, homeId: string, taskId: string): value is TaskGigState {
  return object(value) && value.ok === true && value.home_id === homeId && value.task_id === taskId
    && date(value.task_updated_at) && typeof value.can_publish === 'boolean'
    && (value.gig_id === null || typeof value.gig_id === 'string' && TASK_UUID.test(value.gig_id));
}
export function validTaskGigFields(value: unknown): value is TaskGigFields {
  if (!object(value) || Object.keys(value).some(k => !['title','description','price','category','cancellation_policy','location'].includes(k))
    || typeof value.title !== 'string' || value.title.trim().length < 5 || value.title.length > 255
    || typeof value.description !== 'string' || value.description.trim().length < 10
    || typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price <= 0 || value.price > 99999999.99
    || Math.abs(value.price * 100 - Math.round(value.price * 100)) > 0.000001
    || typeof value.category !== 'string' || !value.category || value.category.length > 100
    || !['flexible','standard','strict'].includes(value.cancellation_policy as string) || !object(value.location)) return false;
  const l = value.location;
  return !Object.keys(l).some(k => !['mode','latitude','longitude','address','city','state','zip'].includes(k))
    && l.mode === 'address' && typeof l.latitude === 'number' && Number.isFinite(l.latitude) && Math.abs(l.latitude) <= 90
    && typeof l.longitude === 'number' && Number.isFinite(l.longitude) && Math.abs(l.longitude) <= 180
    && typeof l.address === 'string' && l.address.length >= 3 && l.address.length <= 500
    && ['city','state','zip'].every(k => l[k] === undefined || typeof l[k] === 'string');
}
export function validTaskGigReceipt(value: unknown, pending: PendingTaskGig): value is TaskGigReceipt {
  return object(value) && value.home_id === pending.home_id && value.actor_id === pending.actor_id
    && value.task_id === pending.task_id && value.request_id === pending.request_id
    && typeof value.gig_id === 'string' && TASK_UUID.test(value.gig_id)
    && typeof value.request_hash === 'string' && /^[a-f0-9]{64}$/.test(value.request_hash) && date(value.created_at);
}
export function validPendingTaskGig(value: unknown, origin: string, actor: string, home: string, task: string): value is PendingTaskGig {
  return object(value) && !Object.keys(value).some(k => !['version','origin','actor_id','home_id','task_id','request_id','expected_updated_at','fields','confirmed'].includes(k))
    && value.version === 1 && value.origin === origin && value.actor_id === actor && value.home_id === home && value.task_id === task
    && typeof value.request_id === 'string' && TASK_UUID.test(value.request_id) && date(value.expected_updated_at)
    && validTaskGigFields(value.fields) && (value.confirmed === undefined || validTaskGigReceipt(value.confirmed, value as unknown as PendingTaskGig));
}
export function taskGigBody(pending: PendingTaskGig) {
  return { ...pending.fields, attachments: [], location_precision: 'approx_area', reveal_policy: 'after_assignment', visibility_scope: 'city',
    home_task_source: { home_id: pending.home_id, task_id: pending.task_id, request_id: pending.request_id,
      expected_updated_at: pending.expected_updated_at, reviewed: true } };
}
