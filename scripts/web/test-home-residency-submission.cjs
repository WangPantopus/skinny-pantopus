#!/usr/bin/env node
// Owned Chrome -> production joining/address/list routes -> local SDK/SQL.
// The loopback fixture controls only identity/provider/fault boundaries.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const {chromium,expect}=require(path.join(root,'frontend/apps/web/node_modules/@playwright/test'));
const [base,fixture,evidence,resume]=process.argv.slice(2);
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(fixture||'',/^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));
fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const street='9141 Home Creation Fixture Way',events=[],errors=[];
const homeId=n=>`ddc24100-0000-4000-8000-${String(n).padStart(12,'0')}`;
let context,page;
async function control(action,body) {
 const r=await fetch(`${fixture}/fixture/${action}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal(r.status,200);return r.json();
}
async function saved(name) {
 fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(await control('state'),null,2),{mode:0o600});
 await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No narrow horizontal overflow');
}
const posts=(state,n)=>state.events.filter(e=>e.event==='request'&&e.method==='POST'&&e.path===`/api/homes/${homeId(n)}/residency-submissions`);
const home=(state,n)=>{const h=state.database.homes.find(h=>h.id===homeId(n));assert(h);return h;};
async function open(query='') {await page.goto(base+'/app/homes/new'+query,{waitUntil:'domcontentloaded',timeout:120000});}
async function form(n,role='renter') {
 await expect(page.getByRole('heading',{name:'Where is your home?'})).toBeVisible();
 await page.getByRole('combobox').fill('');await page.getByRole('combobox').fill(street);
 await page.getByRole('option',{name:new RegExp(street)}).click();
 await page.getByLabel('Unit or apartment',{exact:true}).fill(String(n));
 await page.getByRole('button',{name:'Next →',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Claim this home',exact:true})).toBeVisible();
 await expect(page.getByLabel('Network name (SSID)',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Move-in date',{exact:true})).toHaveCount(0);
 await expect(page.getByLabel('Entry instructions',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:role==='household'?'Household member':'🔑 Renter / Tenant',exact:true}).click();
 await page.getByRole('button',{name:'Review claim →',exact:true}).click();
 await expect(page.getByRole('button',{name:'✅ Submit Claim',exact:true})).toBeVisible();
}
async function pendingCount() {
 return page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Recovery unavailable'));});
  const keys=await new Promise((resolve,reject)=>{const r=db.transaction('drafts').objectStore('drafts').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Recovery unavailable'));});
  db.close();return keys.filter(k=>typeof k==='string'&&k.includes('home-create-v1')).length;
 });
}
async function encrypted() {
 const proof=await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('pantopus-private-task-recovery');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Recovery unavailable'));});
  const read=store=>new Promise((resolve,reject)=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(new Error('Recovery unavailable'));});
  const values=await read('drafts'),keys=await read('keys');db.close();return {count:values.length,sealed:values.every(v=>v.ciphertext instanceof ArrayBuffer&&v.iv.byteLength===12&&!JSON.stringify(v).includes('Fixture Way')),nonexportable:keys.every(k=>k instanceof CryptoKey&&!k.extractable)};
 });assert.equal(proof.count,1);assert(proof.sealed&&proof.nonexportable);
}
async function complete(n,role='renter',routing='household_review') {
 await expect(page.getByRole('heading',{name:'Your residency request was saved',exact:true})).toBeVisible();
 const state=await control('state'),h=home(state,n);assert.equal(h.claims.length,1);assert.equal(h.claims[0].status,'pending');assert.equal(h.claims[0].claimed_role,role);
 assert.equal(h.claims[0].cold_start_mode,routing==='household_review'?null:routing);assert.equal(h.occupancies,1);assert.equal(h.audit,1);
 await saved(n+'-original-completion');await page.getByRole('button',{name:'Open My Homes',exact:true}).click();
 await expect(page.getByRole('heading',{name:'My Homes',exact:true})).toBeVisible();
 await expect(page.locator(`a[href="/app/homes/${homeId(n)}/residency"]`).filter({hasText:'Check status'})).toBeVisible();
 assert.equal(await pendingCount(),0);await saved(n+'-current-my-homes');
}
async function main() {
 try {
  context=await chromium.launchPersistentContext(path.join(evidence,'browser-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844}});
  await context.addCookies([{name:'pantopus_session',value:'1',url:base},{name:'pantopus_access',value:'synthetic-loopback-session',url:base,httpOnly:true}]);
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url()),p=u.pathname;
   if(u.origin!==base)return route.abort();
   if(!p.startsWith('/api/'))return p.startsWith('/socket.io/')?route.fulfill({status:503,body:''}):route.continue();
   try {
    let body={},status=200;
    if(p.startsWith('/api/geo/')||p.startsWith('/api/v1/address/')||p==='/api/homes'||p==='/api/homes/my-homes'||p.endsWith('/my-residency')||p==='/api/homes/primary'||p.includes('/residency-submissions')||p.startsWith('/api/homes/create-commands/')||p==='/api/homes/check-address'||p==='/api/homes/property-suggestions'||p==='/api/users/profile') {
     const response=await fetch(fixture+p+u.search,{method:r.method(),headers:{Authorization:'Bearer pantopus-synthetic-entry-loopback-only','Content-Type':'application/json'},body:r.postData()||undefined,signal:AbortSignal.timeout(120000)});
     status=response.status;body=await response.json();events.push({p,method:r.method(),status});
    } else if(p.includes('claims'))body={claims:[]};
    else if(p.includes('conversations'))body={conversations:[],hasMore:false};
    else if(p.includes('unread')||p.includes('badge'))body={count:0,unreadCount:0,total:0,byContext:{}};
    else if(p.includes('business'))body={businesses:[],seats:[]};
    else if(p.includes('homes'))body={homes:[],entries:[],invitations:[]};
    await route.fulfill({status,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(body)}).catch(()=>{});
   } catch(error) {if(error.name!=='TimeoutError'&&!String(error.message).includes('closed'))errors.push(error.message);await route.abort().catch(()=>{});}
  });
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  if(['address-selection-race','address-selection-unit-race'].includes(resume)) {
   await open();await expect(page.getByRole('heading',{name:'Where is your home?'})).toBeVisible();
   await page.getByRole('combobox').fill(street);await expect(page.getByRole('option',{name:new RegExp(street)})).toBeVisible();
   await control('hold',{suffix:'/resolve'});await page.getByRole('option',{name:new RegExp(street)}).click();
   await expect.poll(async()=>(await control('state')).held).toBe(true);
   if(resume==='address-selection-unit-race')await page.getByLabel('Unit or apartment',{exact:true}).fill('603');
   else await page.getByRole('combobox').fill('Edited address still typing');
   await control('release',{});
   await page.waitForTimeout(750);await saved('held-selection-after-address-edit');
   if(resume==='address-selection-unit-race') {
    await expect(page.getByRole('button',{name:'Next →',exact:true})).toBeEnabled();
    await expect(page.getByLabel('Unit or apartment',{exact:true})).toHaveValue('603');
   } else await expect(page.getByRole('combobox')).toHaveValue('Edited address still typing');
   assert.equal(await pendingCount(),0);assert.deepEqual(errors,[]);console.log('PASS: '+resume+' keeps the current street choice and unit without stale overwrite');return;
  }
  if(['address-background-race','address-property-race','address-geolocation-race'].includes(resume)) {
   await open();await expect(page.getByRole('heading',{name:'Where is your home?'})).toBeVisible();
   await page.getByRole('combobox').fill(street);await page.getByRole('option',{name:new RegExp(street)}).click();
   await page.getByLabel('Unit or apartment',{exact:true}).fill(resume==='address-property-race'?'709':'602');
   const before=(await control('state')).events.length;
   if(resume==='address-geolocation-race') {
    await page.evaluate(()=>{navigator.geolocation.getCurrentPosition=success=>{window.fixtureGeo=()=>success({coords:{latitude:45.6,longitude:-122.4}});};});
    await page.getByRole('button',{name:'📍 Use current location',exact:true}).click();
    await page.getByLabel('Unit or apartment',{exact:true}).fill('603');await page.evaluate(()=>window.fixtureGeo());
   } else {
    await control('hold',{suffix:resume==='address-property-race'?'/property-suggestions':'/check-address'});
    await page.getByRole('button',{name:'Next →',exact:true}).click();await expect.poll(async()=>(await control('state')).held).toBe(true);
    if(resume==='address-background-race') await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow'));});
    else await page.getByLabel('Unit or apartment',{exact:true}).fill('603');
    await control('release',{});
   }
   await page.waitForTimeout(750);await saved(resume);
   await expect(page.getByRole('heading',{name:'Where is your home?',exact:true})).toBeVisible();
   await expect(page.getByLabel('Unit or apartment',{exact:true})).toHaveValue(resume==='address-background-race'?'602':'603');
   const after=(await control('state')).events.slice(before);
   assert.equal(after.filter(e=>e.event==='request'&&e.method==='POST'&&e.path.includes('/residency-submissions')).length,0);
   if(resume==='address-geolocation-race')assert.equal(after.filter(e=>e.event==='request'&&e.path==='/api/geo/reverse').length,0);
   assert.equal(await pendingCount(),0);assert.deepEqual(errors,[]);console.log('PASS: '+resume+' retires the old operation without navigation or submission');return;
  }
  if(resume==='address-edit-race') {
   await open();await expect(page.getByRole('heading',{name:'Where is your home?'})).toBeVisible();
   await page.getByRole('combobox').fill(street);await page.getByRole('option',{name:new RegExp(street)}).click();
   await page.getByLabel('Unit or apartment',{exact:true}).fill('602');await control('hold',{suffix:'/check-address'});
   await page.getByRole('button',{name:'Next →',exact:true}).click();await expect.poll(async()=>(await control('state')).held).toBe(true);
   await page.getByLabel('Unit or apartment',{exact:true}).fill('603');await control('release',{});
   await expect.poll(async()=>(await control('state')).held).toBe(false);
   await page.waitForTimeout(750);await saved('held-address-result-after-unit-edit');
   await expect(page.getByRole('heading',{name:'Where is your home?',exact:true})).toBeVisible();
   await expect(page.getByLabel('Unit or apartment',{exact:true})).toHaveValue('603');
   assert.equal(await pendingCount(),0);assert.deepEqual(errors,[]);console.log('PASS: editing an apartment retires a held address decision without navigation or submission');return;
  }
  if(resume==='linked-home-mismatch') {
   const before=(await control('state')).events.length;
   await open('?joinHome='+homeId(602));
   await expect(page.getByRole('heading',{name:'Where is your home?'})).toBeVisible();
   await page.getByRole('combobox').fill(street);await page.getByRole('option',{name:new RegExp(street)}).click();
   await page.getByLabel('Unit or apartment',{exact:true}).fill('603');await page.getByRole('button',{name:'Next →',exact:true}).click();
   await expect(page.getByText('This address does not match the Home you opened.',{exact:false})).toBeVisible();
   await saved('linked-home-cannot-switch-apartments');
   assert.equal((await control('state')).events.slice(before).filter(e=>e.event==='request'&&e.method==='POST'&&e.path.includes('/residency-submissions')).length,0);
   assert.equal(await pendingCount(),0);assert.deepEqual(errors,[]);console.log('PASS: linked Home identity mismatch blocks joining another apartment before any submission');return;
  }
  if(!resume) {
   await open();await form(601);await control('mode',{mode:'residency_lost_reply'});
   await page.getByRole('button',{name:'✅ Submit Claim',exact:true}).click();
   await expect(page.getByText('The result is not confirmed.',{exact:false})).toBeVisible();await encrypted();await saved('601-lost-reply');
   await page.reload();await complete(601);assert.equal(posts(await control('state'),601).length,1);
   console.log('PASS: lost committed join reply reloads the original encrypted command, then current My Homes');
  }
  if(!resume||resume==='after-lost-reply') {
   await open();await form(602);await control('hold-submission',{});
   await page.getByRole('button',{name:'✅ Submit Claim',exact:true}).click();
   await expect.poll(async()=>(await control('state')).held_submission).toBe(true);await page.reload();
   await expect(page.getByRole('button',{name:'Cancel original request',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Cancel original request',exact:true}).click();
   await page.getByRole('button',{name:'Confirm cancellation',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Home request cancelled',exact:true})).toBeVisible();await saved('602-cancelled-original');
   await control('release-submission',{});await page.getByRole('button',{name:'Edit original details',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Where is your home?'})).toBeVisible();assert.equal(await pendingCount(),0);
   assert.equal(home(await control('state'),602).claims.length,0);assert.equal(home(await control('state'),602).occupancies,0);
   console.log('PASS: restart and confirmed cancellation fence a held original submission without admission');
  }
  if(!resume||['after-lost-reply','after-cancel'].includes(resume)) {
   await open('?joinHome='+homeId(603));await form(603);await control('change-unit',{home:603,unit:'changed-603'});
   await page.getByRole('button',{name:'✅ Submit Claim',exact:true}).click();
   await expect(page.getByText('This Home’s address changed.',{exact:false})).toBeVisible();await saved('603-selected-address-changed');
   const first=posts(await control('state'),603)[0].request_id;assert.equal(home(await control('state'),603).claims.length,0);
   await control('change-unit',{home:603,unit:'603'});await page.getByRole('button',{name:'Edit original details',exact:true}).click();
   await form(603);await page.getByRole('button',{name:'✅ Submit Claim',exact:true}).click();await complete(603);
   const submitted=posts(await control('state'),603);assert.equal(submitted.length,2);assert.notEqual(submitted[1].request_id,first);
   console.log('PASS: selected apartment change rejects with recovery; revalidation and explicit retry use a fresh UUID');
  }
  if(!resume||['after-lost-reply','after-cancel','after-address'].includes(resume)) {
   await open();await form(604,'household');await page.getByRole('button',{name:'✅ Submit Claim',exact:true}).click();await complete(604,'household');
   console.log('PASS: rejected existing application resubmits through actual UI with explicit household role');
  }
  await open();await form(605);await page.evaluate(()=>{
   const original=IDBObjectStore.prototype.put;let writes=0;
   IDBObjectStore.prototype.put=function(value,key){if(this.name==='drafts'&&typeof key==='string'&&key.includes('home-create-v1')&&++writes===2)throw new DOMException('Synthetic proof failure','QuotaExceededError');return original.call(this,value,key);};
  });
  await page.getByRole('button',{name:'✅ Submit Claim',exact:true}).click();
  await expect(page.getByText('The original Home request could not be saved.',{exact:false})).toBeVisible();await saved('605-proof-write-failure');
  await page.getByRole('button',{name:'Retry original request',exact:true}).click();await complete(605,'renter','external_postcard');
  assert.equal(posts(await control('state'),605).length,1);assert.deepEqual(errors,[]);
  assert.equal((await control('state')).events.filter(e=>e.event==='request'&&e.path.endsWith('/claim')&&e.method==='POST').length,0);
  console.log('PASS: actual encrypted proof-write repair avoids reposting; external verification remains pending without postal dispatch');
 } finally {
  if(page)await page.screenshot({path:path.join(evidence,'final-screen.png'),fullPage:true}).catch(()=>{});
  fs.writeFileSync(path.join(evidence,'events.json'),JSON.stringify({events,errors},null,2),{mode:0o600});
  await context?.close();
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
