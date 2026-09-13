import * as api from '@pantopus/api';
import { PendingHomeCreationStore, type HomeCreationSnapshot } from './PendingHomeCreationStore';
import { HOME_CREATE_UUID, validHomeCreationInput, type HomeCreationDraft, type HomeRequestDraft,
  type HomeCreationInput, type HomeCreationOutcome } from './homeCreationModel';
import { validHomeRequestOutcome, projectHomeRequestOutcome, sameHomeRequestDecision, validHomeResidencyInput,
  type HomeResidencyInput } from './homeResidencySubmissionModel';

export const HOME_CREATE_UNKNOWN = 'The result is not confirmed. Your original request is kept. Check its status, retry it, or confirm cancellation.';
type Store = Pick<PendingHomeCreationStore, 'load' | 'save' | 'clear'>;

/** One actor/origin and immutable command, even across lost replies and concurrent tabs. */
export class HomeCreationController {
  readonly origin = api.getApiBaseUrl();
  private readonly token = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private retired = false;
  private busy = false;
  private snapshot: HomeCreationSnapshot | null = null;
  private observed: HomeCreationOutcome | null = null;
  private attempted = false;
  private store: Store | null = null;
  actorId: string | null = null;

  get pending() { return this.snapshot ? structuredClone(this.snapshot.draft) : null; }
  get canAcknowledge() { return !!this.snapshot?.draft.outcome && this.snapshot.draft.outcome.state !== 'pending' && !this.busy; }
  get needsReload() { return this.attempted && !this.snapshot; }
  retire() { this.retired = true; }
  current() {
    try { return !this.retired && !!this.token && api.getAuthToken() === this.token
      && api.getApiBaseUrl() === this.origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === this.marker; }
    catch { return false; }
  }
  requireCurrent() { if (!this.current()) throw new Error('This Home form is no longer current. Reopen it to check your account and saved request.'); }

  async open(storeForActor: (actor: string) => Store = actor => new PendingHomeCreationStore(this.origin, actor)) {
    this.requireCurrent();
    const profile = await api.users.getMyProfile();
    this.requireCurrent();
    if (!HOME_CREATE_UUID.test(profile?.id || '')) throw new Error('Your account could not be verified. Reopen this form.');
    this.actorId = profile.id;
    this.store = storeForActor(profile.id);
    const saved = await this.store.load();
    this.requireCurrent();
    this.snapshot = saved;
    this.attempted = !!saved;
  }

  async submit(input: HomeCreationInput) {
    return this.action(async () => {
      if (this.attempted || this.snapshot) throw new Error('Recover the original Home request before starting another.');
      if (!this.actorId || !this.store || !validHomeCreationInput(input)) throw new Error('Check the address, Home details and optional setup before saving.');
      const requestId = crypto.randomUUID();
      const draft: HomeCreationDraft = { version: 1, origin: this.origin, actor_id: this.actorId,
        request_id: requestId, request_json: JSON.stringify({ ...input, request_id: requestId }) };
      this.attempted = true;
      this.snapshot = await this.store.save(draft, null, () => this.current());
      this.requireCurrent();
      await this.resolve('retry');
    });
  }
  async submitResidency(homeId: string, input: HomeResidencyInput) {
    return this.action(async () => {
      if (this.attempted || this.snapshot) throw new Error('Recover the original Home request before starting another.');
      if (!this.actorId || !this.store || !HOME_CREATE_UUID.test(homeId) || !validHomeResidencyInput(input)) {
        throw new Error('Check the existing Home address and your relationship before submitting.');
      }
      const requestId = crypto.randomUUID();
      const draft: HomeRequestDraft = { version: 2, home_id: homeId.toLowerCase(), origin: this.origin, actor_id: this.actorId,
        request_id: requestId, request_json: JSON.stringify({ ...input, request_id: requestId }) };
      this.attempted = true;
      this.snapshot = await this.store.save(draft, null, () => this.current());
      this.requireCurrent();
      await this.resolve('retry');
    });
  }
  async recover(action: 'status' | 'retry' | 'cancel') { return this.action(() => this.resolve(action)); }

  private async resolve(action: 'status' | 'retry' | 'cancel') {
    const original = this.snapshot;
    if (!original || !this.store) throw new Error('Reopen this form to recover the original Home request.');
    const saved = await this.store.load();
    this.requireCurrent();
    if (!saved || saved.revision !== original.revision || saved.draft.request_json !== original.draft.request_json) {
      throw new Error('Another tab changed the original request. Reopen this form to recover it.');
    }
    // An observed decision is immutable even if saving its proof failed. Repair
    // that write without reposting or accepting a different decision.
    const outcome = this.observed || original.draft.outcome;
    if (outcome && outcome.state !== 'pending') {
      if (!original.draft.outcome || original.draft.outcome.state === 'pending') await this.saveOutcome(outcome, original);
      return;
    }
    const submitEndpoint = original.draft.version === 2 ? `/api/homes/${original.draft.home_id}/residency-submissions` : '/api/homes';
    const endpoint = original.draft.version === 2 ? `${submitEndpoint}/${original.draft.request_id}` : `/api/homes/create-commands/${original.draft.request_id}`;
    let body: unknown, status: number | undefined;
    try {
      const response = await api.apiClient.request<unknown>({
        url: action === 'retry' ? submitEndpoint : endpoint + (action === 'cancel' ? '/cancel' : ''),
        method: action === 'status' ? 'GET' : 'POST',
        data: action === 'retry' ? original.draft.request_json : action === 'cancel' ? {} : undefined,
        headers: { 'Cache-Control': 'no-cache, no-store', 'Content-Type': 'application/json' },
      });
      body = response.data; status = response.status;
    } catch (error) {
      const failure = error as { statusCode?: number; data?: unknown };
      body = failure?.data; status = failure?.statusCode;
      if (status === 401) this.retire();
    }
    this.requireCurrent();
    if (!validHomeRequestOutcome(body, original.draft)) throw new Error(HOME_CREATE_UNKNOWN);
    const allowed = { completed: [200, 201], pending: [202, 503], cancelled: [200], rejected: [400, 403, 404, 409, 422] };
    if (!status || !allowed[body.state].includes(status)) throw new Error(HOME_CREATE_UNKNOWN);
    const proof = projectHomeRequestOutcome(body, original.draft);
    if (this.observed && !sameHomeRequestDecision(this.observed, proof, original.draft)) throw new Error(HOME_CREATE_UNKNOWN);
    if (proof.state !== 'pending') this.observed = proof;
    await this.saveOutcome(proof, original);
  }

  private async saveOutcome(outcome: HomeCreationOutcome, original: HomeCreationSnapshot) {
    this.snapshot = await this.store!.save({ ...original.draft, outcome }, original, () => this.current());
    this.requireCurrent();
  }

  async acknowledge(): Promise<HomeRequestDraft> {
    if (!this.canAcknowledge) throw new Error('Confirm and save the original outcome before continuing.');
    return this.action(async () => {
      const original = this.snapshot!;
      await this.store!.clear(original, () => this.current());
      this.requireCurrent();
      this.snapshot = null; this.observed = null; this.attempted = false;
      return structuredClone(original.draft);
    });
  }

  private async action<T>(run: () => Promise<T>): Promise<T> {
    this.requireCurrent();
    if (this.busy) throw new Error('Wait for the current Home request to finish.');
    this.busy = true;
    try { return await run(); } finally { this.busy = false; }
  }
}
