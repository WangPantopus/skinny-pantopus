'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import QRCode from '@/components/ui/QRCode';
import { homeInviteDates } from '@/lib/homeInviteDates';
import { useSender } from './useSender';
import { deliveryMessage, senderMessage, type SenderInput, type SenderPayload, type SenderInvitation } from './senderModel';
const button='rounded-lg border border-app-border px-4 py-2 text-sm font-medium disabled:opacity-50';
const primary=button+' bg-slate-900 text-white';
const field='w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm';
const roles=[['tenant','Tenant / Roommate','member'],['spouse','Spouse / Partner (Co-admin)','admin'],['extended_family','Extended Family','member'],
  ['child','Child','restricted_member'],['airbnb_guest','Short Stay Guest','guest'],['cleaner_vendor','Cleaner / Vendor','guest']];
function recipient(i:SenderInvitation){
  if(i.invitee?.username) return i.invitee.name ? `${i.invitee.name} (@${i.invitee.username})` : `@${i.invitee.username}`;
  return i.invitee_email || i.invitee?.name || (i.invitee_user_id ? `Invited account unavailable (${i.invitee_user_id.slice(-8)})` : 'Anyone with the invitation link');
}
function invitationRole(i:SenderInvitation){
  const role=i.proposed_role_base??i.proposed_role;
  const label=({member:'Member',admin:'Administrator',manager:'Manager',guest:'Guest',restricted_member:'Restricted member',lease_resident:'Resident',owner:'Owner'} as Record<string,string>)[role||'']||role||'As recorded in the invitation';
  const preset=i.proposed_preset_key?.startsWith('access_request:')?'Household approval':roles.find(r=>r[0]===i.proposed_preset_key)?.[1];
  return preset?`${preset} (${label})`:label;
}
function terms(i:SenderInvitation){return <dl className="space-y-2 text-sm"><div><dt className="font-medium">Recipient</dt><dd className="break-words">{recipient(i)}</dd></div>
  <div><dt className="font-medium">Household role</dt><dd>{invitationRole(i)}</dd></div>
  {i.access_start_at&&<div><dt>Access starts</dt><dd>{new Date(i.access_start_at).toLocaleString()}</dd></div>}
  {i.access_end_at&&<div><dt>Access ends</dt><dd>{new Date(i.access_end_at).toLocaleString()}</dd></div>}
  {i.expires_at&&<div><dt>Invitation expires</dt><dd>{new Date(i.expires_at).toLocaleString()}</dd></div>}</dl>;}
export default function SenderInvitationManager({homeId,onAcknowledged}:{homeId:string;onAcknowledged?:()=>void}){
  const vm=useSender(homeId),[cancelConfirm,setCancelConfirm]=useState<string|null>(null),[now,setNow]=useState(()=>Date.now());
  const refresh=useRef(vm.refreshList);refresh.current=vm.refreshList;
  useEffect(()=>{
    const expiries=(vm.invitations||[]).map(i=>i.expires_at?Date.parse(i.expires_at):NaN).filter(value=>value>now);
    if(!expiries.length)return;
    const timer=setTimeout(()=>setNow(Date.now()),Math.min(2_147_483_647,Math.max(1,Math.min(...expiries)-Date.now()+1)));
    return()=>clearTimeout(timer);
  },[vm.invitations,now]);
  const draft=vm.pending,outcome=draft?.outcome,terminal=outcome&&outcome.state!=='pending';
  useEffect(()=>{setCancelConfirm(null);},[vm.lifetime,draft?.request_id]);
  useEffect(()=>{if(outcome?.state==='completed')refresh.current();},[outcome?.state,outcome?.command.request_id]);
  const label=draft?.action==='withdraw'?'Withdrawal saved':draft?.action==='resend'?'Resend saved':'Invitation saved';
  const url=vm.shareToken&&draft?.token===vm.shareToken?`${window.location.origin}/invite/${encodeURIComponent(vm.shareToken)}`:null;
  const acknowledge=async()=>{if(!draft)return;const saved=await vm.acknowledge(draft.request_id);if(saved){vm.refreshList();onAcknowledged?.();}};
  return <div className="space-y-6" data-testid="sender-invitation-manager">
    <div><h2 className="text-xl font-semibold">Household invitations</h2><p className="mt-1 text-sm text-app-text-secondary">An invitation offers household access. Residency and ownership use separate verification.</p>
      {vm.accountLabel&&<p className="mt-2 text-xs text-app-text-secondary">Signed in as {vm.accountLabel}</p>}</div>
    {vm.error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{vm.error}</p>}
    {vm.blocked?<button className={button} onClick={vm.reopen}>Reopen invitation recovery</button>:!vm.ready?<p role="status">Opening protected invitation recovery…</p>:draft?<section className="space-y-4 rounded-xl border border-app-border p-4" aria-label="Original invitation action">
      <h3 className="text-lg font-semibold">{terminal?outcome.state==='completed'?label:outcome.state==='cancelled'?'Attempt cancelled':'Invitation action needs review':'Recover your invitation action'}</h3>
      {draft.home_id!==homeId&&<p role="note" className="text-sm">This is an earlier action for a different Home. Recover and acknowledge it before starting another invitation.</p>}
      <p className="text-sm">Original action: {draft.action === 'create' ? 'Create invitation' : draft.action === 'resend' ? 'Resend invitation' : 'Withdraw invitation'}</p>
      {draft.action==='create'?<PayloadSummary payload={draft.payload}/>:draft.reviewed_invitation&&terms(draft.reviewed_invitation)}
      {outcome?.state==='completed'?<><p role="status" className="text-sm">{deliveryMessage(outcome)}</p>
        {url&&<div className="space-y-3"><a href={url} className="block break-all text-sm text-blue-600">{url}</a><QRCode value={url} size={160} label="Household invitation QR code"/></div>}
        {draft.action!=='withdraw'&&!url&&<div className="space-y-2"><p className="text-sm text-app-text-secondary">The saved result is retained. Check that the invitation is still available before sharing its link.</p><button className={button} disabled={vm.busy} onClick={()=>void vm.checkShare(draft.request_id)}>Check link for sharing</button></div>}</>
        :outcome?.state==='cancelled'?<p className="text-sm">This attempt was cancelled before it was applied. No invitation was withdrawn by cancelling the attempt.</p>
        :outcome?.state==='rejected'?<p className="text-sm">{senderMessage(outcome.code)}</p>
        :<p className="text-sm">Keep this original until its saved result or cancellation is confirmed. Retrying uses the same request.</p>}
      {vm.canAcknowledge?<button className={primary} disabled={vm.busy} onClick={()=>void acknowledge()}>Done</button>:<div className="flex flex-wrap gap-2">
        <button className={button} disabled={vm.busy} onClick={()=>void vm.recover('status',draft.request_id)}>Check saved result</button>
        <button className={primary} disabled={vm.busy} onClick={()=>void vm.recover('retry',draft.request_id)}>Retry original action</button>
        <button className={button} disabled={vm.busy} onClick={()=>setCancelConfirm(draft.request_id)}>Cancel this attempt</button></div>}
      {cancelConfirm===draft.request_id&&!terminal&&<div role="alertdialog" aria-modal="true" aria-label="Cancel original invitation attempt" className="space-y-3 rounded-lg border border-app-border p-3">
        <p className="text-sm">Cancel only if this original action has not already committed. A saved action wins; existing membership remains unchanged.</p>
        <button className={button} disabled={vm.busy} onClick={()=>setCancelConfirm(null)}>Keep original</button>{' '}
        <button className={primary} disabled={vm.busy} onClick={()=>{setCancelConfirm(null);void vm.recover('cancel',draft.request_id);}}>Confirm cancellation</button></div>}
    </section>:vm.context&&vm.review?<section role="alertdialog" aria-modal="true" aria-label="Review invitation action" className="space-y-4 rounded-xl border border-app-border p-4">
      <h3 className="text-lg font-semibold">{vm.review.action==='create'?'Review new invitation':vm.review.action==='resend'?'Review resend':'Review withdrawal'}</h3>
      {vm.review.action==='create'?<PayloadSummary payload={vm.review.payload}/>:vm.context.invitation&&terms(vm.context.invitation)}
      <p className="text-sm">{vm.review.action==='withdraw'?'Withdraw this pending invitation. Existing household membership is preserved.':vm.review.action==='resend'?'Request another delivery attempt. Earlier links and the original access dates remain unchanged.':'Save this invitation and request available delivery. Delivery may remain unconfirmed.'}</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={vm.busy} onClick={vm.cancelReview}>Back to invitations</button>
        <button className={primary} disabled={vm.busy} onClick={()=>void vm.submit(vm.context!.decision_token)}>{vm.busy?'Saving…':vm.review.action==='create'?'Confirm invitation':vm.review.action==='resend'?'Confirm resend':'Confirm withdrawal'}</button></div>
    </section>:<CreateInvitationForm key={vm.lifetime} homeId={homeId} disabled={vm.busy} prepare={vm.prepare}/>}
    {vm.ready&&!vm.blocked&&<section aria-label="Current invitations" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Current invitations</h3><button className={button} disabled={vm.busy} onClick={vm.refreshList}>Refresh invitations</button></div>
      {vm.listError?<p role="alert" className="text-sm text-amber-800">{vm.listError}</p>:vm.invitations===null?<p role="status" className="text-sm">Checking current invitations…</p>:vm.invitations.length===0?<p className="text-sm text-app-text-secondary">No pending invitations.</p>:<ul className="space-y-3">{vm.invitations.map(i=><li key={i.id} data-invitation-id={i.id} className="space-y-3 rounded-lg border border-app-border p-3">
        {terms(i)}<p className="text-xs text-app-text-secondary">Status: {i.expires_at&&Date.parse(i.expires_at)<=now?'Expired invitation':i.status}</p><div className="flex flex-wrap gap-2">
          <button className={button} disabled={vm.busy||!!draft||!!vm.context||i.status!=='pending'||!!i.expires_at&&Date.parse(i.expires_at)<=now} onClick={()=>void vm.prepare({home_id:homeId,action:'resend',invitation_id:i.id})}>Resend invitation</button>
          <button className={button} disabled={vm.busy||!!draft||!!vm.context||i.status!=='pending'} onClick={()=>void vm.prepare({home_id:homeId,action:'withdraw',invitation_id:i.id})}>Withdraw invitation</button></div></li>)}</ul>}
    </section>}
    <p className="text-xs text-app-text-secondary">Closing keeps any original action for recovery. <Link href={`/app/homes/${homeId}/invitations`} className="underline">Open invitation recovery</Link></p>
  </div>;
}
function PayloadSummary({payload:p}:{payload:SenderPayload}){return <dl className="space-y-2 text-sm"><div><dt className="font-medium">Recipient</dt><dd className="break-words">{p.email|| (p.username?'@'+p.username:p.user_id?'Selected Pantopus account':'Anyone with the invitation link')}</dd></div>
  <div><dt className="font-medium">Household role</dt><dd>{roles.find(r=>r[0]===p.preset_key)?.[1]||p.relationship||'Member'}</dd></div>
  {p.start_at&&<div><dt>Access starts</dt><dd>{new Date(p.start_at).toLocaleString()}</dd></div>}{p.end_at&&<div><dt>Access ends</dt><dd>{new Date(p.end_at).toLocaleString()}</dd></div>}
  {p.message&&<div><dt>Message</dt><dd className="whitespace-pre-wrap break-words">{p.message}</dd></div>}</dl>;}
function CreateInvitationForm({homeId,disabled,prepare}:{homeId:string;disabled:boolean;prepare:(input:SenderInput)=>Promise<unknown>}){
  const [mode,setMode]=useState('email'),[email,setEmail]=useState(''),[query,setQuery]=useState(''),[selected,setSelected]=useState<{id:string;username:string}|null>(null);
  const [results,setResults]=useState<{id:string;username:string;name?:string}[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState('');
  const [preset,setPreset]=useState('tenant'),[start,setStart]=useState(''),[end,setEnd]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{let current=true;setResults([]);setSearchError('');if(mode!=='username'||query.trim().length<2||selected){setSearching(false);return;}
    setSearching(true);const timer=setTimeout(async()=>{try{const res=await api.get<{users:{id:string;username:string;name?:string}[]}>(`/api/users/search?q=${encodeURIComponent(query.trim())}&limit=5`);
      if(!Array.isArray(res.users)||res.users.some(u=>!u.id||!u.username))throw new Error();if(current)setResults(res.users);
    }catch{if(current)setSearchError('User search is unavailable. Change the search to retry.');}finally{if(current)setSearching(false);}},350);
    return()=>{current=false;clearTimeout(timer);};},[mode,query,selected]);
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');try{if(mode==='username'&&!selected)throw new Error('Search and select a recipient first.');
    if(mode==='email'&&!email.trim().includes('@'))throw new Error('Enter a valid email address.');const role=roles.find(r=>r[0]===preset)!;
    await prepare({home_id:homeId,action:'create',payload:{...(mode==='email'?{email:email.trim()}:mode==='username'?{user_id:selected!.id,username:selected!.username}:{}),
      relationship:role[2],preset_key:preset,...homeInviteDates(start,end),...(message.trim()?{message:message.trim()}: {})}});
  }catch(e){setError(e instanceof Error?e.message:'Review the invitation details.');}};
  return <form onSubmit={e=>void submit(e)} className="space-y-4" aria-label="Create household invitation"><h3 className="font-semibold">New invitation</h3>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={disabled} className="space-y-4"><legend className="sr-only">Invitation details</legend>
      <label className="block space-y-1 text-sm"><span>Invite by</span><select value={mode} onChange={e=>{setMode(e.target.value);setEmail('');setQuery('');setSelected(null);}} className={field}>
        <option value="email">Email</option><option value="username">Username</option><option value="link">Shareable link / QR code</option></select></label>
      {mode==='email'?<label className="block space-y-1 text-sm"><span>Email address</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className={field} autoComplete="off"/></label>
        :mode==='username'?<div className="space-y-2"><label className="block space-y-1 text-sm"><span>Search by username</span><input value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}} className={field} autoComplete="off"/></label>
          {searching&&<p role="status" className="text-sm">Searching…</p>}{searchError&&<p role="alert" className="text-sm text-red-700">{searchError}</p>}
          {selected?<p className="text-sm">Selected @{selected.username}</p>:results.map(u=><button type="button" key={u.id} className={button+' block w-full text-left'} onClick={()=>{setSelected(u);setQuery(u.username);}}>{u.name||u.username} (@{u.username})</button>)}
          {!selected&&!searching&&!searchError&&query.trim().length>=2&&results.length===0&&<p className="text-sm">No users found.</p>}</div>:<p className="text-sm">Anyone with this link can accept its household invitation. Share it only with the intended recipient.</p>}
      <label className="block space-y-1 text-sm"><span>Role in household</span><select value={preset} onChange={e=>setPreset(e.target.value)} className={field}>{roles.map(r=><option key={r[0]} value={r[0]}>{r[1]}</option>)}</select></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Start date (optional)</span><input type="date" value={start} onChange={e=>setStart(e.target.value)} className={field}/></label>
        <label className="space-y-1 text-sm"><span>End date (inclusive, optional)</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)} className={field}/></label></div>
      <p className="text-xs text-app-text-secondary">Dates use this device&apos;s time zone.</p>
      <label className="block space-y-1 text-sm"><span>Message (optional)</span><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={300} rows={2} className={field}/></label>
      <button type="submit" className={primary} disabled={disabled||mode==='username'&&!selected}>{disabled?'Checking…':'Review invitation'}</button>
    </fieldset></form>;
}
