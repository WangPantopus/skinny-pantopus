import * as api from '@pantopus/api';
import { PendingSenderStore, type SenderSnapshot } from './PendingSenderStore';
import { validInvitationSession, validSenderInput, validateSenderContext, validSenderOutcome, projectSenderOutcome, senderMessage,
  type SenderInput, type SenderSession, type SenderContext, type SenderDraft, type SenderOutcome } from './senderModel';
type Store = Pick<PendingSenderStore, 'load' | 'save' | 'clear'>;
const base = '/api/homes/invitations/sender';
const UNKNOWN = 'The result is not confirmed. Your original invitation action is kept. Check its result, retry that same action, or cancel the attempt.';
export class SenderController {
  readonly origin = api.getApiBaseUrl();
  private readonly auth = api.getAuthToken();
  private readonly marker = localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY);
  private retired = false;
  private busy = false;
  private attempted = false;
  private snapshot: SenderSnapshot | null = null;
  private observed: SenderOutcome | null = null;
  private store: Store | null = null;
  private session: SenderSession | null = null;
  private reviewed: SenderInput | null = null;
  private sharedRequest: string | null = null;
  private shareRevision = 0;
  shareUntil: number | null = null;
  opened = false;
  accountLabel = '';
  context: SenderContext | null = null;
  matchesSession(session: SenderSession) { return session.actor_id === this.session?.actor_id && session.session_scope === this.session?.session_scope; }
  get pending() { return this.snapshot ? structuredClone(this.snapshot.draft) : null; }
  get shareToken() { return this.current() && !!this.shareUntil && Date.now() < this.shareUntil && this.sharedRequest === this.snapshot?.draft.request_id ? this.snapshot.draft.token : null; }
  clearShare() { this.shareRevision++; this.sharedRequest = null; this.shareUntil = null; }
  get review() { return this.reviewed ? structuredClone(this.reviewed) : null; }
  get canAcknowledge() { return !!this.snapshot?.draft.outcome && this.snapshot.draft.outcome.state !== 'pending' && !this.busy; }
  get needsReload() { return this.attempted && !this.snapshot; }
  retire() { this.retired = true; this.clearShare(); this.context = null; this.reviewed = null; }
  current() {
    try { return !this.retired && !!this.auth && api.getAuthToken() === this.auth && api.getApiBaseUrl() === this.origin
      && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === this.marker && document.visibilityState !== 'hidden'; }
    catch { return false; }
  }
  private requireCurrent() { if (!this.current()) throw new Error('This invitation page is no longer current. Reopen recovery to check your saved action.'); }
  async open(storeForActor: (actor: string) => Store = actor => new PendingSenderStore(this.origin,actor)) {
    this.requireCurrent();
    const response = await api.apiClient.get<{session:unknown}>(base+'/session'); this.requireCurrent();
    if (!validInvitationSession(response.data?.session)) throw new Error('Your signed-in session could not be checked.');
    this.session = response.data.session;
    let profile: Awaited<ReturnType<typeof api.users.getMyProfile>> | null = null;
    try { profile = await api.users.getMyProfile(); }
    catch (error) { if ((error as {statusCode?:number})?.statusCode === 401) this.retire(); }
    this.requireCurrent();
    if (profile && profile.id !== this.session.actor_id) throw new Error('Your account changed. Reopen invitation recovery.');
    this.accountLabel = profile?.name || profile?.username || profile?.email || 'Your current account';
    this.store = storeForActor(this.session.actor_id);
    const saved = await this.store.load(); this.requireCurrent();
    this.snapshot = saved; this.attempted = !!saved; this.opened = true;
  }
  async prepare(input: SenderInput) {
    return this.action(async () => {
      this.context = null; this.reviewed = null;
      if (this.snapshot || this.attempted) throw new Error('Recover and acknowledge your earlier invitation action first.');
      await this.checkSession();
      const original: SenderInput = JSON.parse(JSON.stringify(input));
      if (!validSenderInput(original)) throw new Error('Review the invitation details before continuing.');
      let body: unknown;
      try { body = (await api.apiClient.post(base+'/context',original,{headers:this.headers()})).data; }
      catch(error) {
        this.requireCurrent(); const code = (error as {code?:string})?.code;
        if (code === 'SESSION_SCOPE_CHANGED') { this.retire(); throw new Error('Your session changed. Reopen recovery before deciding.'); }
        throw new Error(senderMessage(code));
      }
      this.requireCurrent(); validateSenderContext(body,original,this.session!);
      this.context = body; this.reviewed = original;
    });
  }
  cancelReview() { this.requireCurrent(); if (this.busy) return; this.context = null; this.reviewed = null; }
  async submit(expectedDecision: string) {
    return this.action(async () => {
      if (!this.context || !this.reviewed || this.context.decision_token !== expectedDecision || this.snapshot || this.attempted || !this.store || !this.session)
        throw new Error('Review the current invitation details before confirming.');
      await this.checkSession();
      const token = this.reviewed.action === 'withdraw' ? null : Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
      const input = { request_id:crypto.randomUUID(),token,...this.reviewed,decision_token:this.context.decision_token };
      const draft: SenderDraft = {version:1,origin:this.origin,actor_id:this.session.actor_id,...input,
        reviewed_invitation: this.context.invitation,request_json:JSON.stringify(input)};
      this.attempted = true;
      this.snapshot = await this.store.save(draft,null,()=>this.current()); this.requireCurrent();
      this.context = null; this.reviewed = null; await this.resolve('retry');
    });
  }
  async recover(action:'status'|'retry'|'cancel',expectedRequestId?:string) {
    return this.action(async()=>{
      if (expectedRequestId && this.snapshot?.draft.request_id !== expectedRequestId) throw new Error('The original action changed. Reopen recovery.');
      await this.resolve(action);
    });
  }
  private async resolve(action:'status'|'retry'|'cancel') {
    const original = this.snapshot;
    if (!original || !this.store) throw new Error('Reopen recovery to check the original invitation action.');
    const saved = await this.store.load(); this.requireCurrent();
    if (!saved || saved.revision !== original.revision || saved.draft.request_json !== original.draft.request_json) throw new Error('Another tab changed the saved action. Reopen recovery.');
    const known = this.observed || original.draft.outcome;
    if (known && known.state !== 'pending') {
      if (!original.draft.outcome || original.draft.outcome.state === 'pending') await this.saveOutcome(known,original);
      return;
    }
    await this.checkSession();
    const d=original.draft; let body:unknown,status:number|undefined;
    try {
      const {request_id:_requestId,...cancelBody}=JSON.parse(d.request_json);
      const response=await api.apiClient.request<unknown>({url:action === 'retry' ? base+'/commands' : `${base}/commands/${d.request_id}${action==='cancel'?'/cancel':''}`,
        method:action==='status'?'GET':'POST',data:action==='retry'?d.request_json:action==='cancel'?JSON.stringify(cancelBody):undefined,headers:this.headers()});
      body=response.data;status=response.status;
    }catch(error){const f=error as {statusCode?:number;data?:unknown;code?:string};body=f?.data;status=f?.statusCode;
      if(status===401||f?.code==='SESSION_SCOPE_CHANGED')this.retire();}
    this.requireCurrent();
    const session=(body as {session?:unknown}|null)?.session;
    if(!validInvitationSession(session)||session.actor_id!==this.session!.actor_id||session.session_scope!==this.session!.session_scope||!validSenderOutcome(body,d))throw new Error(UNKNOWN);
    const allowed={completed:[200,201],pending:[202],cancelled:[200],rejected:[400,403,404,409,410,422]};
    if(!status||!allowed[body.state].includes(status))throw new Error(UNKNOWN);
    const outcome=projectSenderOutcome(body);if(outcome.state!=='pending')this.observed=outcome;
    await this.saveOutcome(outcome,original);
  }
  private async saveOutcome(outcome:SenderOutcome,original:SenderSnapshot){this.snapshot=await this.store!.save({...original.draft,outcome},original,()=>this.current());this.requireCurrent();}
  private async checkSession(){
    const response=await api.apiClient.get<{session:unknown}>(base+'/session');this.requireCurrent();const s=response.data?.session;
    if(!validInvitationSession(s)||s.actor_id!==this.session!.actor_id||s.session_scope!==this.session!.session_scope){this.retire();throw new Error('Your session changed. Reopen invitation recovery.');}
  }
  async checkShare(expectedRequestId: string) {
    return this.action(async () => {
      this.clearShare(); const sharingRevision = this.shareRevision;
      const original = this.snapshot;
      if (!original || original.draft.request_id !== expectedRequestId || original.draft.outcome?.state !== 'completed'
        || original.draft.action === 'withdraw' || !original.draft.outcome.invitation_id) throw new Error('Recover the saved invitation first.');
      const retained = await this.store!.load(); this.requireCurrent();
      if (retained?.revision !== original.revision) throw new Error('Another tab changed the original action. Reopen recovery.');
      await this.checkSession();
      const input: SenderInput = {home_id:original.draft.home_id,invitation_id:original.draft.outcome.invitation_id,action:'resend'};
      let response: unknown;
      try { response = (await api.apiClient.post(base+'/context',input,{headers:this.headers()})).data; }
      catch { this.requireCurrent(); throw new Error('This invitation link could not be confirmed for sharing. Check current household authority, invitation status and delivery options.'); }
      this.requireCurrent(); validateSenderContext(response,input,this.session!);
      await this.checkSession();
      const latest = await this.store!.load(); this.requireCurrent();
      if (latest?.revision !== original.revision) throw new Error('Another tab changed the original action. Reopen recovery.');
      if (sharingRevision !== this.shareRevision) throw new Error('A newer refresh retired this sharing check. Check the link again.');
      const expires = response.invitation?.expires_at;
      this.shareUntil = Math.min(Date.now() + 60_000, expires ? Date.parse(expires) : Infinity);
      this.sharedRequest = expectedRequestId;
    });
  }
  async acknowledge(expectedRequestId:string){
    if(!this.canAcknowledge||this.snapshot?.draft.request_id!==expectedRequestId)throw new Error('Save the original result before continuing.');
    return this.action(async()=>{
      const original=this.snapshot!;
      try{await this.store!.clear(original,()=>this.current());}catch(error){this.requireCurrent();const remaining=await this.store!.load();this.requireCurrent();if(remaining!==null)throw error;}
      this.requireCurrent();this.snapshot=null;this.observed=null;this.clearShare();this.attempted=false;this.context=null;this.reviewed=null;return structuredClone(original.draft);
    });
  }
  private headers(){return {'X-Pantopus-Session-Scope':this.session!.session_scope,'Cache-Control':'no-cache, no-store','Content-Type':'application/json'};}
  private async action<T>(run:()=>Promise<T>):Promise<T>{this.requireCurrent();if(!this.opened||this.busy)throw new Error('Wait for invitation recovery to finish.');this.busy=true;try{return await run();}finally{this.busy=false;}}
}
