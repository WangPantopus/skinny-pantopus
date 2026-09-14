import { get } from './client';

/** Opaque account/session binding carried with the task read, never a credential. */
export interface HomeTaskSessionScope { actor_id: string; session_scope: string; home_id: string }
export function taskSessionChanged(): Error & { code: string } {
  return Object.assign(new Error('Your signed-in session changed. Reopen this screen before continuing.'), { code: 'SESSION_SCOPE_CHANGED' });
}
export function rethrowTaskSessionError(error: unknown): never {
  const failure = error as { code?: string; statusCode?: number; data?: { code?: string } };
  if (failure?.code === 'SESSION_SCOPE_CHANGED' || failure?.data?.code === 'SESSION_SCOPE_CHANGED' || failure?.statusCode === 401) throw taskSessionChanged();
  throw error;
}
export function taskSessionHeaders(scope?: HomeTaskSessionScope) {
  if (!scope) return undefined;
  if (!scope.actor_id || !/^[0-9a-f]{64}$/.test(scope.session_scope) || !scope.home_id) throw taskSessionChanged();
  return { 'x-pantopus-session-scope': scope.session_scope };
}
export async function assertHomeTaskSession(scope: HomeTaskSessionScope, taskId: string | null = null): Promise<void> {
  const result = await get<HomeTaskSessionScope & { task_id: string | null }>(`/api/upload/home-task-media-session/${scope.home_id}`,
    taskId ? { task_id: taskId } : undefined, { headers: taskSessionHeaders(scope) }).catch(rethrowTaskSessionError);
  if (result.actor_id !== scope.actor_id || result.session_scope !== scope.session_scope || result.home_id !== scope.home_id
    || result.task_id !== taskId) throw taskSessionChanged();
}
