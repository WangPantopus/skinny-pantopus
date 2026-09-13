import * as api from '@pantopus/api';
import { QUEUE_SESSION_PATH, queueUUID, queueSession, validateQueue, type QueueClaim } from './queueModel';

/** Ephemeral current queue. No command, receipt, persistent cache or original store. */
export class QueueController {
  private readonly origin = api.getApiBaseUrl();
  private readonly token = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private retired = false;
  claims: QueueClaim[] = [];
  ready = false;
  constructor(readonly homeId: string) {}
  current(): boolean {
    try {
      return !this.retired && !!this.token && this.token === api.getAuthToken() && this.origin === api.getApiBaseUrl()
        && this.marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) && document.visibilityState !== 'hidden';
    } catch { return false; }
  }
  retire() { this.retired = true; this.claims = []; this.ready = false; }
  private requireCurrent() { if (!this.current()) { this.retire(); throw new Error('Current queue session retired.'); } }
  async open() {
    this.claims = []; this.ready = false;
    try {
      this.requireCurrent(); if (!queueUUID(this.homeId)) throw new Error('Invalid Home reference.');
      const bootstrap = await api.apiClient.get<unknown>(QUEUE_SESSION_PATH, { headers: { 'Cache-Control': 'no-cache, no-store' } });
      this.requireCurrent(); if (bootstrap.status !== 200) throw new Error('Current queue session unavailable.');
      const session = queueSession(bootstrap.data);
      const response = await api.apiClient.get<unknown>(`/api/homes/${this.homeId}/claims`, {
        headers: { 'X-Pantopus-Session-Scope': session.session_scope, 'Cache-Control': 'no-cache, no-store' },
      });
      this.requireCurrent(); if (response.status !== 200) throw new Error('Current queue unavailable.');
      validateQueue(response.data, this.homeId, session);
      this.claims = response.data.claims; this.ready = true;
    } catch (error) { this.claims = []; this.ready = false; throw error; }
  }
}
