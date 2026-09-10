import { HomeTaskClient } from './HomeTaskClient';
import { PendingRecurrenceStore, type RecurrenceSnapshot } from './PendingRecurrenceStore';
import { validRecurrenceCommand, type PendingRecurrence, type RecurrenceCommand, type RecurrenceState } from './homeTaskRecurrenceModel';

export type RecurrenceStore = Pick<PendingRecurrenceStore, 'load' | 'save' | 'clear'>;
export class HomeTaskRecurrenceController {
  private saved: RecurrenceSnapshot | null = null;
  private working = false;
  canDiscard = false;
  state: RecurrenceState;
  get pending(): PendingRecurrence | null { return this.saved ? structuredClone(this.saved.draft) : null; }

  private constructor(readonly client: HomeTaskClient, readonly taskId: string, private store: RecurrenceStore, state: RecurrenceState) {
    this.state = state;
  }
  static async open(client: HomeTaskClient, taskId: string, store?: RecurrenceStore) {
    const revision = client.revision;
    const state = await client.recurrence(taskId, revision);
    if (!client.actorId) throw new Error('Your signed-in account could not be verified.');
    const controller = new HomeTaskRecurrenceController(client, taskId,
      store || new PendingRecurrenceStore(client.origin, client.actorId, client.homeId, taskId), state);
    controller.saved = await controller.store.load();
    client.requireCurrent(revision);
    return controller;
  }
  private current(revision: number) {
    this.client.requireCurrent(revision);
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') throw new Error('Reopen this schedule before continuing.');
    return true;
  }
  private async requireSaved(revision: number) {
    this.current(revision);
    const actual = await this.store.load();
    this.current(revision);
    if (!this.saved || actual?.revision !== this.saved.revision) throw new Error('Another tab changed the saved schedule request. Reload this panel.');
  }
  private async operation<T>(run: (revision: number) => Promise<T>) {
    if (this.working) throw new Error('Wait for the current schedule change.');
    const revision = this.client.revision;
    this.current(revision); this.working = true;
    try { return await run(revision); } finally { this.working = false; }
  }
  async submit(command: RecurrenceCommand) {
    return this.operation(async revision => {
      if (this.saved || !validRecurrenceCommand(command)) throw new Error('Finish the saved schedule change before starting another.');
      if (!this.state.can_manage || !this.client.actorId) throw new Error('You cannot change this repeat schedule.');
      const draft: PendingRecurrence = { version: 1, origin: this.client.origin, actor_id: this.client.actorId,
        home_id: this.client.homeId, task_id: this.taskId, request_id: crypto.randomUUID(), command: structuredClone(command) };
      this.saved = await this.store.save(draft, null, () => this.current(revision));
      this.current(revision);
      return this.dispatch(revision);
    });
  }
  async retry() {
    return this.operation(async revision => {
      if (!this.saved || this.saved.draft.confirmed) throw new Error('There is no unconfirmed change to retry.');
      return this.dispatch(revision);
    });
  }
  private async dispatch(revision: number) {
    if (!this.saved) throw new Error('The saved schedule change is unavailable.');
    const original = this.saved;
    this.canDiscard = false;
    try {
      await this.requireSaved(revision);
      const response = await this.client.changeRecurrence(original.draft, () => this.requireSaved(revision));
      this.current(revision);
      this.saved = await this.store.save({ ...original.draft, confirmed: response.receipt }, original, () => this.current(revision));
      this.current(revision);
      this.state = response;
      return response;
    } catch (error) {
      this.current(revision);
      const failure = error as { statusCode?: number; code?: string; data?: { code?: string } };
      const code = failure.code || failure.data?.code;
      this.canDiscard = (failure.statusCode === 409 && code === 'HOME_TASK_RECURRENCE_STALE')
        || (failure.statusCode === 400 && code === 'HOME_RECORD_INVALID');
      throw error;
    }
  }
  async acknowledge() {
    return this.operation(async revision => {
      if (!this.saved || (!this.saved.draft.confirmed && !this.canDiscard)) throw new Error('Retry the original change before dismissing it.');
      const state = await this.client.recurrence(this.taskId, revision);
      await this.requireSaved(revision);
      await this.store.clear(this.saved, () => this.current(revision));
      this.current(revision);
      this.saved = null; this.canDiscard = false; this.state = state;
    });
  }
}
