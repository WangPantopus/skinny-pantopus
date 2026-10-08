import * as api from '@pantopus/api';
import { validateResidencyProgress } from '../residencyProgressModel';
import { PendingInvitationStore, type InvitationSnapshot } from './PendingInvitationStore';
import { transientFailure } from '../../home/returnRefresh';
import { chosenUsername } from '@pantopus/utils';
import { invitationUUID, validInvitationSession, validateInvitationContext, validInvitationOutcome, projectInvitationOutcome,
  invitationDecisionMessage, type InvitationSession, type InvitationContext, type InvitationDraft, type InvitationOutcome } from './invitationDecisionModel';

type Store = Pick<PendingInvitationStore, 'load' | 'save' | 'clear'>;
const UNKNOWN = 'We couldn’t confirm your answer. It’s kept: check again, try again, or discard this attempt.';
export class InvitationDecisionController {
  readonly origin = api.getApiBaseUrl();
  private readonly auth = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private retired = false;
  private busy = false;
  private attempted = false;
  private snapshot: InvitationSnapshot | null = null;
  private observed: InvitationOutcome | null = null;
  private store: Store | null = null;
  private session: InvitationSession | null = null;
  opened = false;
  accountLabel = '';
  context: InvitationContext | null = null;
  progress: api.homes.PersonalResidencyProgress | null = null;
  constructor(readonly token: string) {}
  get pending() { return this.snapshot ? structuredClone(this.snapshot.draft) : null; }
  get canAcknowledge() { return !!this.snapshot?.draft.outcome && this.snapshot.draft.outcome.state !== 'pending' && !this.busy; }
  get needsReload() { return this.attempted && !this.snapshot; }
  get canDecide() {
    const expiry = this.context?.preview.invitation.expires_at;
    return !!this.context && !this.snapshot && !this.attempted && this.current() && (expiry === null || !!expiry && Date.parse(expiry) > Date.now());
  }
  retire() { this.retired = true; this.context = null; this.progress = null; }
  current() {
    try { return !this.retired && !!this.auth && api.getAuthToken() === this.auth && api.getApiBaseUrl() === this.origin
      && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === this.marker; }
    catch { return false; }
  }
  private requireCurrent() { if (!this.current()) throw new Error('This page is out of date. Reload to check your answer.'); }
  async open(storeForActor: (actor: string) => Store = actor => new PendingInvitationStore(this.origin, actor)) {
    this.requireCurrent();
    const response = await api.apiClient.get<{ session: unknown }>('/api/homes/invitations/decisions/session'); this.requireCurrent();
    if (!validInvitationSession(response.data?.session)) throw new Error('Your signed-in session could not be checked.');
    this.session = response.data.session;
    const profile = await api.users.getMyProfile(); this.requireCurrent();
    if (!invitationUUID(profile?.id) || profile.id !== this.session.actor_id) throw new Error('Your account changed. Reload to continue.');
    this.accountLabel = profile.name || chosenUsername(profile.username) || profile.email || 'Your current account';
    this.store = storeForActor(this.session.actor_id);
    const saved = await this.store.load(); this.requireCurrent();
    this.snapshot = saved; this.attempted = !!saved; this.opened = true;
  }
  async refresh() {
    return this.action(async () => {
      this.context = null; this.progress = null;
      if (this.snapshot) throw new Error('Finish your earlier answer first.');
      if (!this.token || this.token.length > 512) throw new Error('Check the complete invitation link with the sender.');
      let body: unknown;
      try { body = (await api.apiClient.get(`/api/homes/invitations/token/${encodeURIComponent(this.token)}/decision-context`, { headers: this.headers() })).data; }
      catch (error) {
        this.requireCurrent();
        const code = (error as { code?: string })?.code;
        if (code === 'SESSION_SCOPE_CHANGED') { this.retire(); throw new Error('Your sign-in changed. Reload before answering.'); }
        throw new Error(code === 'INVITE_UNAVAILABLE' || transientFailure(error) ? 'Couldn’t check this invitation. Reload to try again.' : invitationDecisionMessage(code));
      }
      this.requireCurrent(); validateInvitationContext(body, this.session!); this.context = body;
    });
  }
  async decide(action: 'accept' | 'decline', expectedDecision: string) {
    return this.action(async () => {
      if (!this.canDecide || this.context?.decision_token !== expectedDecision || !this.store || !this.session) throw new Error('The invitation changed. Reopen it and review the current details first.');
      const c = this.context!, requestId = crypto.randomUUID();
      const input = { request_id: requestId, token: this.token, home_id: c.home_id, invitation_id: c.invitation_id, action, decision_token: c.decision_token };
      const draft: InvitationDraft = { version: 1, origin: this.origin, actor_id: this.session.actor_id, ...input,
        home_label: c.preview.home?.name || 'This Home', request_json: JSON.stringify(input) };
      this.attempted = true;
      this.snapshot = await this.store.save(draft, null, () => this.current()); this.requireCurrent();
      this.context = null; this.progress = null; await this.resolve('retry');
    });
  }
  async recover(action: 'status' | 'retry' | 'cancel', expectedRequestId?: string) {
    return this.action(async () => {
      if (expectedRequestId && this.snapshot?.draft.request_id !== expectedRequestId) throw new Error('Your answer changed. Reload to see the latest.');
      await this.resolve(action);
    });
  }
  private async resolve(action: 'status' | 'retry' | 'cancel') {
    const original = this.snapshot;
    if (!original || !this.store) throw new Error('Reload to check your answer.');
    const saved = await this.store.load(); this.requireCurrent();
    if (!saved || saved.revision !== original.revision || saved.draft.request_json !== original.draft.request_json) throw new Error('Another tab changed your answer. Reload to see the latest.');
    const known = this.observed || original.draft.outcome;
    if (known && known.state !== 'pending') {
      if (!original.draft.outcome || original.draft.outcome.state === 'pending') await this.saveOutcome(known, original);
      return;
    }
    const d = original.draft, base = '/api/homes/invitations/decisions';
    let body: unknown, status: number | undefined;
    try {
      const { request_id: _requestId, ...cancelBody } = JSON.parse(d.request_json);
      const response = await api.apiClient.request<unknown>({
        url: action === 'retry' ? base : `${base}/${d.request_id}${action === 'cancel' ? '/cancel' : ''}`,
        method: action === 'status' ? 'GET' : 'POST', data: action === 'retry' ? d.request_json : action === 'cancel' ? JSON.stringify(cancelBody) : undefined,
        headers: this.headers(),
      });
      body = response.data; status = response.status;
    } catch (error) {
      const failure = error as { statusCode?: number; data?: unknown; code?: string };
      body = failure?.data; status = failure?.statusCode;
      if (status === 401 || failure?.code === 'SESSION_SCOPE_CHANGED') this.retire();
    }
    this.requireCurrent();
    const session = (body as { session?: unknown } | null)?.session;
    if (!validInvitationSession(session) || session.actor_id !== this.session!.actor_id || session.session_scope !== this.session!.session_scope
      || !validInvitationOutcome(body, d)) throw new Error(UNKNOWN);
    const allowed = { completed: [200,201], pending: [202], cancelled: [200], rejected: [400,403,404,409,410,422] };
    if (!status || !allowed[body.state].includes(status)) throw new Error(UNKNOWN);
    const outcome = projectInvitationOutcome(body);
    if (outcome.state !== 'pending') this.observed = outcome;
    await this.saveOutcome(outcome, original);
  }
  private async saveOutcome(outcome: InvitationOutcome, original: InvitationSnapshot) {
    this.snapshot = await this.store!.save({ ...original.draft, outcome }, original, () => this.current()); this.requireCurrent();
  }
  async checkAccess() {
    return this.action(async () => {
      this.progress = null;
      const d = this.snapshot?.draft;
      if (d?.outcome?.state !== 'completed' || d.action !== 'accept') throw new Error('Recover your saved acceptance first.');
      // Fence the cookie-authenticated account both before and after the separate
      // Home read. A historical receipt never becomes a navigation permission.
      await this.checkSession();
      const result = await api.homes.getMyResidencyProgress(d.home_id); this.requireCurrent();
      await this.checkSession(); validateResidencyProgress(result, d.home_id); this.progress = result;
    });
  }
  private async checkSession() {
    const response = await api.apiClient.get<{ session: unknown }>('/api/homes/invitations/decisions/session'); this.requireCurrent();
    const s = response.data?.session;
    if (!validInvitationSession(s) || s.actor_id !== this.session!.actor_id || s.session_scope !== this.session!.session_scope) {
      this.retire(); throw new Error('Your sign-in changed. Reload to continue.');
    }
  }
  async acknowledge(expectedRequestId: string) {
    if (!this.canAcknowledge || this.snapshot?.draft.request_id !== expectedRequestId) throw new Error('Save the original result before continuing.');
    return this.action(async () => {
      const original = this.snapshot!;
      try { await this.store!.clear(original, () => this.current()); }
      catch (error) {
        this.requireCurrent();
        const remaining = await this.store!.load(); this.requireCurrent();
        if (remaining !== null) throw error;
      }
      this.requireCurrent(); this.snapshot = null; this.observed = null; this.attempted = false; this.context = null; this.progress = null;
      return structuredClone(original.draft);
    });
  }
  private headers() { return { 'X-Pantopus-Session-Scope': this.session!.session_scope, 'Cache-Control': 'no-cache, no-store', 'Content-Type': 'application/json' }; }
  private async action<T>(run: () => Promise<T>): Promise<T> {
    this.requireCurrent(); if (!this.opened || this.busy) throw new Error('Wait for the invitation check to finish.');
    this.busy = true; try { return await run(); } finally { this.busy = false; }
  }
}
