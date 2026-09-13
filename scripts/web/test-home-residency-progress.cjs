#!/usr/bin/env node
// Chrome renders real production personal/list/status responses from the owned
// local SDK/SQL fixture. Only authentication and unrelated app surfaces are controlled.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const {chromium,expect}=require(path.join(root,'frontend/apps/web/node_modules/@playwright/test'));
const [base,fixture,evidence]=process.argv.slice(2);
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(fixture||'',/^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const id=n=>`ddc24100-0000-4000-8000-${String(n).padStart(12,'0')}`;
const street='9141 Home Creation Fixture Way',events=[],errors=[];
let context,page;
async function api(endpoint,body) {
 const response=await fetch(fixture+endpoint,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer pantopus-synthetic-entry-loopback-only','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 const value=await response.json();assert(response.ok,JSON.stringify(value));return value;
}
const control=(action,body)=>api('/fixture/'+action,body);
async function saved(name) {
 await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true});
 fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(await control('state'),null,2),{mode:0o600});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No narrow horizontal overflow');
}
const status=async(title)=>{await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();};
async function main() {
 try {
  for(const n of [601,605]) {
   const selected=await api('/api/homes/check-address',{address:street,unit_number:String(n),city:'Test',state:'WA',zip_code:'98607'});
   assert.equal(selected.home_id,id(n));assert(selected.residency_address);
   const result=await api(`/api/homes/${id(n)}/residency-submissions`,{request_id:id(8000+n),claimed_role:'renter',address:selected.residency_address});
   assert.equal(result.state,'completed');assert.equal(result.postcard_requested,false);
  }
  context=await chromium.launchPersistentContext(path.join(evidence,'browser-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844}});
  await context.addCookies([{name:'pantopus_session',value:'1',url:base},{name:'pantopus_access',value:'synthetic-loopback-session',url:base,httpOnly:true}]);
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url()),p=u.pathname;
   if(u.origin!==base)return route.abort();
   if(!p.startsWith('/api/'))return p.startsWith('/socket.io/')?route.fulfill({status:503,body:''}):route.continue();
   try {
    let body={},code=200;
    if(p==='/api/users/profile'||p==='/api/homes/my-homes'||p==='/api/homes/primary'||p.endsWith('/my-residency')) {
     const response=await fetch(fixture+p+u.search,{headers:{Authorization:'Bearer pantopus-synthetic-entry-loopback-only'},signal:AbortSignal.timeout(120000)});
     body=await response.json();code=response.status;events.push({p,method:request.method(),status:code});
    } else if(p.includes('claims'))body={claims:[]};
    else if(p.includes('conversations'))body={conversations:[],hasMore:false};
    else if(p.includes('unread')||p.includes('badge'))body={count:0,unreadCount:0,total:0,byContext:{}};
    else if(p.includes('business'))body={businesses:[],seats:[]};
    else if(p.includes('homes'))body={homes:[],entries:[],invitations:[]};
    await route.fulfill({status:code,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(body)}).catch(()=>{});
   } catch(error) {if(!String(error.message).includes('closed'))errors.push(error.message);await route.abort().catch(()=>{});}
  });
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/app/homes',{waitUntil:'domcontentloaded',timeout:120000});
  await status('Your residency requests');
  for(const n of [601,604,605])await expect(page.locator(`a[href="/app/homes/${id(n)}/residency"]`).filter({hasText:'Check status'})).toBeVisible();
  await expect(page.getByText(street+', 601',{exact:true})).toBeVisible();await expect(page.getByText(street+', 605',{exact:true})).toBeVisible();
  await expect(page.getByText('Home verification',{exact:true})).toHaveCount(0);
  await saved('distinct-personal-requests');
  await page.locator(`a[href="/app/homes/${id(601)}/residency"]`).filter({hasText:'Check status'}).click();
  await status('Waiting for household review');await expect(page.locator('a[href$="/verify-residency"]')).toHaveCount(0);await expect(page.getByText(street+', 601',{exact:true})).toBeVisible();
  await saved('household-review-next-step');
  await control('change-unit',{home:601,unit:'PRIVATE-NEW-UNIT'});await page.getByRole('button',{name:'Refresh status',exact:true}).click();await status('Waiting for household review');
  await expect(page.getByText(street+', 601',{exact:true})).toBeVisible();await expect(page.getByText('PRIVATE-NEW-UNIT',{exact:false})).toHaveCount(0);await control('change-unit',{home:601,unit:'601'});
  for(const kind of ['error','malformed']) {
   await control('residency-read-fault',{kind});await page.getByRole('button',{name:'Refresh status',exact:true}).click();
   await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText(street+', 601',{exact:true})).toHaveCount(0);
   await saved(kind+'-safe-retry');await page.getByRole('button',{name:'Retry',exact:true}).click();await status('Waiting for household review');
  }
  console.log('PASS: distinct submitted identities and household-review destination; current private address changes stay hidden and failed/malformed reads recover');
  await page.goto(base+`/app/homes/${id(604)}/residency`);await status('Review your request');
  await expect(page.getByRole('link',{name:'Check address and resubmit',exact:true})).toHaveAttribute('href',`/app/homes/new?joinHome=${id(604)}`);await saved('rejected-next-step');
  await page.goto(base+`/app/homes/${id(605)}/residency`);await status('Address verification is required');
  await expect(page.getByRole('link',{name:'Review mail verification',exact:true})).toHaveAttribute('href',`/app/homes/${id(605)}/verify-postcard`);await saved('mail-is-a-separate-request');
  assert.equal((await control('state')).events.filter(e=>e.event==='request'&&e.path.includes('postcard')).length,0);
  await page.goto(base+`/app/homes/${id(601)}/residency`);await status('Waiting for household review');
  await control('hold',{suffix:'/my-residency'});await page.getByRole('button',{name:'Refresh status',exact:true}).click();
  await expect.poll(async()=>(await control('state')).held).toBe(true);
  await control('residency-state',{home:601,state:'verified'});
  await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide'));dispatchEvent(new PageTransitionEvent('pageshow'));});
  await status('Household access is available');await control('release',{});await page.waitForTimeout(500);
  await status('Household access is available');await expect(page.getByRole('heading',{name:'Waiting for household review',exact:true})).toHaveCount(0);await saved('retired-reply-after-current-approval');
  await control('residency-state',{home:601,state:'removed'});await page.getByRole('button',{name:'Refresh status',exact:true}).click();await status('Household access needs review');
  await expect(page.getByRole('link',{name:'Open Home',exact:true})).toHaveCount(0);await expect(page.getByText('Review recorded',{exact:true})).toBeVisible();await saved('old-approval-after-removal');
  await control('residency-state',{home:601,state:'frozen'});await page.getByRole('button',{name:'Refresh status',exact:true}).click();await status('Verification is unavailable for this Home');await saved('unavailable-home-personal-history');
  await page.goto(base+'/app/homes');await status('Your residency requests');
  await expect(page.locator(`a[href="/app/homes/${id(601)}/residency"]`).filter({hasText:'Check status'})).toBeVisible();
  await saved('removed-request-stays-personal');assert.deepEqual(errors,[]);
  await control('residency-history',{count:51});await page.reload();await status('Your residency requests');
  await expect(page.getByRole('button',{name:'Load more requests',exact:true})).toBeVisible();
  await control('residency-read-fault',{kind:'error'});await page.getByRole('button',{name:'Load more requests',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByText('Personal historical request 0',{exact:true})).toBeVisible();await saved('history-page-failure');
  await page.getByRole('button',{name:'Load more requests',exact:true}).click();
  await expect(page.getByText('Personal historical request 50',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Load more requests',exact:true})).toHaveCount(0);
  await expect(page.getByText(/^Personal historical request \d+$/)).toHaveCount(51);assert.deepEqual(errors,[]);await saved('complete-personal-history');
  console.log('PASS: rejected and mail next steps, retired responses, current approval, later removal/freeze, personal history and narrow layouts; no mail request');
 } finally {
  if(page)await page.screenshot({path:path.join(evidence,'final-screen.png'),fullPage:true}).catch(()=>{});
  fs.writeFileSync(path.join(evidence,'events.json'),JSON.stringify({events,errors},null,2),{mode:0o600});await context?.close();
 }
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});
