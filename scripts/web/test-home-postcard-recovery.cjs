#!/usr/bin/env node
// Actual Chrome UI -> production HTTP/SDK/SQL on an owned loopback fixture.
// Auth and unrelated app surfaces are controlled. No external mail is sent.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),{chromium,expect}=require(path.join(root,'frontend/apps/web/node_modules/@playwright/test'));
const [base,fixture,evidence]=process.argv.slice(2);
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(fixture||'',/^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const home='ddc23600-0000-4000-8000-000000000100',actor='ddc23600-0000-4000-8000-000000000002',events=[],errors=[],consoleMessages=[];
let context,page,dropCode=false;
async function api(p,body){const r=await fetch(fixture+p,{method:body===undefined?'GET':'POST',headers:{'x-fixture-actor':actor,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const value=await r.json();assert(r.ok);return value;}
const control=(name,body)=>api('/fixture/'+name,body);
const heading=async name=>expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
const click=async name=>page.getByRole('button',{name,exact:true}).click();
const acknowledge=async()=>click('Review current mail status');
async function save(name){await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true});fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(await control('state'),null,2),{mode:0o600});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
async function fillAddress(unit='602'){
 for(const [label,value] of [['Street address','Private residency fixture'],['Apartment, suite or unit (optional)',unit],['City','Test'],['State','WA'],['ZIP code','98607']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('checkbox').check();
}
const attempts=async()=>(await control('state')).cards[0].attempts;
const codeRequests=()=>events.filter(e=>e.method==='POST'&&/\/verifications$/.test(e.p)).length;
async function main(){try{
 context=await chromium.launchPersistentContext(path.join(evidence,'browser-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844}});
 await context.addCookies([{name:'pantopus_session',value:'1',url:base},{name:'pantopus_access',value:'synthetic-loopback-session',url:base,httpOnly:true}]);
 await context.route('**/*',async route=>{const request=route.request(),u=new URL(request.url()),p=u.pathname;
  if(u.origin!==base)return route.abort();if(!p.startsWith('/api/'))return p.startsWith('/socket.io/')?route.fulfill({status:503,body:''}):route.continue();
  try{let body={},status=200;
   if(p==='/api/users/profile'||p===`/api/homes/${home}/my-residency`||p.includes('/postcard')||p.includes('/verifications')){
    if(dropCode&&request.method()==='POST'&&p.endsWith('/verifications')){dropCode=false;events.push({p,method:'POST',dropped_before_server:true});return route.abort('failed');}
    const r=await fetch(fixture+p+u.search,{method:request.method(),headers:{'x-fixture-actor':actor,'Content-Type':'application/json'},body:['GET','HEAD'].includes(request.method())?undefined:request.postData(),signal:AbortSignal.timeout(30000)});
    body=await r.json();status=r.status;events.push({p,method:request.method(),status});
   }else if(p.includes('conversations'))body={conversations:[],hasMore:false};else if(p.includes('unread')||p.includes('badge'))body={count:0,unreadCount:0,total:0,byContext:{}};
   else if(p.includes('business'))body={businesses:[],seats:[]};else if(p.includes('homes'))body={homes:[],entries:[],invitations:[]};
   await route.fulfill({status,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(body)}).catch(()=>{});
  }catch(error){if(!String(error.message).includes('closed'))errors.push(error.message);await route.abort().catch(()=>{});}
 });
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>consoleMessages.push(message.text()));
 await control('fault',{name:'get_home_postcard_current_status',kind:'malformed'});
 await page.goto(base+`/app/homes/${home}/verify-postcard?return=place`,{waitUntil:'domcontentloaded',timeout:120000});
 await expect(page.locator('main p[role="alert"]')).toBeVisible();await expect(page.getByRole('button',{name:'Request postcard',exact:true})).toHaveCount(0);assert.equal((await control('state')).provider_calls,0);
 await save('unavailable-initial-read');await click('Retry mail status');await heading('Confirm your mailing address');assert.equal((await control('state')).cards.length,0);
 await fillAddress('603');await save('explicit-mailing-address');await click('Request postcard');await heading('Original attempt was not accepted');assert.equal((await control('state')).cards.length,0);
 await expect(page.getByText('The Home address changed.',{exact:false})).toBeVisible();await save('wrong-apartment-refused');await acknowledge();await heading('Confirm your mailing address');
 await fillAddress();await control('fault',{name:'begin_home_postcard_request',kind:'lost'});await click('Request postcard');await heading('Recover your original attempt');await expect(page.locator('main p[role="alert"]')).toBeVisible();
 assert.equal((await control('state')).cards.length,1);assert.equal((await control('state')).provider_calls,0);await save('lost-request-keeps-original');
 await page.reload();await heading('Postcard request saved');await acknowledge();await heading('Your postcard request');await expect(page.getByRole('heading',{name:'Enter your postcard code',exact:true})).toHaveCount(0);
 await control('keys',{enabled:false});await click('Resume saved mailing request');await heading('Postcard request saved');await acknowledge();await expect(page.getByRole('button',{name:'Resume saved mailing request',exact:true})).toBeVisible();assert.equal((await control('state')).provider_calls,0);await save('missing-key-preserves-mail');
 await control('keys',{enabled:true});await click('Resume saved mailing request');await heading('Postcard request saved');await acknowledge();await heading('Enter your postcard code');
 await expect(page.getByText('The mailing outcome is unknown.',{exact:false})).toBeVisible();assert.equal((await control('state')).provider_calls,1);await click('Refresh mail status');await heading('Enter your postcard code');assert.equal((await control('state')).provider_calls,1);await save('unknown-delivery-no-resend');
 const secret=(await control('code')).code;assert.match(secret,/^\d{6}$/);const wrong=secret==='111111'?'222222':'111111';
 dropCode=true;await page.getByLabel('Postcard code',{exact:true}).fill(wrong);await click('Record code verification');await heading('Recover your original attempt');assert.equal(await attempts(),0);
 await click('Cancel original attempt');await click('Confirm cancellation');await heading('Original attempt cancelled');assert.equal(await attempts(),0);await save('cancel-before-arrival');await acknowledge();await heading('Enter your postcard code');
 await control('fault',{name:'verify_home_postcard_current',kind:'lost'});await page.getByLabel('Postcard code',{exact:true}).fill(wrong);await click('Record code verification');await heading('Recover your original attempt');assert.equal(await attempts(),1);
 await page.reload();await heading('Original attempt was not accepted');assert.equal(await attempts(),1);await save('lost-wrong-code-recovers-once');await acknowledge();await heading('Enter your postcard code');
 // Fail the proof write after the server's reply. The next retry repairs that
 // protected write without another verification POST or guess.
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let n=0;IDBObjectStore.prototype.put=function(value,key){if(typeof key==='string'&&key.includes('home-postcard-v1')&&++n===2){IDBObjectStore.prototype.put=original;throw new DOMException('Synthetic private write failure','QuotaExceededError');}return original.call(this,value,key);};});
 const beforeProof=codeRequests();await page.getByLabel('Postcard code',{exact:true}).fill(wrong);await click('Record code verification');await heading('Recover your original attempt');assert.equal(await attempts(),2);await expect(page.locator('main p[role="alert"]')).toBeVisible();
 await click('Retry original attempt');await heading('Original attempt was not accepted');assert.equal(await attempts(),2);assert.equal(codeRequests(),beforeProof+1);await save('proof-write-repaired-without-post');await acknowledge();await heading('Enter your postcard code');
 await control('fault',{name:'verify_home_postcard_current',kind:'lost'});await page.getByLabel('Postcard code',{exact:true}).fill(secret);await click('Record code verification');await heading('Recover your original attempt');assert.equal(await attempts(),3);
 await page.reload();await heading('Code verification recorded');assert.equal(await attempts(),3);await expect(page.getByRole('link',{name:'Return to Place',exact:true})).toHaveCount(0);await save('lost-success-is-proof-not-access');
 await acknowledge();await heading('Postal proof recorded');await expect(page.getByText('Your residency is waiting for household review.',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Return to Place',exact:true})).toHaveCount(0);await save('household-review-next');
 await control('access',{state:'verified'});await click('Refresh mail status');await expect(page.getByRole('link',{name:'Return to Place',exact:true})).toBeVisible();
 await control('hold',{name:'get_home_postcard_current_status'});await click('Refresh mail status');await expect.poll(async()=>(await control('state')).held).toBe(true);
 await control('access',{state:'removed'});await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow'));});
 await heading('Postal proof recorded');await expect(page.getByRole('link',{name:'Return to Place',exact:true})).toHaveCount(0);await control('release',{});await page.waitForTimeout(300);
 await expect(page.getByRole('link',{name:'Return to Place',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Enter your postcard code',exact:true})).toHaveCount(0);await save('retired-reply-cannot-restore-access');
 await control('access',{state:'frozen'});await click('Refresh mail status');await expect(page.getByRole('button',{name:'Request postcard',exact:true})).toHaveCount(0);await save('frozen-home-safe-status');
 assert.equal((await control('state')).provider_calls,1);assert.deepEqual(errors,[]);
 assert(!consoleMessages.some(text=>text.includes(secret)||text.includes('Private residency fixture')||text.includes('/api/homes/')),'Private Home requests, codes and responses stay out of browser diagnostics');
 console.log('PASS: actual browser/HTTP/SDK/SQL initial-read recovery, exact apartment, original mailing resume, unavailable key, unknown delivery, cancellation, lost wrong/success replies, proof-write repair, household review, current removal and retired replies; narrow layout; one synthetic provider call');
 }finally{if(page)await page.screenshot({path:path.join(evidence,'final-screen.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(evidence,'events.json'),JSON.stringify({events,errors},null,2),{mode:0o600});await context?.close();}}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
