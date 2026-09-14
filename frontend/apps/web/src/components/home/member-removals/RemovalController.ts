import * as api from '@pantopus/api';
import { PendingRemovalStore, type RemovalSnapshot } from './PendingRemovalStore';
import { validInvitationSession, validRemovalInput, validateRemovalContext, validRemovalOutcome,
  projectRemovalSummary, projectRemovalOutcome, removalMessage,
  type RemovalInput, type RemovalSession, type RemovalContext, type RemovalDraft, type RemovalOutcome } from './removalModel';
import { invitationUUID as uuid } from '../../homes/invitations/invitationDecisionModel';

type Store = Pick<PendingRemovalStore, 'load' | 'save' | 'clear'>;
export const removalBase = '/api/homes/member-removals';
const UNKNOWN = 'The result is not confirmed. Your original removal is kept. Check its saved result, retry that same removal, or cancel the attempt.';
export class RemovalController {
  readonly origin = api.getApiBaseUrl();
  private readonly auth = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private retired = false;
  private busy = false;
  private attempted = false;
  private snapshot: RemovalSnapshot | null = null;
  private observed: RemovalOutcome | null = null;
  private store: Store | null = null;
  private session: RemovalSession | null = null;
  opened = false;
  accountLabel = '';
  context: RemovalContext | null = null;

  get actorId() { return this.session?.actor_id ?? null; }
  get pending() { return this.snapshot ? structuredClone(this.snapshot.draft) : null; }
  get canAcknowledge() { return !!this.snapshot?.draft.outcome && this.snapshot.draft.outcome.state !== 'pending' && !this.busy; }
  get needsReload() { return this.attempted && !this.snapshot; }
  retire() { this.retired = true; this.context = null; }
  current() {
    try {
      return !this.retired && !!this.auth && api.getAuthToken() === this.auth && api.getApiBaseUrl() === this.origin
        && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === this.marker && document.visibilityState !== 'hidden';
    } catch { return false; }
  }
  private requireCurrent() {
    if (!this.current()) throw new Error('This removal page is no longer current. Reopen recovery to check your saved action.');
  }
  private authenticationFailure(error: unknown) {
    const failure = error as { statusCode?: number; code?: string };
    if (failure?.statusCode === 401 || failure?.code === 'SESSION_SCOPE_CHANGED') this.retire();
  }
  async open(storeForActor: (actor: string) => Store = actor => new PendingRemovalStore(this.origin, actor)) {
    this.requireCurrent();
    const response = await api.apiClient.get<{ session: unknown }>(removalBase + '/session');
    this.requireCurrent();
    if (!validInvitationSession(response.data?.session)) throw new Error('Your signed-in session could not be checked.');
    this.session = response.data.session;
    let profile: Awaited<ReturnType<typeof api.users.getMyProfile>> | null = null;
    try { profile = await api.users.getMyProfile(); } catch (error) { this.authenticationFailure(error); }
    this.requireCurrent();
    if (profile && profile.id !== this.session.actor_id) { this.retire(); throw new Error('Your account changed. Reopen removal recovery.'); }
    this.accountLabel = profile?.name || profile?.username || 'Your current account';
    this.store = storeForActor(this.session.actor_id);
    const saved = await this.store.load();
    this.requireCurrent(); this.snapshot = saved; this.attempted = !!saved; this.opened = true;
  }
  async prepare(input: RemovalInput) {
    return this.action(async () => {
      this.context = null;
      if (this.snapshot || this.attempted) throw new Error('Recover and acknowledge your earlier removal first.');
      if (!validRemovalInput(input)) throw new Error('Select a current household member before reviewing removal.');
      const original = { home_id: input.home_id.toLowerCase(), target_user_id: input.target_user_id.toLowerCase() };
      await this.checkSession();
      let body: unknown;
      try { body = (await api.apiClient.post(removalBase + '/context', original, { headers: this.headers() })).data; }
      catch (error) {
        this.authenticationFailure(error); this.requireCurrent();
        throw new Error(removalMessage((error as { code?: string })?.code));
      }
      this.requireCurrent(); validateRemovalContext(body, original, this.session!);
      this.context = { ...original, occupancy_id: body.occupancy_id, action: 'remove', decision_token: body.decision_token,
        ...projectRemovalSummary(body), session: { ...body.session } };
    });
  }
  cancelReview() { this.requireCurrent(); if (!this.busy) this.context = null; }
  async submit(expectedDecision: string) {
    return this.action(async () => {
      const context = this.context;
      if (!context || context.decision_token !== expectedDecision || this.snapshot || this.attempted || !this.store || !this.session)
        throw new Error('Review the current member details before confirming.');
      await this.checkSession();
      const input = { request_id: crypto.randomUUID(), home_id: context.home_id, target_user_id: context.target_user_id,
        occupancy_id: context.occupancy_id, action: 'remove' as const, decision_token: context.decision_token };
      const draft: RemovalDraft = { version: 1, origin: this.origin, actor_id: this.session.actor_id, ...input,
        reviewed: projectRemovalSummary(context), request_json: JSON.stringify(input) };
      // Even an uncertain storage write retires creation until the persisted slot is reopened.
      this.attempted = true;
      this.snapshot = await this.store.save(draft, null, () => this.current());
      this.requireCurrent(); this.context = null;
      await this.resolve('retry');
    });
  }
  async recover(action: 'status' | 'retry' | 'cancel', expectedRequestId?: string) {
    return this.action(async () => {
      if (expectedRequestId && this.snapshot?.draft.request_id !== expectedRequestId) throw new Error('The original removal changed. Reopen recovery.');
      await this.resolve(action);
    });
  }
  private async resolve(action: 'status' | 'retry' | 'cancel') {
    const original = this.snapshot;
    if (!original || !this.store) throw new Error('Reopen recovery to check the original removal.');
    const saved = await this.store.load(); this.requireCurrent();
    if (!saved || saved.revision !== original.revision || saved.draft.request_json !== original.draft.request_json)
      throw new Error('Another tab changed the saved removal. Reopen recovery.');
    const known = this.observed || original.draft.outcome;
    if (known && known.state !== 'pending') {
      if (!original.draft.outcome || original.draft.outcome.state === 'pending') await this.saveOutcome(known, original);
      return;
    }
    await this.checkSession();
    const d = original.draft;
    let body: unknown, status: number | undefined;
    try {
      const { request_id: _requestId, ...cancelBody } = JSON.parse(d.request_json);
      const response = await api.apiClient.request<unknown>({
        url: action === 'retry' ? removalBase + '/commands' : `${removalBase}/commands/${d.request_id}${action === 'cancel' ? '/cancel' : ''}`,
        method: action === 'status' ? 'GET' : 'POST',
        data: action === 'retry' ? d.request_json : action === 'cancel' ? JSON.stringify(cancelBody) : undefined,
        headers: this.headers(), transformRequest: [data => data],
      });
      body = response.data; status = response.status;
    } catch (error) {
      const failure = error as { statusCode?: number; data?: unknown };
      body = failure?.data; status = failure?.statusCode; this.authenticationFailure(error);
    }
    this.requireCurrent();
    const session = (body as { session?: unknown } | null)?.session;
    if (!validInvitationSession(session) || session.actor_id !== this.session!.actor_id || session.session_scope !== this.session!.session_scope
      || !validRemovalOutcome(body, d) || action === 'status' && Object.hasOwn(body, 'replayed')
      || status !== (body.state === 'rejected' ? body.status : 200)) throw new Error(UNKNOWN);
    const outcome = projectRemovalOutcome(body);
    if (outcome.state !== 'pending') this.observed = outcome;
    await this.saveOutcome(outcome, original);
  }
  private async saveOutcome(outcome: RemovalOutcome, original: RemovalSnapshot) {
    this.snapshot = await this.store!.save({ ...original.draft, outcome }, original, () => this.current()); this.requireCurrent();
  }
  private async checkSession() {
    let response;
    try { response = await api.apiClient.get<{ session: unknown }>(removalBase + '/session'); }
    catch (error) { this.authenticationFailure(error); this.requireCurrent(); throw error; }
    this.requireCurrent(); const session = response.data?.session;
    if (!validInvitationSession(session) || session.actor_id !== this.session!.actor_id || session.session_scope !== this.session!.session_scope) {
      this.retire(); throw new Error('Your session changed. Reopen removal recovery.');
    }
  }
  /** Fresh list evidence is independent of the historical receipt. It never mutates the saved original. */
  async checkCurrentRoster(input: RemovalInput): Promise<boolean> {
    this.requireCurrent();
    if (!this.opened || !validRemovalInput(input)) throw new Error('Select a Home and member to check.');
    await this.checkSession();
    let response;
    try { response = await api.apiClient.get<{ occupants: unknown }>(`/api/homes/${input.home_id}/occupants`, { headers: this.headers() }); }
    catch (error) { this.authenticationFailure(error); this.requireCurrent(); throw error; }
    this.requireCurrent();
    const rows = response.data?.occupants;
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row)
      || !uuid(row.id) || !uuid(row.user_id) || row.home_id !== input.home_id || row.is_active !== true)
      || new Set(rows.map(row => row.user_id)).size !== rows.length) throw new Error('The current member list could not be verified.');
    await this.checkSession();
    return rows.some(row => row.user_id === input.target_user_id);
  }
  async acknowledge(expectedRequestId: string) {
    if (!this.canAcknowledge || this.snapshot?.draft.request_id !== expectedRequestId) throw new Error('Save the original result before continuing.');
    return this.action(async () => {
      const original = this.snapshot!;
      try { await this.store!.clear(original, () => this.current()); }
      catch (error) {
        this.requireCurrent(); const remaining = await this.store!.load(); this.requireCurrent();
        if (remaining !== null) throw error;
      }
      this.requireCurrent(); this.snapshot = null; this.observed = null; this.attempted = false; this.context = null;
      return structuredClone(original.draft);
    });
  }
  private headers() { return { 'X-Pantopus-Session-Scope': this.session!.session_scope, 'Cache-Control': 'no-cache, no-store', 'Content-Type': 'application/json' }; }
  private async action<T>(run: () => Promise<T>): Promise<T> {
    this.requireCurrent();
    if (!this.opened || this.busy) throw new Error('Wait for removal recovery to finish.');
    this.busy = true;
    try { return await run(); } finally { this.busy = false; }
  }
}
