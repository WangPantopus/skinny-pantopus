import { HomeTaskClient } from './HomeTaskClient';
import { PendingTaskGigStore, type TaskGigSnapshot } from './PendingTaskGigStore';
import { validTaskGigFields, type PendingTaskGig, type TaskGigFields, type TaskGigState } from './homeTaskGigModel';

export class HomeTaskGigController {
  private saved: TaskGigSnapshot | null = null;
  private working = false;
  canDiscard = false;
  get pending(): PendingTaskGig | null { return this.saved ? structuredClone(this.saved.draft) : null; }
  private constructor(readonly client: HomeTaskClient, readonly taskId: string,
    private store: PendingTaskGigStore, public state: TaskGigState) {}
  static async open(client: HomeTaskClient, taskId: string) {
    const revision = client.revision;
    const state = await client.gigPublication(taskId, revision);
    if (!client.actorId) throw new Error('Your account could not be verified.');
    const controller = new HomeTaskGigController(client, taskId,
      new PendingTaskGigStore(client.origin, client.actorId, client.homeId, taskId), state);
    controller.saved = await controller.store.load();
    client.requireCurrent(revision);
    return controller;
  }
  private current(revision: number) {
    this.client.requireCurrent(revision);
    if (document.visibilityState === 'hidden') throw new Error('Reopen this publication before continuing.');
    return true;
  }
  private async requireSaved(revision: number) {
    this.current(revision);
    const actual = await this.store.load();
    this.current(revision);
    if (!this.saved || actual?.revision !== this.saved.revision
      || JSON.stringify(actual.draft) !== JSON.stringify(this.saved.draft)) throw new Error('Another tab changed the original publication. Reload to recover it.');
  }
  private async operation<T>(run: (revision: number) => Promise<T>) {
    if (this.working) throw new Error('Wait for this publication to finish.');
    const revision = this.client.revision;
    this.current(revision); this.working = true;
    try { return await run(revision); } finally { this.working = false; }
  }
  async submit(fields: TaskGigFields) {
    return this.operation(async revision => {
      if (this.saved || !validTaskGigFields(fields)) throw new Error('Review the public title, description, budget and selected address.');
      if (!this.state.can_publish || !this.client.actorId) throw new Error('This task is not ready to publish.');
      const draft: PendingTaskGig = { version: 1, origin: this.client.origin, actor_id: this.client.actorId,
        home_id: this.client.homeId, task_id: this.taskId, request_id: crypto.randomUUID(),
        expected_updated_at: this.state.task_updated_at, fields: structuredClone(fields) };
      this.saved = await this.store.save(draft, null, () => this.current(revision));
      return this.dispatch(revision);
    });
  }
  async retry() {
    return this.operation(async revision => {
      if (!this.saved || this.saved.draft.confirmed) throw new Error('There is no unconfirmed publication to retry.');
      return this.dispatch(revision);
    });
  }
  private async dispatch(revision: number) {
    if (!this.saved) throw new Error('The saved publication is unavailable.');
    const original = this.saved;
    this.canDiscard = false;
    try {
      await this.requireSaved(revision);
      const response = await this.client.publishGig(original.draft, () => this.requireSaved(revision));
      this.current(revision);
      this.saved = await this.store.save({ ...original.draft, confirmed: response.publication_receipt }, original, () => this.current(revision));
      this.current(revision);
      this.state = { ...this.state, gig_id: response.publication_receipt.gig_id, can_publish: false };
      return response;
    } catch (error) {
      this.current(revision);
      const e = error as { statusCode?: number; code?: string; data?: { code?: string } };
      const code = e.data?.code || e.code;
      this.canDiscard = e.statusCode === 409 && ['HOME_TASK_GIG_STALE','HOME_TASK_GIG_NOT_READY','HOME_TASK_GIG_LINKED','HOME_TASK_GIG_RETIRED'].includes(code || '')
        || e.statusCode === 400 && code === 'HOME_RECORD_INVALID';
      throw error;
    }
  }
  async acknowledge() {
    return this.operation(async revision => {
      if (!this.saved || (!this.saved.draft.confirmed && !this.canDiscard)) throw new Error('Confirm the original result before clearing it.');
      const state = await this.client.gigPublication(this.taskId, revision);
      await this.requireSaved(revision);
      await this.store.clear(this.saved, () => this.current(revision));
      this.current(revision); this.saved = null; this.canDiscard = false; this.state = state;
    });
  }
}
