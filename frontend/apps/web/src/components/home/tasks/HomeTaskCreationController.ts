import { HomeTaskClient, TaskCreationFailure } from './HomeTaskClient';
import { PendingHomeTaskStore, type TaskDraftSnapshot } from './PendingHomeTaskStore';
import { validTaskFields, type HomeTask, type HomeTaskFields, type RetainedTaskCreate } from './homeTaskModel';

function sameCommand(a: RetainedTaskCreate, b: RetainedTaskCreate): boolean {
  const entries = (fields: HomeTaskFields) => JSON.stringify(Object.entries(fields).sort(([left], [right]) => left.localeCompare(right)));
  return a.request_id === b.request_id && a.origin === b.origin && a.actor_id === b.actor_id
    && a.home_id === b.home_id && entries(a.payload) === entries(b.payload);
}

/** A form consumes one create command; retries never allocate another identity. */
export class HomeTaskCreationController {
  private snapshot: TaskDraftSnapshot | null = null;
  private observed: RetainedTaskCreate | null = null;
  private sawRequest = false;
  private finished = false;
  private busy = false;
  private terminal = false;

  constructor(readonly client: HomeTaskClient, private readonly store: PendingHomeTaskStore) {}

  static async open(client: HomeTaskClient): Promise<HomeTaskCreationController> {
    const revision = client.revision;
    await client.list(revision);
    client.requireCurrent(revision);
    if (!client.actorId) throw new Error('Your account could not be verified. Reopen this form.');
    const controller = new HomeTaskCreationController(client, new PendingHomeTaskStore(client.origin, client.actorId, client.homeId));
    await controller.reload();
    client.requireCurrent(revision);
    return controller;
  }

  get pending() { return this.snapshot ? structuredClone(this.snapshot.draft) : null; }
  get completed() { return this.finished; }
  get canAcknowledge() { return this.terminal && !!this.snapshot && !this.finished && !this.busy; }

  private current(revision: number) {
    try { this.client.requireCurrent(revision); return !this.finished; } catch { return false; }
  }

  async reload(): Promise<void> {
    const revision = this.client.revision;
    this.client.requireCurrent(revision);
    if (this.finished) throw new Error('This task form has already finished.');
    const saved = await this.store.load();
    this.client.requireCurrent(revision);
    if (this.sawRequest && !saved) throw new Error('The saved request changed in another tab. Close and reopen this form.');
    this.snapshot = saved;
    if (saved) {
      this.sawRequest = true;
      // If proof persistence failed, a live form retains only the observed
      // nonsecret identity/hash. Process loss cannot make that proof durable.
      if (this.observed?.confirmed && sameCommand(saved.draft, this.observed)) {
        this.snapshot = { ...saved, draft: { ...saved.draft, confirmed: { ...this.observed.confirmed } } };
      }
    }
  }

  async submit(fields: HomeTaskFields): Promise<HomeTask> {
    return this.action(async revision => {
      if (this.sawRequest || this.snapshot) throw new Error('Recover the saved task request before starting another task.');
      if (!validTaskFields(fields, true)) throw new Error('Check the task fields before saving.');
      const collection = await this.client.list(revision);
      if (!collection.collection_capabilities.can_create || !this.client.actorId) throw new Error('You no longer have permission to create this task.');
      const draft: RetainedTaskCreate = {
        version: 1, origin: this.client.origin, actor_id: this.client.actorId,
        home_id: this.client.homeId, request_id: crypto.randomUUID(), payload: structuredClone(fields),
      };
      this.snapshot = await this.store.save(draft, null, () => this.current(revision));
      this.sawRequest = true;
      this.client.requireCurrent(revision);
      return this.finish(revision);
    });
  }

  async retry(): Promise<HomeTask> {
    return this.action(async revision => {
      const expected = this.snapshot;
      if (!expected) throw new Error('Reopen the form to load the original task request.');
      const saved = await this.store.load();
      this.client.requireCurrent(revision);
      if (!saved || saved.revision !== expected.revision || !sameCommand(saved.draft, expected.draft)) {
        throw new Error('The saved request changed in another tab. Reopen this form before retrying.');
      }
      return this.finish(revision);
    });
  }

  private async finish(revision: number): Promise<HomeTask> {
    const original = this.snapshot;
    if (!original) throw new Error('The original task request is unavailable.');
    this.terminal = false;
    let result;
    try { result = await this.client.create(original.draft); }
    catch (error) {
      this.terminal = error instanceof TaskCreationFailure && error.canAcknowledge;
      throw error;
    }
    this.client.requireCurrent(revision);
    const confirmed = { task_id: result.creation_receipt.task_id, payload_hash: result.creation_receipt.payload_hash };
    this.observed = { ...original.draft, confirmed };
    // Even when the protected write fails, another live retry must compare the
    // already observed receipt. It cannot accept a different task or hash.
    this.snapshot = { ...original, draft: this.observed };
    this.snapshot = await this.store.save(this.observed, original, () => this.current(revision));
    this.client.requireCurrent(revision);
    const task = await this.client.detail(confirmed.task_id, revision);
    await this.store.clear(this.snapshot, () => this.current(revision));
    this.client.requireCurrent(revision);
    this.finished = true;
    this.snapshot = null;
    this.observed = null;
    return task;
  }

  async acknowledge(): Promise<void> {
    if (!this.canAcknowledge) throw new Error('The original task outcome is still unknown. Retry that request.');
    return this.action(async revision => {
      const original = this.snapshot;
      if (!this.terminal || !original) throw new Error('The saved request cannot be cleared.');
      await this.store.clear(original, () => this.current(revision));
      this.client.requireCurrent(revision);
      this.finished = true;
      this.snapshot = null;
      this.observed = null;
      this.terminal = false;
    });
  }

  private async action<T>(run: (revision: number) => Promise<T>): Promise<T> {
    this.client.requireCurrent();
    if (this.finished) throw new Error('This task form has already finished.');
    if (this.busy) throw new Error('Wait for the current task request to finish.');
    this.busy = true;
    try { return await run(this.client.revision); } finally { this.busy = false; }
  }
}
