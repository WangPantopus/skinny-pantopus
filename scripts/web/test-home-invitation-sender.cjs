#!/usr/bin/env node
// Chrome UI -> production sender routes/services -> actual local SDK/SQL.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');const {chromium,expect}=require(path.join(root,'frontend/apps/web/node_modules/@playwright/test'));
const [base,fixture,capabilityFile,evidence,mode='acceptance']=process.argv.slice(2);assert(['acceptance','acknowledge'].includes(mode));
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(fixture||'',/^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert(path.isAbsolute(capabilityFile||'')&&!capabilityFile.startsWith(root+'/'));assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));
fs.mkdirSync(evidence,{recursive:true,mode:0o700});const bundle=JSON.parse(fs.readFileSync(capabilityFile,'utf8'));
const control=async(action,body)=>{const r=await fetch(fixture+'/fixture/'+action,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
let context,page,actor=0,failList=false,dropNext=false,holdNextList=false,releaseList=null,heldFinished=false,malformedReceipt=null;const events=[],errors=[],consoleMessages=[];
const state=()=>control('state'),senderPath='/api/homes/invitations/sender/commands';
const posts=()=>events.filter(e=>e.path===senderPath&&e.method==='POST').length;
const heading=name=>expect(page.getByRole('heading',{name,exact:true})).toBeVisible({timeout:30000});
const click=name=>page.getByRole('button',{name,exact:true}).click();
const marker=async index=>{actor=index;await page.evaluate(()=>{localStorage.setItem('pantopus_auth_session_change','sender-'+Date.now());window.dispatchEvent(new StorageEvent('storage',{key:'pantopus_auth_session_change'}));});};
const slots=()=>page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Storage'));});return await new Promise(resolve=>{const r=db.transaction('drafts').objectStore('drafts').getAllKeys();r.onsuccess=()=>resolve(r.result.filter(k=>String(k).includes('home-invitation-sender-v1')).length);});});
const save=async name=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(evidence,name+'-viewport.png'),fullPage:false});await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true});fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(await state(),null,2),{mode:0o600});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));};
async function newEmail(email){await page.getByLabel('Email address',{exact:true}).fill(email);await click('Review invitation');await heading('Review new invitation');}
async function failPut(n){await page.evaluate(n=>{const original=IDBObjectStore.prototype.put;let seen=0;IDBObjectStore.prototype.put=function(value,key){if(this.name==='drafts'&&typeof key==='string'&&key.includes('home-invitation-sender-v1')&&++seen===n){IDBObjectStore.prototype.put=original;throw new DOMException('Controlled storage failure','QuotaExceededError');}return original.call(this,value,key);};},n);}
async function main(){try{
 const user3=await (await fetch(fixture+'/api/users/me',{headers:{Authorization:'Bearer pantopus-synthetic-invitation-loopback-3'}})).json();
 context=await chromium.launchPersistentContext((mode==='acknowledge'?path.join(evidence,'..','browser-profile'):path.join(evidence,'browser-profile')),{channel:'chrome',headless:true,viewport:{width:390,height:844}});
 await context.addCookies([{name:'pantopus_session',value:'1',url:base},{name:'pantopus_access',value:'synthetic-loopback-session',url:base,httpOnly:true}]);
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url()),p=u.pathname;if(u.origin!==base)return route.abort();if(!p.startsWith('/api/'))return p.startsWith('/socket.io/')?route.fulfill({status:503,body:''}):route.continue();
  try{let body={},status=200,thisHeld=false;
   if(dropNext&&p===senderPath&&req.method()==='POST'){dropNext=false;events.push({path:p,method:'POST',status:0});return route.abort();}
   if(failList&&p===`/api/homes/${bundle.home}/invitations`){status=503;body={error:'Controlled list unavailable'};}
   else if(p==='/api/users/search')body={users:[{id:user3.id||user3.user.id,username:'residency_http_04',name:'Invite recipient 3'}]};
   else if(p.startsWith('/api/homes/')||p==='/api/users/profile'||p==='/api/users/me'||p==='/api/hub'){
    const r=await fetch(fixture+p+u.search,{method:req.method(),headers:{Authorization:'Bearer pantopus-synthetic-invitation-loopback-'+actor,'Content-Type':'application/json',...(req.headers()['x-pantopus-session-scope']?{'x-pantopus-session-scope':req.headers()['x-pantopus-session-scope']}:{})},body:req.postData()||undefined,signal:AbortSignal.timeout(45000)});status=r.status;body=await r.json();
   }else if(p.includes('unread')||p.includes('badge'))body={count:0,unreadCount:0,total:0,byContext:{}};else if(p.includes('business'))body={businesses:[],seats:[]};else if(p.includes('conversations'))body={conversations:[],hasMore:false};
   if(malformedReceipt&&p.startsWith(senderPath+'/')&&req.method()==='GET'&&body.state==='completed'){
    if(malformedReceipt==='state')body.state=['completed'];else body.delivery[malformedReceipt]=[malformedReceipt==='email'?'provider_accepted':'saved'];
   }
   if(holdNextList&&p===`/api/homes/${bundle.home}/invitations`){holdNextList=false;thisHeld=true;await new Promise(resolve=>{releaseList=resolve;});}
   events.push({path:p.replace(/\/token\/[^/]+/,'/token/[redacted]'),method:req.method(),status});await route.fulfill({status,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(body)});if(thisHeld)heldFinished=true;
  }catch(e){errors.push(e.name);await route.abort().catch(()=>{});}});
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.name));page.on('console',m=>consoleMessages.push(m.text()));
 if(mode==='acknowledge'){
  await page.goto(base+'/app/homes/'+bundle.home+'/invitations',{waitUntil:'domcontentloaded',timeout:120000});await click('Done');await heading('New invitation');assert.equal(await slots(),0);
  fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({all_originals_acknowledged:true}),{mode:0o600});console.log('PASS: earlier candidate original acknowledged through UI');return;
 }
 await page.goto(base+'/app/homes/'+bundle.home+'/dashboard?tab=security',{waitUntil:'domcontentloaded',timeout:120000});await click('+ Invite');await heading('New invitation');
 await newEmail('sender-browser-one@example.invalid');failList=true;const dashboardReads=events.filter(e=>e.path.endsWith('/dashboard')).length;await click('Confirm invitation');await heading('Invitation saved');
 await expect(page.getByText(/Current invitations could not be loaded/)).toBeVisible();assert.equal(events.filter(e=>e.path.endsWith('/dashboard')).length,dashboardReads);
 const first=(await state()).sender_commands.find(c=>c.action==='create'&&c.state==='completed');assert(first);await save('saved-create-survives-failed-refresh');
 failList=false;await click('Refresh invitations');await click('Check link for sharing');await expect(page.getByRole('img',{name:'Household invitation QR code'})).toBeVisible();
 const sharePosts=posts();holdNextList=true;await click('Refresh invitations');await expect.poll(()=>releaseList!==null).toBe(true);await control('sender-scenario',{mode:'deny_manage'});await click('Refresh invitations');await expect(page.getByText(/Current invitations could not be loaded/)).toBeVisible();
 releaseList();releaseList=null;await expect.poll(()=>heldFinished).toBe(true);await expect(page.locator('[data-invitation-id]')).toHaveCount(0);await expect(page.getByRole('img',{name:'Household invitation QR code'})).toHaveCount(0);
 await click('Check link for sharing');await expect(page.getByText(/This invitation link could not be confirmed for sharing/)).toBeVisible();assert.equal(posts(),sharePosts);await save('sharing-denial-and-out-of-order-list-stay-retired');
 await control('sender-scenario',{mode:'restore_manage'});await click('Refresh invitations');await click('Check link for sharing');await expect(page.getByRole('img',{name:'Household invitation QR code'})).toBeVisible();await click('Done');await heading('New invitation');
 await page.getByRole('button',{name:'Close panel',exact:true}).click();await page.getByRole('link',{name:'Manage invitations and recovery'}).click();await heading('New invitation');
 await newEmail('sender-browser-two@example.invalid');await failPut(1);const noPost=posts();await click('Confirm invitation');await expect(page.getByRole('button',{name:'Reopen invitation recovery'})).toBeVisible();assert.equal(posts(),noPost);await save('storage-failure-prevents-post');await click('Reopen invitation recovery');await heading('New invitation');
 await newEmail('sender-browser-two@example.invalid');dropNext=true;await click('Confirm invitation');await heading('Recover your invitation action');assert.equal(await slots(),1);
 const sealed=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);});const read=(s,k)=>new Promise(resolve=>{const r=db.transaction(s).objectStore(s).get(k);r.onsuccess=()=>resolve(r.result);});const keys=await new Promise(resolve=>{const r=db.transaction('drafts').objectStore('drafts').getAllKeys();r.onsuccess=()=>resolve(r.result);});const entry=await read('drafts',keys.find(k=>String(k).includes('home-invitation-sender-v1'))),key=await read('keys','home-invitation-sender-v1');return {fields:Object.keys(entry).sort(),iv:entry.iv.byteLength,algorithm:key.algorithm.name,bits:key.algorithm.length,extractable:key.extractable};});
 assert.deepEqual(sealed,{fields:['ciphertext','iv','revision','version'],iv:12,algorithm:'AES-GCM',bits:256,extractable:false});
 await click('Cancel this attempt');await click('Confirm cancellation');await heading('Attempt cancelled');await save('unseen-attempt-cancelled');await click('Done');await heading('New invitation');
 await page.getByLabel('Invite by').selectOption('username');await page.getByLabel('Search by username').fill('residency_http_04');await page.getByRole('button',{name:'Invite recipient 3 (@residency_http_04)',exact:true}).click();await click('Review invitation');
 await control('fault',{action:'create',kind:'after'});await click('Confirm invitation');await heading('Recover your invitation action');
 await control('fault',{action:'sender_read',kind:'before',persistent:true});await page.reload();await heading('Recover your invitation action');await save('cold-lost-create-and-read-failure');
 const malformedPosts=posts();
 for(const corrupt of [null,false,0,'']){
  await page.evaluate(async corrupt=>{
   const db=await new Promise(resolve=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),keys=store.getAllKeys();
    keys.onsuccess=()=>{const key=keys.result.find(k=>String(k).includes('home-invitation-sender-v1'));const r=store.get(key);
     r.onsuccess=()=>{window.__senderSealedForAcceptance={key,value:r.result};store.put(corrupt,key);};};tx.oncomplete=resolve;tx.onerror=tx.onabort=reject;});
  },corrupt);
  try{await marker(0);await expect(page.getByText(/Protected invitation recovery could not be opened/)).toBeVisible();
   await expect(page.getByRole('heading',{name:'New invitation',exact:true})).toHaveCount(0);assert.equal(posts(),malformedPosts);assert.equal(await slots(),1);
  }finally{await page.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);});
    await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(window.__senderSealedForAcceptance.value,window.__senderSealedForAcceptance.key);tx.oncomplete=resolve;tx.onerror=tx.onabort=reject;});delete window.__senderSealedForAcceptance;});}
  await click('Reopen invitation recovery');await heading('Recover your invitation action');
 }
 await save('corrupt-records-kept-without-replacement');
 await marker(1);await heading('New invitation');assert.equal(await slots(),1);await expect(page.getByText('Original action: Create invitation')).toHaveCount(0);await marker(0);await heading('Recover your invitation action');
 await control('fault',{action:'sender_read',kind:'clear'});
 for(const field of ['state','email','in_app']){malformedReceipt=field;const reads=events.filter(e=>e.method==='GET'&&e.path.startsWith(senderPath+'/')).length;await click('Check saved result');
  await expect.poll(()=>events.filter(e=>e.method==='GET'&&e.path.startsWith(senderPath+'/')).length).toBe(reads+1);await expect(page.getByRole('button',{name:'Check saved result',exact:true})).toBeEnabled();await heading('Recover your invitation action');
  await expect(page.getByText(/The result is not confirmed/)).toBeVisible();await expect(page.getByRole('button',{name:'Done',exact:true})).toHaveCount(0);assert.equal(await slots(),1);assert.equal(posts(),malformedPosts);}
 malformedReceipt=null;await save('malformed-receipt-keeps-original');await click('Check saved result');await heading('Invitation saved');await expect(page.getByText(/Email delivery is not confirmed/)).toBeVisible();await save('username-recovered-without-delivery-claim');
 const username=(await state()).sender_commands.filter(c=>c.action==='create'&&c.state==='completed').find(c=>c.request_id!==first.request_id);assert(username);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.delete;IDBObjectStore.prototype.delete=function(key){if(this.name==='drafts'&&String(key).includes('home-invitation-sender-v1')){IDBObjectStore.prototype.delete=original;throw new DOMException('Controlled acknowledgement failure','QuotaExceededError');}return original.call(this,key);};});
 await click('Done');await heading('Invitation saved');assert.equal(await slots(),1);await click('Done');await heading('New invitation');assert.equal(await slots(),0);
 const row=id=>page.locator(`[data-invitation-id="${id}"]`);
 await row(username.invitation_id).getByRole('button',{name:'Resend invitation',exact:true}).click();await heading('Review resend');await control('delivery',{email:'accepted',in_app:true});await click('Confirm resend');await heading('Resend saved');await expect(page.getByText(/inbox delivery is not confirmed/)).toBeVisible();await save('explicit-resend-provider-handoff');await click('Done');await heading('New invitation');
 await row(first.invitation_id).getByRole('button',{name:'Withdraw invitation',exact:true}).click();await heading('Review withdrawal');const membershipBefore=(await state()).memberships;await control('fault',{action:'withdraw',kind:'after'});await click('Confirm withdrawal');await heading('Recover your invitation action');await page.reload();await heading('Withdrawal saved');assert.deepEqual((await state()).memberships,membershipBefore);await save('lost-withdrawal-preserves-membership');await click('Done');await heading('New invitation');
 await row(username.invitation_id).getByRole('button',{name:'Withdraw invitation',exact:true}).click();await heading('Review withdrawal');await control('sender-scenario',{mode:'accept',invitation_id:username.invitation_id});const acceptedMember=(await state()).memberships;await click('Confirm withdrawal');await heading('Invitation action needs review');assert.deepEqual((await state()).memberships,acceptedMember);await save('resolved-recipient-withdrawal-preserves-membership');await click('Done');await heading('New invitation');
 const legacy=bundle.capabilities[0].invitation_id;await row(legacy).getByRole('button',{name:'Withdraw invitation',exact:true}).click();await heading('Review withdrawal');await control('sender-scenario',{mode:'deny_manage'});await click('Confirm withdrawal');await heading('Invitation action needs review');await page.reload();await heading('Invitation action needs review');await save('current-authority-required-history-survives');await click('Done');await heading('New invitation');await control('sender-scenario',{mode:'restore_manage'});await click('Refresh invitations');
 await newEmail('sender-browser-three@example.invalid');await marker(1);await heading('New invitation');assert.equal(await page.getByRole('button',{name:'Confirm invitation',exact:true}).count(),0);await marker(0);await heading('New invitation');
 await newEmail('sender-browser-three@example.invalid');await failPut(2);const p=posts();await click('Confirm invitation');await heading('Recover your invitation action');await click('Retry original action');await heading('Invitation saved');assert.equal(posts(),p+1);await save('terminal-storage-repair-no-repost');await click('Done');await heading('New invitation');
 const expired=bundle.capabilities[1].invitation_id;await control('sender-scenario',{mode:'expire',invitation_id:expired});await click('Refresh invitations');
 await expect(row(expired).getByText('Status: Expired invitation',{exact:true})).toBeVisible();await expect(row(expired).getByRole('button',{name:'Resend invitation',exact:true})).toBeDisabled();
 await expect(row(expired).getByText(/@residency_http_03/)).toBeVisible();await row(expired).getByRole('button',{name:'Withdraw invitation',exact:true}).click();await heading('Review withdrawal');await click('Confirm withdrawal');await heading('Withdrawal saved');await save('expired-pending-invitation-can-be-withdrawn');await click('Done');await heading('New invitation');
 assert.equal(await slots(),0);assert.deepEqual(errors,[]);const final=await state();assert(final.sender_commands.every(c=>c.state!=='pending'));assert(!events.some(e=>e.method==='DELETE'&&e.path.includes('/members/')));
 const caps=await control('capabilities');for(const c of caps.capabilities)assert(!consoleMessages.some(s=>s.includes(c.token)));
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({passed:true,commands:final.sender_commands.length,failed_refresh_saved:true,username_delivery_truthful:true,
  encrypted_original:true,storage_failure_no_post:true,corrupt_record_kept:true,malformed_receipt_keeps_original:true,sharing_current_context:true,list_response_ordering:true,cold_account_recovery:true,unseen_cancel:true,explicit_resend:true,lost_withdrawal:true,
  legitimate_membership_preserved:true,current_authority:true,distinct_recipient_identity:true,expired_withdrawal:true,receipt_repair_no_repost:true,all_originals_acknowledged:true,no_member_delete:true,diagnostics_private:true},null,2),{mode:0o600});
 console.log('PASS: actual browser sender creation/recovery, delivery proof, resend and membership-preserving withdrawal');
 }finally{if(page){await page.evaluate(()=>window.scrollTo(0,0)).catch(()=>{});await page.screenshot({path:path.join(evidence,'final-viewport.png'),fullPage:false}).catch(()=>{});await page.screenshot({path:path.join(evidence,'final-screen.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(evidence,'final-dom.txt'),await page.locator('body').innerText().catch(()=>''),{mode:0o600});}fs.writeFileSync(path.join(evidence,'events.json'),JSON.stringify({events,errors}),{mode:0o600});await context?.close();}}
main().catch(e=>{fs.writeFileSync(path.join(evidence,'failure.txt'),String(e.stack),{mode:0o600});console.error('Sender browser acceptance failed; private diagnostics retained');process.exitCode=1;});
