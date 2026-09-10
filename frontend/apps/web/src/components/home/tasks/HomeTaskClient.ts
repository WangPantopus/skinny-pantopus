import * as api from '@pantopus/api';
import { TASK_UUID, validTask, validTaskFields, taskPatchMatches, validRetainedTaskCreate,
  type HomeTask, type HomeTaskPatch, type RetainedTaskCreate, type TaskCollection,
  type TaskResponse, type TaskCreationResponse } from './homeTaskModel';

export class TaskCreationFailure extends Error {
  readonly canAcknowledge: boolean;
  constructor(failure: unknown) {
    super(failure instanceof Error ? failure.message : 'The task request was not confirmed. Retry the original request.');
    const response = failure as { statusCode?: number; code?: string; data?: { code?: string } };
    const code = response?.code || response?.data?.code;
    this.canAcknowledge = (response?.statusCode === 400 && code === 'HOME_RECORD_INVALID')
      || (response?.statusCode === 409 && code === 'HOME_TASK_CREATE_RETIRED');
  }
}

/** A Home task action uses current server capabilities within its opening session. */
export class HomeTaskClient {
  readonly origin = api.getApiBaseUrl();
  private readonly token = api.getAuthToken();
  private readonly marker: string | null | undefined;
  private scope: api.HomeTaskSessionScope | null;
  private actor: string | null = null;
  private retired = false;
  private generation = 0;
  private mutating = false;
  private creationAllowed = false;

  constructor(readonly homeId: string, openingScope?: api.HomeTaskSessionScope | null) {
    this.scope = openingScope ? { ...openingScope } : null;
    try { this.marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY); } catch { this.retired = true; }
    if (!TASK_UUID.test(homeId) || (this.scope && this.scope.home_id !== homeId)) this.retired = true;
  }

  get actorId() { return this.actor; }
  get currentScope() { return this.scope ? { ...this.scope } : null; }
  get revision() { return this.generation; }
  get canCreate() { return !this.retired && this.creationAllowed; }
  invalidatePending() { this.generation++; }
  retire() { this.retired = true; this.creationAllowed = false; this.scope = null; this.invalidatePending(); }

  requireCurrent(revision = this.generation) {
    if (revision !== this.generation) throw new Error('This task action is no longer open.');
    try {
      if (this.retired || !this.token || this.marker === undefined || api.getAuthToken() !== this.token
        || api.getApiBaseUrl() !== this.origin || localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) !== this.marker) {
        this.retire(); throw api.taskSessionChanged();
      }
    } catch (error) { this.retire(); throw error; }
  }

  private async request<T>(run: () => Promise<T>, revision: number): Promise<T> {
    this.requireCurrent(revision);
    try {
      const result = await run();
      this.requireCurrent(revision);
      return result;
    } catch (error) {
      this.requireCurrent(revision);
      const failure = error as { statusCode?: number; code?: string; data?: { code?: string } };
      if (failure?.statusCode === 401 || failure?.code === 'SESSION_SCOPE_CHANGED' || failure?.data?.code === 'SESSION_SCOPE_CHANGED') {
        this.retire(); throw api.taskSessionChanged();
      }
      throw error;
    }
  }

  private async identify(revision: number) {
    this.requireCurrent(revision);
    if (!this.actor) {
      const profile = await this.request(() => api.users.getMyProfile(), revision);
      if (!TASK_UUID.test(profile.id) || (this.scope && this.scope.actor_id !== profile.id)) {
        this.retire(); throw api.taskSessionChanged();
      }
      this.actor = profile.id;
    }
  }

  private bind(scope: api.HomeTaskSessionScope) {
    if (!scope || scope.actor_id !== this.actor || scope.home_id !== this.homeId
      || !/^[a-f0-9]{64}$/.test(scope.session_scope)
      || (this.scope && scope.session_scope !== this.scope.session_scope)) {
      this.retire(); throw api.taskSessionChanged();
    }
    this.scope = { ...scope };
  }

  private endpoint(taskId?: string) {
    if (taskId && !TASK_UUID.test(taskId)) throw new Error('This task link is invalid.');
    return `/api/homes/${this.homeId}/tasks${taskId ? `/${taskId}` : ''}`;
  }
  private options() { return { headers: api.taskSessionHeaders(this.scope || undefined) }; }

  async list(revision = this.generation): Promise<TaskCollection> {
    await this.identify(revision);
    const result = await this.request(() => api.get<TaskCollection>(this.endpoint(), undefined, this.options()), revision);
    this.bind(result.task_session);
    if (typeof result.collection_capabilities?.can_create !== 'boolean' || !Array.isArray(result.tasks)
      || !result.tasks.every(task => validTask(task, this.homeId))
      || new Set(result.tasks.map(task => task.id)).size !== result.tasks.length) throw new Error('The task list could not be verified. Retry.');
    this.creationAllowed = result.collection_capabilities.can_create;
    return result;
  }

  async detail(taskId: string, revision = this.generation): Promise<HomeTask> {
    await this.identify(revision);
    const result = await this.request(() => api.get<TaskResponse>(this.endpoint(taskId), undefined, this.options()), revision);
    this.bind(result.task_session);
    if (!validTask(result.task, this.homeId, taskId)) throw new Error('The task could not be verified. Retry.');
    return result.task;
  }

  private async mutation<T>(run: (revision: number) => Promise<T>): Promise<T> {
    this.requireCurrent();
    if (this.mutating) throw new Error('Wait for the current task action to finish.');
    this.mutating = true;
    try { return await run(this.generation); } finally { this.mutating = false; }
  }

  async create(draft: RetainedTaskCreate): Promise<TaskCreationResponse> {
    return this.mutation(async revision => {
      const collection = await this.list(revision);
      if (!this.actor || !validRetainedTaskCreate(draft, this.origin, this.actor, this.homeId)) throw new Error('The saved task request could not be verified.');
      if (!collection.collection_capabilities.can_create) throw new Error('You no longer have permission to create this task.');
      const result = await this.request(() => api.post<TaskCreationResponse>(this.endpoint(),
        { ...draft.payload, request_id: draft.request_id }, this.options()), revision)
        .catch(error => { throw new TaskCreationFailure(error); });
      this.bind(result.task_session);
      const receipt = result.creation_receipt;
      if (!validTask(result.task, this.homeId) || result.task.created_by !== this.actor || typeof result.replayed !== 'boolean'
        || !receipt || receipt.home_id !== this.homeId || receipt.actor_id !== this.actor
        || receipt.request_id !== draft.request_id || receipt.task_id !== result.task.id
        || typeof receipt.payload_hash !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.payload_hash)
        || typeof receipt.created_at !== 'string' || !Number.isFinite(Date.parse(receipt.created_at))
        || (draft.confirmed && (draft.confirmed.task_id !== receipt.task_id || draft.confirmed.payload_hash !== receipt.payload_hash))) {
        throw new Error('The task save was not confirmed. Keep the original request and retry.');
      }
      return result;
    });
  }

  async edit(taskId: string, patch: HomeTaskPatch): Promise<HomeTask> {
    return this.mutation(async revision => {
      if (!validTaskFields(patch, false)) throw new Error('Check the task fields before saving.');
      const before = await this.detail(taskId, revision);
      const fields = Object.keys(patch);
      if (fields.some(field => field !== 'status') && before.capabilities?.can_edit !== true) throw new Error('You no longer have permission to edit this task.');
      if (Object.hasOwn(patch, 'status') && before.capabilities?.can_complete !== true) throw new Error('You no longer have permission to change this task status.');
      if (!fields.length) return before;
      const result = await this.request(() => api.put<{ task: HomeTask }>(this.endpoint(taskId), patch, this.options()), revision);
      if (!validTask(result.task, this.homeId, taskId) || !taskPatchMatches(result.task, patch)) throw new Error('The task update was not confirmed. Retry the original changes.');
      return this.detail(taskId, revision);
    });
  }

  async delete(taskId: string): Promise<void> {
    return this.mutation(async revision => {
      const task = await this.detail(taskId, revision);
      if (task.capabilities?.can_delete !== true) throw new Error('You no longer have permission to delete this task.');
      const result = await this.request(() => api.del<{ message: string }>(this.endpoint(taskId), undefined, this.options()), revision);
      if (result.message !== 'Task deleted') throw new Error('Task deletion was not confirmed. Reload the list before continuing.');
    });
  }
}
