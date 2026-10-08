'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import QRCode from '@/components/ui/QRCode';
import { homeInviteDates } from '@/lib/homeInviteDates';
import { useSender } from './useSender';
import { deliveryMessage, senderMessage, type SenderInput, type SenderPayload, type SenderInvitation } from './senderModel';
import { chosenUsername } from '@pantopus/utils';
const button='rounded-lg border border-app-border px-4 py-2 text-sm font-medium disabled:opacity-50';
const primary=button+' bg-slate-900 text-white';
const field='w-full rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm';
const roles=[['tenant','Tenant / Roommate','member'],['spouse','Spouse / Partner (Co-admin)','admin'],['extended_family','Extended Family','member'],
  ['child','Child','restricted_member'],['airbnb_guest','Short Stay Guest','guest'],['cleaner_vendor','Cleaner / Vendor','guest']];
function recipient(i:SenderInvitation){
  // A made-up username (user_…) is never shown: the name alone, or the email.
  const handle=chosenUsername(i.invitee?.username);
  if(handle) return i.invitee?.name ? `${i.invitee.name} (@${handle})` : `@${handle}`;
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
// On its own page this heading is the page's h1; inside the dashboard's panel it stays an h2.
export default function SenderInvitationManager({homeId,onAcknowledged,headingLevel=2}:{homeId:string;onAcknowledged?:()=>void;headingLevel?:1|2}){
  const Heading=headingLevel===1?'h1':'h2';
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
  const label=draft?.action==='withdraw'?'Invitation withdrawn':draft?.action==='resend'?'Resend requested':'Invitation created';
  const url=vm.shareToken&&draft?.token===vm.shareToken?`${window.location.origin}/invite/${encodeURIComponent(vm.shareToken)}`:null;
  const acknowledge=async()=>{if(!draft)return;const saved=await vm.acknowledge(draft.request_id);if(saved){vm.refreshList();onAcknowledged?.();}};
  return <div className="space-y-6" data-testid="sender-invitation-manager">
    <div><Heading className="text-xl font-semibold">Household invitations</Heading><p className="mt-1 text-sm text-app-text-secondary">An invitation gives someone household access for the role you choose. It doesn’t verify that they live here or own the Home.</p>
      {vm.accountLabel&&<p className="mt-2 text-xs text-app-text-secondary">Signed in as {vm.accountLabel}</p>}</div>
    {vm.error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{vm.error}</p>}
    {vm.blocked?<button className={button} onClick={vm.reopen}>Reload</button>:!vm.ready?<p role="status">Loading invitations…</p>:draft?<section className="space-y-4 rounded-xl border border-app-border p-4" aria-label="Your last invitation">
      <h3 className="text-lg font-semibold">{terminal?outcome.state==='completed'?label:outcome.state==='cancelled'?'Attempt discarded':'Couldn’t finish this':'Check your last invitation'}</h3>
      {draft.home_id!==homeId&&<p role="note" className="text-sm">This is for another of your Homes. Finish it before inviting someone here.</p>}
      <p className="text-sm">Action: {draft.action === 'create' ? linkOnly(draft.payload) ? 'Create invitation link' : 'Send invitation' : draft.action === 'resend' ? 'Resend invitation' : 'Withdraw invitation'}</p>
      {draft.action==='create'?<PayloadSummary payload={draft.payload}/>:draft.reviewed_invitation&&terms(draft.reviewed_invitation)}
      {outcome?.state==='completed'?<><p role="status" className="text-sm">{deliveryMessage(outcome)}</p>
        {url&&<div className="space-y-3"><a href={url} className="block break-all text-sm text-blue-600">{url}</a><QRCode value={url} size={160} label="Household invitation QR code"/></div>}
        {draft.action!=='withdraw'&&!url&&<div className="space-y-2"><p className="text-sm text-app-text-secondary">{draft.action==='create'&&linkOnly(draft.payload)?'Get the link to share with the person you’re inviting.':'Want to send it yourself? Get a link to share.'}</p><button className={button} disabled={vm.busy} onClick={()=>void vm.checkShare(draft.request_id)}>Get invitation link</button></div>}</>
        :outcome?.state==='cancelled'?<p className="text-sm">Nothing changed. This attempt was discarded before it took effect.</p>
        :outcome?.state==='rejected'?<p className="text-sm">{senderMessage(outcome.code)}</p>
        :<p className="text-sm">We couldn’t confirm whether this went through. Check again, or try again. Trying again won’t send a second email.</p>}
      {vm.canAcknowledge?<button className={primary} disabled={vm.busy} onClick={()=>void acknowledge()}>Done</button>:<div className="flex flex-wrap gap-2">
        <button className={button} disabled={vm.busy} onClick={()=>void vm.recover('status',draft.request_id)}>Check again</button>
        <button className={primary} disabled={vm.busy} onClick={()=>void vm.recover('retry',draft.request_id)}>Try again</button>
        <button className={button} disabled={vm.busy} onClick={()=>setCancelConfirm(draft.request_id)}>Discard attempt</button></div>}
      {cancelConfirm===draft.request_id&&!terminal&&<div role="alertdialog" aria-modal="true" aria-label="Discard this attempt" className="space-y-3 rounded-lg border border-app-border p-3">
        <p className="text-sm">If it already went through, it stays. Discarding doesn’t withdraw an invitation or remove anyone.</p>
        <button className={button} disabled={vm.busy} onClick={()=>setCancelConfirm(null)}>Keep it</button>{' '}
        <button className={primary} disabled={vm.busy} onClick={()=>{setCancelConfirm(null);void vm.recover('cancel',draft.request_id);}}>Discard</button></div>}
    </section>:vm.context&&vm.review?<section role="alertdialog" aria-modal="true" aria-label="Review invitation action" className="space-y-4 rounded-xl border border-app-border p-4">
      <h3 className="text-lg font-semibold">{vm.review.action==='create'?'Review new invitation':vm.review.action==='resend'?'Review resend':'Review withdrawal'}</h3>
      {vm.review.action==='create'?<PayloadSummary payload={vm.review.payload}/>:vm.context.invitation&&terms(vm.context.invitation)}
      <p className="text-sm">{reviewMessage(vm.review)}</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={vm.busy} onClick={vm.cancelReview}>Back to invitations</button>
        <button className={primary} disabled={vm.busy} onClick={()=>void vm.submit(vm.context!.decision_token)}>{vm.busy?'Saving…':vm.review.action==='create'?linkOnly(vm.review.payload)?'Create link':'Send invitation':vm.review.action==='resend'?'Confirm resend':'Confirm withdrawal'}</button></div>
    </section>:vm.listDenied?<p className="text-sm text-app-text-secondary">{vm.listError}</p>
      :<CreateInvitationForm key={vm.lifetime} homeId={homeId} disabled={vm.busy} prepare={vm.prepare}/>}
    {vm.ready&&!vm.blocked&&!vm.listDenied&&<section aria-label="Current invitations" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Current invitations</h3><button className={button} disabled={vm.busy} onClick={vm.refreshList}>Refresh invitations</button></div>
      {vm.listError?<p role="alert" className="text-sm text-amber-800">{vm.listError}</p>:vm.invitations===null?<p role="status" className="text-sm">Loading invitations…</p>:vm.invitations.length===0?<p className="text-sm text-app-text-secondary">No pending invitations.</p>:<ul className="space-y-3">{vm.invitations.map(i=><li key={i.id} data-invitation-id={i.id} className="space-y-3 rounded-lg border border-app-border p-3">
        {terms(i)}<p className="text-xs text-app-text-secondary">Status: {i.expires_at&&Date.parse(i.expires_at)<=now?'Expired':i.status==='pending'?'Waiting for a reply':i.status}</p><div className="flex flex-wrap gap-2">
          <button className={button} disabled={vm.busy||!!draft||!!vm.context||i.status!=='pending'||!!i.expires_at&&Date.parse(i.expires_at)<=now} onClick={()=>void vm.prepare({home_id:homeId,action:'resend',invitation_id:i.id})}>Resend invitation</button>
          <button className={button} disabled={vm.busy||!!draft||!!vm.context||i.status!=='pending'} onClick={()=>void vm.prepare({home_id:homeId,action:'withdraw',invitation_id:i.id})}>Withdraw invitation</button></div></li>)}</ul>}
    </section>}
    <p className="text-xs text-app-text-secondary">If you close this before an invitation finishes, you can check it later in <Link href={`/app/homes/${homeId}/invitations`} className="underline">Household invitations</Link>.</p>
  </div>;
}
/** A link-only invitation names no recipient: nothing is sent, the sender shares the link. */
function linkOnly(p:SenderPayload){return !p.email&&!p.username&&!p.user_id;}
function reviewMessage(review:{action:string;payload?:SenderPayload}){
  if(review.action==='withdraw')return 'They won’t be able to accept it anymore. Anyone already in the household stays.';
  if(review.action==='resend')return 'We’ll send the same invitation again. Links already sent keep working, and the expiry date doesn’t change.';
  const p=review.payload;
  if(!p||linkOnly(p))return 'You’ll get a link to share. Anyone with the link can accept it, so share it only with the person you’re inviting.';
  return p.email?'We’ll email them the invitation. They join the household only if they accept.'
    :'We’ll send it to their Pantopus notifications. They join the household only if they accept.';
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
  // Search only finds people with a neighbor profile, so an exact username can be invited too (the server resolves it, as in the apps).
  const typedUsername=query.trim().replace(/^@/,'');const exactUsername=/^[A-Za-z0-9_.-]{2,64}$/.test(typedUsername)?typedUsername:'';
  const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');try{if(mode==='username'&&!selected&&!exactUsername)throw new Error('Type their exact username, or pick them from the list.');
    if(mode==='email'&&!email.trim().includes('@'))throw new Error('Enter a valid email address.');const role=roles.find(r=>r[0]===preset)!;
    await prepare({home_id:homeId,action:'create',payload:{...(mode==='email'?{email:email.trim()}:mode==='username'?(selected?{user_id:selected.id,username:selected.username}:{username:exactUsername}):{}),
      relationship:role[2],preset_key:preset,...homeInviteDates(start,end),...(message.trim()?{message:message.trim()}: {})}});
  }catch(e){setError(e instanceof Error?e.message:'Review the invitation details.');}};
  return <form onSubmit={e=>void submit(e)} className="space-y-4" aria-label="Create household invitation"><h3 className="font-semibold">New invitation</h3>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    <fieldset disabled={disabled} className="space-y-4"><legend className="sr-only">Invitation details</legend>
      <label className="block space-y-1 text-sm"><span>Invite by</span><select value={mode} onChange={e=>{setMode(e.target.value);setEmail('');setQuery('');setSelected(null);}} className={field}>
        <option value="email">Email</option><option value="username">Username</option><option value="link">Shareable link / QR code</option></select></label>
      {mode==='email'?<label className="block space-y-1 text-sm"><span>Email address</span><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className={field} autoComplete="off"/></label>
        :mode==='username'?<div className="space-y-2"><label className="block space-y-1 text-sm"><span>Username</span><input value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}} className={field} autoComplete="off"/></label>
          {searching&&<p role="status" className="text-sm">Searching…</p>}{searchError&&<p role="alert" className="text-sm text-red-700">{searchError}</p>}
          {selected?<p className="text-sm">Selected @{selected.username}</p>:results.map(u=><button type="button" key={u.id} className={button+' block w-full text-left'} onClick={()=>{setSelected(u);setQuery(u.username);}}>{u.name||u.username} (@{u.username})</button>)}
          {!selected&&!searching&&!searchError&&query.trim().length>=2&&results.length===0&&<p className="text-sm">{exactUsername?`No neighbor profiles match. If @${exactUsername} is their exact username, you can still invite them.`:'No neighbor profiles match.'}</p>}</div>:<p className="text-sm">Anyone with the link can accept this invitation. Share it only with the person you’re inviting.</p>}
      <label className="block space-y-1 text-sm"><span>Role in household</span><select value={preset} onChange={e=>setPreset(e.target.value)} className={field}>{roles.map(r=><option key={r[0]} value={r[0]}>{r[1]}</option>)}</select></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="space-y-1 text-sm"><span>Start date (optional)</span><input type="date" value={start} onChange={e=>setStart(e.target.value)} className={field}/></label>
        <label className="space-y-1 text-sm"><span>End date (inclusive, optional)</span><input type="date" value={end} onChange={e=>setEnd(e.target.value)} className={field}/></label></div>
      <p className="text-xs text-app-text-secondary">Dates use this device&apos;s time zone.</p>
      <label className="block space-y-1 text-sm"><span>Message (optional)</span><textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={300} rows={2} className={field}/></label>
      <button type="submit" className={primary} disabled={disabled||mode==='username'&&!selected&&!exactUsername}>{disabled?'Checking…':'Review invitation'}</button>
    </fieldset></form>;
}
