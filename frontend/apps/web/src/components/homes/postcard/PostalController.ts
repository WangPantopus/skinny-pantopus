import * as api from '@pantopus/api';
import { validateResidencyProgress } from '../residencyProgressModel';
import { PendingPostalStore, type PostalSnapshot } from './PendingPostalStore';
import { postalUUID, validMailingAddress, validPostalOutcome, projectPostalOutcome, validatePostalStatus,
  type MailingAddress, type PostalDraft, type PostalOutcome, type PostalStatus } from './postcardModel';

type Store = Pick<PendingPostalStore, 'load' | 'save' | 'clear'>;
const UNKNOWN = 'The result is not confirmed. Your original details are kept. Check the result, retry the same request, or confirm cancellation.';
export class PostalController {
  readonly origin = api.getApiBaseUrl();
  private readonly token = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private retired = false;
  private busy = false;
  private attempted = false;
  private snapshot: PostalSnapshot | null = null;
  private observed: PostalOutcome | null = null;
  private store: Store | null = null;
  actorId: string | null = null;
  opened = false;
  status: PostalStatus | null = null;
  progress: api.homes.PersonalResidencyProgress | null = null;
  constructor(readonly homeId: string) {}
  get pending() { return this.snapshot ? structuredClone(this.snapshot.draft) : null; }
  get canAcknowledge() { return !!this.snapshot?.draft.outcome && this.snapshot.draft.outcome.state !== 'pending' && !this.busy; }
  get needsReload() { return this.attempted && !this.snapshot; }
  retire() { this.retired = true; this.status = null; this.progress = null; }
  current() {
    try { return !this.retired && !!this.token && api.getAuthToken() === this.token && api.getApiBaseUrl() === this.origin
      && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === this.marker && document.visibilityState !== 'hidden'; }
    catch { return false; }
  }
  requireCurrent() { if (!this.current()) throw new Error('This mail verification page is no longer current. Reopen it to recover your saved request.'); }
  async open(storeForActor: (actor: string) => Store = actor => new PendingPostalStore(this.origin, actor, this.homeId)) {
    this.requireCurrent();
    if (!postalUUID(this.homeId)) throw new Error('The selected Home could not be checked.');
    const profile = await api.users.getMyProfile(); this.requireCurrent();
    if (!postalUUID(profile?.id)) throw new Error('Your account could not be checked.');
    this.actorId = profile.id;
    this.store = storeForActor(profile.id);
    const saved = await this.store.load(); this.requireCurrent();
    this.snapshot = saved; this.attempted = !!saved; this.opened = true;
  }
  async refresh() {
    return this.action(async () => {
      this.status = null; this.progress = null;
      let status: unknown, progress: unknown;
      try { [status, progress] = await Promise.all([api.homeOwnership.getCurrentPostcardStatus(this.homeId), api.homes.getMyResidencyProgress(this.homeId)]); }
      catch { this.requireCurrent(); throw new Error('Mail status could not be checked. Retry to check current access and mailing.'); }
      this.requireCurrent();
      validatePostalStatus(status, this.actorId!, this.homeId); validateResidencyProgress(progress, this.homeId);
      this.status = status; this.progress = progress;
    });
  }
  async requestMail(address: MailingAddress) {
    return this.action(async () => {
      if (!this.status?.can_request || !validMailingAddress(address)) throw new Error('Refresh mail status and confirm the complete mailing address first.');
      await this.begin('mail', { request_id: crypto.randomUUID(), address }, null);
    });
  }
  async resumeMail() {
    return this.action(async () => {
      const saved = this.status?.request;
      if (!this.status?.can_resume || !saved) throw new Error('Refresh status to check whether mailing can resume.');
      // This is the server's original actor-confirmed address and UUID, never
      // a replacement postcard. Only the server dispatch claim can send mail.
      await this.begin('mail', { request_id: saved.command.request_id, address: saved.address }, null);
    });
  }
  async verify(code: string) {
    return this.action(async () => {
      if (!this.status?.can_verify || !this.status.postcard || !/^[a-z0-9]{6,8}$/i.test(code)) throw new Error('Refresh status and enter the code from this postcard.');
      await this.begin('code', { request_id: crypto.randomUUID(), code }, this.status.postcard.id);
    });
  }
  private async begin(kind: PostalDraft['kind'], input: { request_id: string; address?: MailingAddress; code?: string }, postcardId: string | null) {
    if (this.snapshot || this.attempted || !this.store || !this.actorId) throw new Error('Recover the original postal request before starting another.');
    const draft: PostalDraft = { version: 1, origin: this.origin, actor_id: this.actorId, home_id: this.homeId,
      request_id: input.request_id, kind, postcard_id: postcardId, request_json: JSON.stringify(input) };
    this.attempted = true;
    this.snapshot = await this.store.save(draft, null, () => this.current()); this.requireCurrent();
    this.status = null; this.progress = null;
    await this.resolve('retry');
  }
  async recover(action: 'status' | 'retry' | 'cancel') { return this.action(() => this.resolve(action)); }
  private async resolve(action: 'status' | 'retry' | 'cancel') {
    const original = this.snapshot;
    if (!original || !this.store) throw new Error('Reopen recovery to check the original request.');
    const saved = await this.store.load(); this.requireCurrent();
    if (!saved || saved.revision !== original.revision || saved.draft.request_json !== original.draft.request_json) {
      throw new Error('Another tab changed this saved request. Reopen recovery to check it.');
    }
    const known = this.observed || original.draft.outcome;
    if (known && known.state !== 'pending') {
      if (!original.draft.outcome || original.draft.outcome.state === 'pending') await this.saveOutcome(known, original);
      return;
    }
    const d = original.draft;
    const submit = d.kind === 'mail' ? `/api/homes/${d.home_id}/postcard-requests`
      : `/api/homes/${d.home_id}/postcards/${d.postcard_id}/verifications`;
    let body: unknown, status: number | undefined;
    try {
      const response = await api.apiClient.request<unknown>({
        url: action === 'retry' ? submit : `${submit}/${d.request_id}${action === 'cancel' ? '/cancel' : ''}`,
        method: action === 'status' ? 'GET' : 'POST', data: action === 'retry' ? d.request_json : action === 'cancel' ? {} : undefined,
        headers: { 'Cache-Control': 'no-cache, no-store', 'Content-Type': 'application/json' },
      });
      body = response.data; status = response.status;
    } catch (error) {
      const failure = error as { statusCode?: number; data?: unknown };
      body = failure?.data; status = failure?.statusCode;
      if (status === 401) this.retire();
    }
    this.requireCurrent();
    if (!validPostalOutcome(body, d)) throw new Error(UNKNOWN);
    const allowed = { completed: [200], pending: [202], cancelled: [200], rejected: [400, 403, 404, 409, 410, 422, 429] };
    if (!status || !allowed[body.state].includes(status)) throw new Error(UNKNOWN);
    const outcome = projectPostalOutcome(body);
    if (outcome.state !== 'pending') this.observed = outcome;
    await this.saveOutcome(outcome, original);
  }
  private async saveOutcome(outcome: PostalOutcome, original: PostalSnapshot) {
    this.snapshot = await this.store!.save({ ...original.draft, outcome }, original, () => this.current()); this.requireCurrent();
  }
  async acknowledge() {
    if (!this.canAcknowledge) throw new Error('Save the original result before continuing.');
    return this.action(async () => {
      const original = this.snapshot!;
      await this.store!.clear(original, () => this.current()); this.requireCurrent();
      this.snapshot = null; this.observed = null; this.attempted = false; this.status = null; this.progress = null;
      return structuredClone(original.draft);
    });
  }
  private async action<T>(run: () => Promise<T>): Promise<T> {
    this.requireCurrent();
    if (!this.opened || this.busy) throw new Error('Wait for mail recovery to finish.');
    this.busy = true;
    try { return await run(); } finally { this.busy = false; }
  }
}
