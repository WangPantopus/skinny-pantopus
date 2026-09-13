import * as api from '@pantopus/api';
import type { ResidencyReviewAction, ResidencyReviewRole, ResidencyReview } from '@pantopus/api';
import { PendingResidencyReviewStore, type ResidencyReviewSnapshot } from './PendingResidencyReviewStore';
import { UUID, validReview, validReceipt, canDecide, type PendingResidencyReview } from './residencyReviewModel';

/** Opening account/session, current ordinary authority and one original per Home. */
export class ResidencyReviewController {
  readonly origin = api.getApiBaseUrl();
  private readonly token = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private active = true;
  private busy = false;
  private scope: string | undefined;
  private store: PendingResidencyReviewStore | null = null;
  private saved: ResidencyReviewSnapshot | null = null;
  actorId = '';
  claimant: { name: string; username: string | null } | null = null;
  review: ResidencyReview | null = null;
  canDiscard = false;
  get pending(): PendingResidencyReview | null { return this.saved ? structuredClone(this.saved.draft) : null; }
  get canDecide() { return !!this.review && !this.saved && canDecide(this.review, this.actorId); }
  constructor(readonly homeId: string, readonly requestedClaim: string | null) {}
  retire() { this.active = false; this.review = null; this.claimant = null; }
  current = () => {
    if (!this.active || !this.token || api.getAuthToken() !== this.token || api.getApiBaseUrl() !== this.origin
      || localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) !== this.marker || document.visibilityState === 'hidden') {
      this.retire(); throw new Error('This review is no longer current. Reload to check access.');
    }
    return true;
  };
  async open() {
    this.current();
    if (!UUID.test(this.homeId) || (this.requestedClaim && !UUID.test(this.requestedClaim))) throw new Error('This claim link is invalid.');
    const profile = await api.users.getMyProfile(); this.current();
    if (!UUID.test(profile.id)) throw new Error('Your account could not be verified.');
    this.actorId = profile.id;
    this.store = new PendingResidencyReviewStore(this.origin, this.actorId, this.homeId);
    this.saved = await this.store.load(); this.current();
    const claim = this.saved?.draft.claim_id || this.requestedClaim;
    if (claim) await this.refresh(claim);
    return this;
  }
  private async refresh(claimId: string) {
    this.current();
    const review = await api.homes.getResidencyReview(this.homeId, claimId, this.scope);
    this.current();
    if (!validReview(review, this.homeId, claimId, this.actorId)
      || (this.scope && this.scope !== review.residency_session.session_scope)) {
      this.retire(); throw new Error('Current claim access could not be verified. Reload.');
    }
    this.scope = review.residency_session.session_scope; this.review = review;
    // Public identity is descriptive only; claim/authority always comes from
    // the exact Home review above. An unavailable profile keeps its reference.
    const profile = await api.users.getProfileById(review.claim.user_id).catch(() => null);
    this.current();
    this.claimant = profile?.id === review.claim.user_id ? {
      name: profile.name || profile.username || 'Applicant', username: profile.username || null,
    } : null;
  }
  private async requireSaved() {
    this.current(); const actual = await this.store!.load(); this.current();
    if (!this.saved || actual?.revision !== this.saved.revision || JSON.stringify(actual.draft) !== JSON.stringify(this.saved.draft)) {
      throw new Error('Another tab changed the saved decision. Reload to recover it.');
    }
  }
  private async operation(run: () => Promise<void>) {
    this.current(); if (this.busy) throw new Error('Wait for this decision to finish.');
    this.busy = true; try { await run(); } finally { this.busy = false; }
  }
  async submit(action: ResidencyReviewAction, role: ResidencyReviewRole, reason: string) {
    return this.operation(async () => {
      if (!this.canDecide || !this.review || !this.store || !this.review.claim.review_token) throw new Error('Reopen the current claim before deciding.');
      const draft: PendingResidencyReview = { version: 1, origin: this.origin, actor_id: this.actorId, home_id: this.homeId,
        claim_id: this.review.claim.id, command: { action, role: action === 'approve' ? role : null, reason: action === 'reject' ? reason.trim() : null, request_id: crypto.randomUUID(), review_token: this.review.claim.review_token } };
      this.saved = await this.store.save(draft, null, this.current);
      await this.dispatch();
    });
  }
  async retry() {
    return this.operation(async () => {
      if (!this.saved || this.saved.draft.confirmed) throw new Error('There is no unconfirmed decision to retry.');
      await this.dispatch();
    });
  }
  private async dispatch() {
    const original = this.saved!; this.canDiscard = false;
    try {
      // Read current authority; a terminal claim may still recover its receipt.
      await this.refresh(original.draft.claim_id);
      await this.requireSaved(); this.current();
      const result = await api.homes.decideResidencyReview(this.homeId, original.draft.claim_id, original.draft.command, this.scope!);
      this.current();
      if (!validReview(result, this.homeId, original.draft.claim_id, this.actorId)
        || result.residency_session.session_scope !== this.scope || result.claim_id !== original.draft.claim_id
        || result.target_id !== result.claim.user_id || result.action !== original.draft.command.action
        || typeof result.replayed !== 'boolean' || !validReceipt(result.receipt, original.draft)) {
        throw new Error('The decision was not confirmed. Retry the saved original.');
      }
      this.saved = await this.store!.save({ ...original.draft, confirmed: result.receipt }, original, this.current);
      this.current();
      await this.refresh(original.draft.claim_id);
    } catch (error) {
      this.current();
      const e = error as { statusCode?: number; code?: string; data?: { code?: string } };
      this.canDiscard = [403,409].includes(e.statusCode || 0) && ['RESIDENCY_REVIEW_CHANGED','CLAIM_NOT_PENDING',
        'OWNERSHIP_FLOW_REQUIRED','MEMBERSHIP_RENEWAL_REQUIRED','RESIDENCY_ROLE_FORBIDDEN',
        'PROPOSED_ROLE_FORBIDDEN','PERMISSION_DELEGATION_FORBIDDEN'].includes(e.data?.code || e.code || '');
      throw error;
    }
  }
  async acknowledge() {
    return this.operation(async () => {
      if (!this.saved || (!this.saved.draft.confirmed && !this.canDiscard)) throw new Error('Confirm the original result before clearing it.');
      await this.refresh(this.saved.draft.claim_id); await this.requireSaved();
      await this.store!.clear(this.saved, this.current); this.current();
      this.saved = null; this.canDiscard = false;
      if (this.requestedClaim) await this.refresh(this.requestedClaim);
      else { this.review = null; this.claimant = null; }
    });
  }
}
