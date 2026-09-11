#!/usr/bin/env node
// Actual Chrome composer + actual Gig HTTP route + production service + local SQL.
// Auth/profile, address provider and unrelated shell replies are synthetic.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root=path.resolve(__dirname,'../..');
const {chromium,expect}=require(path.join(root,'frontend/apps/web/node_modules/@playwright/test'));
const [base,container,database,evidence]=process.argv.slice(2);
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);
assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));
fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const f=require('../db/home-task-gig-http-fixture.cjs')(container,database,'ddf22400');
const {actor,other,home,sql,rpc,literal:q}=f;
let server,browser,context,page,initialized=false,currentActor=actor,heldRead=null,releaseRead=null;
const posts=[];const errors=[];
const session=()=>({...f.scope.getRequestSessionScope({user:{id:currentActor},session:{id:'local-task-gig-acceptance'}}),home_id:home});
async function main(){
 try{
  assert.equal(sql(`SELECT count(*) FROM auth.users WHERE id IN(${q(actor)},${q(other)});`),'0');
  sql(`BEGIN;INSERT INTO auth.users(id,email) VALUES(${q(actor)},'gig-browser@example.invalid'),(${q(other)},'gig-browser-other@example.invalid');
    INSERT INTO public."User"(id,email,username,name) SELECT id,email,'gig_browser_'||right(id::text,1),'Browser fixture' FROM auth.users WHERE id IN(${q(actor)},${q(other)});
    INSERT INTO public."Home"(id,owner_id,address,city,state,zipcode) VALUES(${q(home)},${q(actor)},'Private browser Home','Test','WA','98607');
    INSERT INTO public."HomeOccupancy"(home_id,user_id,role,role_base,age_band,verification_status) VALUES(${q(home)},${q(actor)},'owner','owner','adult','verified');COMMIT;`);
  initialized=true;
  const create=(title)=>{const r=rpc('mutate_home_record',{p_home_id:home,p_actor_id:actor,p_kind:'task',p_action:'create',p_record_id:null,
    p_payload:{title,description:'PRIVATE original source description',details:{private_marker:'never publish'}},p_source_mail_id:null});assert.equal(r.ok,true);return r.record;};
  const task=create('Private kitchen repair');
  const stale=create('Private second repair');
  const composing=create('Private competing publication');
  const sourceTasks=[task,stale,composing];
  server=f.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const apiBase=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:'chrome',headless:true});
  context=await browser.newContext({viewport:{width:1100,height:950}});
  await context.addCookies([{name:'pantopus_session',value:'1',url:base},{name:'pantopus_access',value:'synthetic-local-session',url:base,httpOnly:true}]);
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url()),endpoint=url.pathname,method=route.request().method();
   if(url.origin!==base)return route.abort();
   if(!endpoint.startsWith('/api/'))return endpoint.startsWith('/socket.io/')?route.fulfill({status:503,body:''}):route.continue();
   let body={},status=200;
   try{
    if(endpoint==='/api/users/profile')body={user:{id:currentActor,username:'synthetic',name:'Browser fixture',account_type:'personal',email_verified:true}};
    else if(endpoint==='/api/gigs'&&method==='POST'){
     const original=route.request().postDataJSON();posts.push(original);
     const response=await fetch(apiBase+'/api/gigs',{method:'POST',headers:{'content-type':'application/json','x-fixture-actor':currentActor,
       'x-pantopus-session-scope':route.request().headers()['x-pantopus-session-scope']||''},body:JSON.stringify(original)});
     body=await response.json();status=response.status;console.log('HTTP publication',posts.length,status,body.code||'receipt');
    }else if(/^\/api\/gigs\/[a-f0-9-]+$/.test(endpoint)&&method==='GET'){
     // Actual current persisted Gig, with synthetic actor enrichment only.
     const gig=JSON.parse(sql(`SELECT to_jsonb(g)::text FROM public."Gig" g WHERE id=${q(endpoint.split('/')[3])} AND user_id=${q(actor)};`));
     body={gig:{...gig,creator:{id:actor,name:'Browser fixture',username:'synthetic',account_type:'personal'}}};
    }else if(endpoint.endsWith('/timeline'))body={steps:[]};
    else if(endpoint.endsWith('/bids'))body={bids:[]};
    else if(endpoint.endsWith('/questions'))body={questions:[]};
    else if(endpoint.endsWith('/change-orders'))body={change_orders:[]};
    else if(endpoint.startsWith(`/api/homes/${home}/tasks`)){
     const parts=endpoint.split('/'),taskId=parts[5]||null,kind=parts[6];
     assert.equal(method,'GET');
     if(kind==='gig-publication'){
      if(heldRead){const hold=heldRead;heldRead=null;hold.arrived();await hold.released;}
      body={...await f.service.read({homeId:home,actorId:currentActor,taskId}),task_session:session()};
     }else if(kind==='recurrence'){
      const r=rpc('get_home_task_recurrence',{p_home_id:home,p_actor_id:currentActor,p_task_id:taskId});
      if(!r.ok)throw Object.assign(new Error(r.code),{statusCode:r.status,code:r.code});body={...r,task_session:session()};
     }else{
      const r=rpc('get_home_records',{p_home_id:home,p_actor_id:currentActor,p_kind:'task',p_record_id:taskId});
      if(!r.ok)throw Object.assign(new Error(r.code),{statusCode:r.status,code:r.code});
      body=taskId?{task:r.records[0],task_session:session()}:{tasks:r.records,task_session:session(),collection_capabilities:{can_create:r.can_create}};
     }
    }else if(endpoint==='/api/geo/autocomplete')body={suggestions:[{suggestion_id:'synthetic-meetup',primary_text:'Reviewed work location',secondary_text:'Test, WA',label:'Reviewed work location',center:{latitude:45.65,longitude:-122.55}}]};
    else if(endpoint==='/api/geo/resolve')body={normalized:{address:'Reviewed work location',city:'Test',state:'WA',zipcode:'98607',latitude:45.65,longitude:-122.55,verified:false,source:'synthetic'}};
    else if(endpoint.startsWith(`/api/upload/home-task-media-session/${home}`))body={...session(),task_id:sourceTasks.find(t=>endpoint.includes(t.id))?.id||task.id};
    else if(endpoint.startsWith(`/api/upload/home-task-media/${home}/`))body={media:[],can_upload:true};
    else if(endpoint.endsWith('/occupants'))body={occupants:[]};
    else if(endpoint.includes('conversations'))body={conversations:[],hasMore:false};
    else if(endpoint.includes('unread')||endpoint.includes('badge'))body={count:0,unreadCount:0,total:0,byContext:{}};
    else if(endpoint.includes('business'))body={businesses:[],seats:[]};
    else if(endpoint.includes('homes'))body={homes:[]};
   }catch(error){status=error.statusCode||500;body={error:error.message,code:error.code};}
   await route.fulfill({status,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(body)}).catch(()=>{});
  });
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  const composer=t=>`${base}/app/gigs/new?sourceHomeId=${home}&sourceTaskId=${t.id}`;
  const screenshot=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true});};
  function holdNextRead(){
   let arrived;const reached=new Promise(resolve=>{arrived=resolve;});
   const released=new Promise(resolve=>{releaseRead=resolve;});heldRead={arrived,released};
   return async()=>{let timer;try{await Promise.race([reached,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Publication preflight was not reached')),30000);})]);}finally{clearTimeout(timer);}};
  }
  async function visibility(hidden){
   // Deterministic browser lifecycle event; this is not an OS suspension claim.
   await page.evaluate(value=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:value?'hidden':'visible'});document.dispatchEvent(new Event('visibilitychange'));},hidden);
  }
  async function stored(target=page){return target.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
   const read=(store,key)=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=reject;});
   const keys=await new Promise(resolve=>{const r=db.transaction('drafts').objectStore('drafts').getAllKeys();r.onsuccess=()=>resolve(r.result);});
   const result=[];for(const slot of keys.filter(key=>JSON.parse(key)[0]==='gig-publication')){
    const sealed=await read('drafts',slot),key=await read('keys','task-gig-publication-v1');
    const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:sealed.iv,additionalData:new TextEncoder().encode(`pantopus-task-gig-publication-v1:${slot}`)},key,sealed.ciphertext);
    const draft=JSON.parse(new TextDecoder().decode(data));result.push({slot,draft,extractable:key.extractable,encrypted:!new TextDecoder().decode(sealed.ciphertext).includes(draft.request_id)});
   }db.close();return result;
  });}
  async function fill(target=page,title='Reviewed kitchen help',keyboard=false){
   await target.getByLabel('Public title',{exact:true}).fill(title);
   await target.getByLabel('Public description',{exact:true}).fill('Please help with this reviewed repair. No private source text.');
   await target.getByLabel('Budget (USD)',{exact:true}).fill('25');
   await target.getByRole('combobox',{name:'Choose the work location',exact:true}).fill('Reviewed work');
   if(keyboard){await target.getByRole('listbox').waitFor();await target.getByRole('combobox',{name:'Choose the work location',exact:true}).press('ArrowDown');await target.keyboard.press('Enter');}
   else await target.getByRole('listbox').getByRole('option').first().click();
   await target.getByText('Selected: Reviewed work location',{exact:true}).waitFor();
   await target.getByRole('checkbox').check();
  }
  await page.goto(`${base}/app/homes/${home}/tasks`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByRole('button',{name:task.title,exact:true}).click();
  await page.getByRole('link',{name:'Review Gig publication',exact:true}).click();
  await page.getByLabel('Public title',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Public title',{exact:true}).inputValue(),'');
  assert.equal(await page.getByLabel('Public description',{exact:true}).inputValue(),'');
  assert.equal(posts.length,0);assert(!page.url().includes('Private'));assert(await page.getByRole('button',{name:'Publish Gig',exact:true}).isDisabled());
  await fill(page,'Reviewed kitchen help',true);await screenshot('01-reviewed-public-form');
  f.loseNextReply();await page.getByRole('button',{name:'Publish Gig',exact:true}).click();
  await page.getByRole('button',{name:'Retry original publication',exact:true}).waitFor();
  assert.equal(posts.length,1);const original=structuredClone(posts[0]);let slot=(await stored())[0];
  assert(slot.encrypted&&!slot.extractable);assert.equal(slot.draft.request_id,original.home_task_source.request_id);
  const receipt=JSON.parse(sql(`SELECT to_jsonb(r)::text FROM public."HomeTaskGigReceipt" r WHERE task_id=${q(task.id)};`));
  const gig=receipt.gig_id;
  sql(`UPDATE public."Gig" SET status='cancelled',price=30 WHERE id=${q(gig)};`);
  await screenshot('02-unknown-original-retained');await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Retry original publication',exact:true}).click();
  await page.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();assert.deepEqual(posts[1],original);
  assert.equal(sql(`SELECT status FROM public."Gig" WHERE id=${q(gig)};`),'cancelled');
  assert.equal(await page.getByRole('link',{name:'Open Gig',exact:true}).getAttribute('href'),`/app/gigs/${gig}`);
  await page.getByRole('link',{name:'Open Gig',exact:true}).click();
  await page.getByRole('heading',{name:'Reviewed kitchen help',exact:true}).waitFor();
  await page.getByText('Cancelled',{exact:true}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Close Gig',exact:true}).count(),0);
  assert.equal(await page.getByText(task.title,{exact:true}).count(),0);
  assert.equal(await page.getByText('PRIVATE original source description',{exact:true}).count(),0);
  await screenshot('03a-current-cancelled-gig');
  await page.goto(`${base}/app/gigs/${gig}?action=cancel`,{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Reviewed kitchen help',exact:true}).waitFor();
  await expect(page.getByRole('heading',{name:'Cancel Gig',exact:true})).toHaveCount(0);
  // A completed source-linked Gig has the same terminal cancellation boundary.
  sql(`UPDATE public."Gig" SET status='completed',worker_completed_at=clock_timestamp(),owner_confirmed_at=clock_timestamp() WHERE id=${q(gig)};`);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Reviewed kitchen help',exact:true}).waitFor();
  await expect(page.getByRole('button',{name:'Close Gig',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Cancel Gig',exact:true})).toHaveCount(0);
  sql(`UPDATE public."Gig" SET status='cancelled',worker_completed_at=NULL,owner_confirmed_at=NULL WHERE id=${q(gig)};`);
  await page.goto(composer(task),{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();
  assert((await stored())[0].draft.confirmed);await page.reload({waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();assert.equal(posts.length,2);
  await screenshot('03-cold-confirmed-receipt');await page.getByRole('button',{name:'I reviewed this confirmation',exact:true}).click();
  await page.getByRole('link',{name:'Open linked Gig',exact:true}).waitFor();assert.equal((await stored()).length,0);
  assert.equal(sql(`SELECT count(*) FROM public."Gig" WHERE user_id=${q(actor)};`),'1');
  console.log('PASS: normal Home entry, explicit review, encrypted unknown recovery, exact retry, later-cancellation preservation and cold confirmed receipt/ack');
  // Stale source and recovery must retain the exact original until a definitive reply.
  await page.goto(composer(stale),{waitUntil:'domcontentloaded'});await fill(page,'Reviewed second help');
  sql(`UPDATE public."HomeTask" SET title='Changed private second source',updated_at=clock_timestamp() WHERE id=${q(stale.id)};`);
  await page.getByRole('button',{name:'Publish Gig',exact:true}).click();
  await page.getByRole('button',{name:'Review current task again',exact:true}).waitFor();
  assert.equal(sql(`SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE task_id=${q(stale.id)};`),'0');
  await page.getByRole('button',{name:'Review current task again',exact:true}).click();
  await page.getByRole('region',{name:'Private source task'}).getByText('Changed private second source',{exact:true}).waitFor();
  assert.equal((await stored()).length,0);assert(!(await page.getByRole('checkbox').isChecked()));
  console.log('PASS: stale source does not publish; explicit acknowledgement reloads the current source and requires review again');
  // Two composers can edit, but only one may claim the protected original slot.
  await page.goto(composer(composing),{waitUntil:'domcontentloaded'});await fill(page,'First competing review');
  const sibling=await context.newPage();await sibling.goto(composer(composing),{waitUntil:'domcontentloaded'});await fill(sibling,'Second competing review');
  f.loseNextReply();await page.getByRole('button',{name:'Publish Gig',exact:true}).click();await page.getByRole('button',{name:'Retry original publication',exact:true}).waitFor();
  const count=posts.length;await sibling.getByRole('button',{name:'Publish Gig',exact:true}).click();await sibling.getByRole('alert').waitFor();
  assert.equal(posts.length,count);await sibling.reload({waitUntil:'domcontentloaded'});await sibling.getByRole('button',{name:'Retry original publication',exact:true}).click();
  await sibling.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();
  assert.equal(sql(`SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE task_id=${q(composing.id)};`),'1');
  await sibling.close();console.log('PASS: competing composers cannot replace the original request or create a duplicate');
  // Current denial hides both source and saved public details after focus.
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();
  sql(`UPDATE public."HomeOccupancy" SET is_active=false WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('button',{name:'Reload current access',exact:true}).waitFor();
  assert.equal(await page.getByText('First competing review',{exact:true}).count(),0);assert.equal(await page.getByText(composing.title,{exact:true}).count(),0);
  sql(`UPDATE public."HomeOccupancy" SET is_active=true WHERE home_id=${q(home)} AND user_id=${q(actor)};`);
  await page.getByRole('button',{name:'Reload current access',exact:true}).click();await page.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();
  // Account replacement must not show or submit the original account's fields.
  currentActor=other;const priorPosts=posts.length;
  await page.evaluate(()=>{localStorage.setItem('pantopus_auth_session_change','changed');window.dispatchEvent(new Event('focus'));});
  await page.getByRole('button',{name:'Reload current access',exact:true}).waitFor();assert.equal(posts.length,priorPosts);
  assert.equal(await page.getByText('First competing review',{exact:true}).count(),0);
  currentActor=actor;await page.getByRole('button',{name:'Reload current access',exact:true}).click();
  await page.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();
  console.log('PASS: current revocation and account replacement hide private/source/recovery UI and send no publication');
  // An unreadable original is preserved, never silently treated as a new command.
  const corruptSlot=(await stored()).find(s=>s.draft.task_id===composing.id).slot;
  const envelope=await page.evaluate(async slot=>{
   const db=await new Promise(resolve=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);});
   const t=db.transaction('drafts','readwrite'),s=t.objectStore('drafts');let original;
   const r=s.get(slot);r.onsuccess=()=>{const v=r.result;original={...v,iv:Array.from(new Uint8Array(v.iv)),ciphertext:Array.from(new Uint8Array(v.ciphertext))};const damaged=new Uint8Array(v.ciphertext.slice(0));damaged[0]^=1;s.put({...v,ciphertext:damaged.buffer},slot);};
   await new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onerror=reject;});db.close();return original;
  },corruptSlot);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('alert').filter({hasText:'could not be read'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Publish Gig',exact:true}).count(),0);assert.equal(posts.length,priorPosts);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('alert').filter({hasText:'could not be read'}).waitFor();
  await page.evaluate(async({slot,envelope})=>{
   const db=await new Promise(resolve=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);});
   const t=db.transaction('drafts','readwrite');t.objectStore('drafts').put({...envelope,iv:new Uint8Array(envelope.iv).buffer,ciphertext:new Uint8Array(envelope.ciphertext).buffer},slot);
   await new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onerror=reject;});db.close();
  },{slot:corruptSlot,envelope});
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Original publication confirmed',exact:true}).waitFor();
  console.log('PASS: corrupt encrypted original blocks publication and remains recoverable after restoring the original bytes');
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.locator('header').first().evaluate(e=>e.getBoundingClientRect().left)).toBe(0);
  await expect.poll(()=>page.getByRole('main',{name:'Publish household task as a Gig'}).evaluate(e=>e.getBoundingClientRect().width)).toBeGreaterThan(360);
  await screenshot('04-narrow-confirmation');
  await page.goto(composer(stale),{waitUntil:'domcontentloaded'});await fill(page,'Reviewed held publication',true);await screenshot('05-narrow-review');
  await page.evaluate(()=>{window.originalFixturePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==='drafts'&&typeof key==='string'&&JSON.parse(key)[0]==='gig-publication')throw new DOMException('Synthetic storage quota failure','QuotaExceededError');return window.originalFixturePut.call(this,value,key);};});
  await page.getByRole('button',{name:'Publish Gig',exact:true}).click();await page.getByRole('alert').filter({hasText:'could not be saved'}).waitFor();
  assert.equal(posts.length,priorPosts);assert.equal((await stored()).some(s=>s.draft.task_id===stale.id),false);
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalFixturePut;delete window.originalFixturePut;});
  console.log('PASS: browser storage write failure visibly blocks publication before HTTP; form remains available');
  const reached=holdNextRead();await page.getByRole('button',{name:'Publish Gig',exact:true}).click();await reached();
  await visibility(true);await expect(page.getByRole('region',{name:'Private source task'})).toHaveCount(0);
  releaseRead();releaseRead=null;await visibility(false);await page.getByRole('button',{name:'Retry original publication',exact:true}).waitFor();
  assert.equal(posts.length,priorPosts);const heldOriginal=(await stored()).find(s=>s.draft.task_id===stale.id).draft;
  const reachedAgain=holdNextRead();await page.getByRole('button',{name:'Retry original publication',exact:true}).click();await reachedAgain();
  currentActor=other;await page.evaluate(()=>{localStorage.setItem('pantopus_auth_session_change','changed-during-preflight');window.dispatchEvent(new Event('focus'));});
  releaseRead();releaseRead=null;await page.getByRole('button',{name:'Reload current access',exact:true}).waitFor();
  assert.equal(posts.length,priorPosts);assert.equal(await page.getByText('Reviewed held publication',{exact:true}).count(),0);
  currentActor=actor;await page.getByRole('button',{name:'Reload current access',exact:true}).click();await page.getByRole('button',{name:'Retry original publication',exact:true}).waitFor();
  assert.deepEqual((await stored()).find(s=>s.draft.task_id===stale.id).draft,heldOriginal);
  // Definitive stale rejection clears this original only after explicit review.
  sql(`UPDATE public."HomeTask" SET updated_at=clock_timestamp() WHERE id=${q(stale.id)};`);
  await page.getByRole('button',{name:'Retry original publication',exact:true}).click();await page.getByRole('button',{name:'Review current task again',exact:true}).click();
  await page.getByLabel('Public title',{exact:true}).waitFor();assert(!(await page.getByRole('checkbox').isChecked()));
  assert.equal((await stored()).some(s=>s.draft.task_id===stale.id),false);
  console.log('PASS: held preflight background/account transitions suppress POST and preserve the exact original; restored authority can resolve it');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));assert.deepEqual(errors,[]);
  const countRows=sql(`SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE home_id=${q(home)};`);assert.equal(countRows,'2');
  fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({result:'pass',posts:posts.length,receipts:2,pageErrors:errors,limits:'Synthetic authentication and address provider; actual browser/Express/production SQL'},null,2));
  console.log('PASS: narrow layout, no browser exceptions, exactly two publications; evidence '+evidence);
 }catch(error){
  if(page){await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(evidence,'failure.txt'),await page.locator('body').innerText().catch(()=>''));}
  throw error;
 }finally{
  if(releaseRead)releaseRead();if(context)await context.close();if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
  if(initialized){sql(`BEGIN;DELETE FROM public."HomeTaskGigReceipt" WHERE home_id=${q(home)};DELETE FROM public."Gig" WHERE user_id IN(${q(actor)},${q(other)});
    DELETE FROM public."Home" WHERE id=${q(home)};DELETE FROM public."User" WHERE id IN(${q(actor)},${q(other)});DELETE FROM auth.users WHERE id IN(${q(actor)},${q(other)});COMMIT;`);
    assert.equal(sql(`SELECT (SELECT count(*) FROM public."HomeTaskGigReceipt" WHERE home_id=${q(home)})+(SELECT count(*) FROM public."Home" WHERE id=${q(home)})+(SELECT count(*) FROM auth.users WHERE id IN(${q(actor)},${q(other)}));`),'0');
    console.log('PASS: exact browser/SQL fixture cleanup');}
 }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
