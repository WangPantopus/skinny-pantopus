import * as api from '@pantopus/api';
import { HISTORY_BASE, historyUUID, historySession, validateHistoryPage, validateHistoryDetail, olderThan,
  type HistoryItem, type HistorySession } from './historyModel';

/** Read-only history. No local originals are changed and no decision is replayed. */
export class HistoryController {
  private readonly origin = api.getApiBaseUrl();
  private readonly token = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private retired = false;
  private busy = false;
  private session: HistorySession | null = null;
  items: HistoryItem[] = [];
  detail: HistoryItem | null = null;
  nextCursor: string | null = null;
  ready = false;
  constructor(readonly homeId: string, readonly receiptId: string | null = null) {}
  current() {
    try {
      return !this.retired && !!this.token && this.token === api.getAuthToken() && this.origin === api.getApiBaseUrl()
        && this.marker === localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) && document.visibilityState !== 'hidden';
    } catch { return false; }
  }
  private clear() { this.items = []; this.detail = null; this.nextCursor = null; this.ready = false; }
  retire() { this.retired = true; this.clear(); }
  private requireCurrent() { if (!this.current()) { this.retire(); throw new Error('History session retired.'); } }
  private async operation(action: () => Promise<void>) {
    this.requireCurrent();
    if (this.busy) return;
    this.busy = true;
    try { await action(); this.requireCurrent(); this.ready = true; }
    catch (error) { this.clear(); throw error; }
    finally { this.busy = false; }
  }
  async open() {
    return this.operation(async () => {
      this.clear();
      if (!historyUUID(this.homeId) || this.receiptId !== null && !historyUUID(this.receiptId)) throw new Error('Invalid history link.');
      const response = await api.apiClient.get<{ session: unknown }>(HISTORY_BASE + '/session');
      this.requireCurrent();
      if (response.status !== 200) throw new Error('History session unavailable.');
      this.session = historySession(response.data?.session);
      if (this.receiptId) {
        const value = await this.get(`/${this.homeId}/${this.receiptId}`);
        validateHistoryDetail(value, this.homeId, this.receiptId, this.session); this.detail = value.item;
      } else {
        const value = await this.get('/' + this.homeId);
        validateHistoryPage(value, this.homeId, this.session); this.items = value.items; this.nextCursor = value.next_cursor;
      }
    });
  }
  private async get(path: string, after?: string) {
    this.requireCurrent();
    const response = await api.apiClient.get<unknown>(HISTORY_BASE + path, {
      headers: { 'X-Pantopus-Session-Scope': this.session!.session_scope, 'Cache-Control': 'no-cache, no-store' },
      ...(after ? { params: { after } } : {}),
    });
    this.requireCurrent();
    if (response.status !== 200) throw new Error('History response unavailable.');
    return response.data;
  }
  async loadMore() {
    if (!this.ready || !this.nextCursor || this.receiptId) return;
    const cursor = this.nextCursor;
    return this.operation(async () => {
      const value = await this.get('/' + this.homeId, cursor);
      validateHistoryPage(value, this.homeId, this.session!);
      const previous = this.items.at(-1);
      if (previous && value.items[0] && !olderThan(value.items[0], previous)) throw new Error('History pages overlap.');
      const ids = new Set(this.items.map(item => item.decision.id));
      if (value.items.some(item => ids.has(item.decision.id)) || value.next_cursor === cursor) throw new Error('History pages overlap.');
      this.items = [...this.items, ...value.items]; this.nextCursor = value.next_cursor;
    });
  }
}
