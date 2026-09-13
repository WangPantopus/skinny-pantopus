'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@pantopus/api';
import { SenderController } from './SenderController';
import { validInvitationSession, validSenderInvitation, type SenderInput, type SenderDraft, type SenderContext, type SenderInvitation } from './senderModel';
interface View { ready:boolean;busy:boolean;error:string;pending:SenderDraft|null;canAcknowledge:boolean;blocked:boolean;
  context:SenderContext|null;review:SenderInput|null;lifetime:number;accountLabel:string;shareToken:string|null;shareUntil:number|null }
const empty:View={ready:false,busy:false,error:'',pending:null,canAcknowledge:false,blocked:false,context:null,review:null,lifetime:0,accountLabel:'',shareToken:null,shareUntil:null};
export function useSender(homeId:string){
  const controller=useRef<SenderController|null>(null),generation=useRef(0),listGeneration=useRef(0);
  const [view,setView]=useState<View>(empty),[reload,setReload]=useState(0);
  const [invitations,setInvitations]=useState<SenderInvitation[]|null>(null),[listError,setListError]=useState('');
  const publish=useCallback((current:SenderController,error='')=>{
    if(controller.current!==current)return;
    if(!current.current()){setView({...empty,blocked:true,lifetime:generation.current,error:'Your session changed. Reopen recovery to check the original invitation action.'});return;}
    setView({ready:current.opened,busy:false,error,pending:current.pending,canAcknowledge:current.canAcknowledge,blocked:current.needsReload,
      context:current.context,review:current.review,lifetime:generation.current,accountLabel:current.accountLabel,shareToken:current.shareToken,shareUntil:current.shareUntil});
  },[]);
  const list=useCallback(async(current:SenderController,revision:number)=>{
    const listRevision=++listGeneration.current;current.clearShare();
    setView(previous=>({...previous,shareToken:null,shareUntil:null}));setInvitations(null);setListError('');
    try{
      const s=(await api.apiClient.get('/api/homes/invitations/sender/session')).data?.session;
      if(!validInvitationSession(s)||!current.matchesSession(s))throw new Error('Current sender session is unavailable.');
      if(controller.current!==current||!current.current()||revision!==generation.current||listRevision!==listGeneration.current)return;
      const r=(await api.apiClient.get(`/api/homes/${homeId}/invitations`,{headers:{'X-Pantopus-Session-Scope':s.session_scope}})).data;
      if(controller.current!==current||!current.current()||revision!==generation.current||listRevision!==listGeneration.current)return;
      if(!validInvitationSession(r?.session)||r.session.actor_id!==s.actor_id||r.session.session_scope!==s.session_scope||!Array.isArray(r.invitations)
        ||r.invitations.some((i:unknown)=>!validSenderInvitation(i,homeId)))throw new Error('Current invitations could not be confirmed.');
      setInvitations(r.invitations);
    }catch{if(controller.current===current&&current.current()&&revision===generation.current&&listRevision===listGeneration.current){
      current.clearShare();setView(previous=>({...previous,shareToken:null,shareUntil:null}));
      setListError('Current invitations could not be loaded. Your saved result is kept. Retry to check your current household authority and invitations.');
    }}
  },[homeId]);
  useEffect(()=>{
    let disposed=false;
    const retire=()=>{generation.current++;listGeneration.current++;controller.current?.retire();controller.current=null;setView({...empty,lifetime:generation.current});setInvitations(null);setListError('');};
    const open=async()=>{
      retire();if(disposed||document.visibilityState==='hidden')return;const revision=generation.current;let current:SenderController|null=null;
      try{current=new SenderController();controller.current=current;await current.open();if(disposed||revision!==generation.current)return;
        if(current.pending)await current.recover('status');publish(current);
      }catch(error){if(disposed||revision!==generation.current)return;
        if(current?.opened)publish(current,error instanceof Error?error.message:'The original invitation action could not be checked.');
        else setView({...empty,blocked:true,lifetime:generation.current,error:'Protected invitation recovery could not be opened. Your saved action is kept. Reopen recovery to try again.'});
      }
      if(current?.opened&&current.current()&&controller.current===current)void list(current,revision);
    };
    const visibility=()=>{if(document.visibilityState==='hidden')retire();else void open();};
    const storage=(event:StorageEvent)=>{if(event.key===null||event.key===api.AUTH_SESSION_CHANGE_KEY)void open();};
    const session=()=>{retire();queueMicrotask(()=>{if(!disposed)void open();});};
    const unsubscribe=api.onTokenChange(session);window.addEventListener('storage',storage);window.addEventListener('pagehide',retire);window.addEventListener('pageshow',visibility);
    window.addEventListener('focus',visibility);document.addEventListener('visibilitychange',visibility);void open();
    return()=>{disposed=true;retire();unsubscribe();window.removeEventListener('storage',storage);window.removeEventListener('pagehide',retire);window.removeEventListener('pageshow',visibility);
      window.removeEventListener('focus',visibility);document.removeEventListener('visibilitychange',visibility);};
  },[homeId,reload,publish,list]);
  useEffect(()=>{
    if(!view.shareUntil)return;
    const current=controller.current;
    const timer=setTimeout(()=>{if(current&&controller.current===current){current.clearShare();publish(current);}},Math.max(0,view.shareUntil-Date.now()));
    return()=>clearTimeout(timer);
  },[view.shareUntil,publish]);
  const run=async<T,>(action:(current:SenderController)=>Promise<T>):Promise<T|undefined>=>{
    const current=controller.current;if(generation.current!==view.lifetime||!current?.current())return;
    setView(previous=>({...previous,busy:true,error:''}));
    try{const result=await action(current);if(controller.current===current&&current.current()){publish(current);return result;}}
    catch(error){publish(current,error instanceof Error?error.message:'The invitation action could not be confirmed. Reopen recovery.');}
  };
  return {...view,invitations,listError,reopen:()=>setReload(v=>v+1),
    refreshList:()=>{const c=controller.current;if(c?.current())void list(c,generation.current);},
    prepare:(input:SenderInput)=>run(c=>c.prepare(input)),submit:(decision:string)=>run(c=>c.submit(decision)),
    cancelReview:()=>{const c=controller.current;if(c?.current()){c.cancelReview();publish(c);}},
    checkShare:(requestId:string)=>run(c=>c.checkShare(requestId)),
    recover:(action:'status'|'retry'|'cancel',requestId?:string)=>run(c=>c.recover(action,requestId)),
    acknowledge:(requestId:string)=>run(c=>c.acknowledge(requestId))};
}
