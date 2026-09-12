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
  if(!resume) {
  await page.goto(base+'/app/homes',{waitUntil:'domcontentloaded',timeout:120000});
  await expect(page.getByRole('heading',{name:'My Homes',exact:true})).toBeVisible();
  const entry=page.locator(`a[href="/app/homes/${homeId(606)}/residency"]`).filter({hasText:'Residency status'});
  await expect(entry).toBeVisible();await saved('private-list');await entry.click();
  await expect(page.getByRole('heading',{name:'Request residency review',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Review mail verification',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Open Home',exact:true})).toHaveCount(0);
  await control('residency-read-fault',{kind:'error',persistent:true});await page.getByRole('button',{name:'Refresh status',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();await control('residency-read-fault',{kind:'clear'});
  await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Request residency review',exact:true})).toBeVisible();
  await saved('no-request-before-mail');
  await page.getByRole('link',{name:'Check address and request residency',exact:true}).click();
  await expect(page).toHaveURL(base+'/app/homes/new?joinHome='+homeId(606));
  await expect(page.getByRole('heading',{name:'Where is your home?',exact:true})).toBeVisible();
  await page.getByRole('combobox').fill(street);await page.getByRole('option',{name:new RegExp(street)}).click();
  for(const unit of ['603','799']) {
   await page.getByLabel('Unit or apartment',{exact:true}).fill(unit);
   await page.getByRole('button',{name:'Next →',exact:true}).click();
   await expect(page.getByText('This address does not match the Home you opened.',{exact:false})).toBeVisible();
   await expect(page.getByLabel('Unit or apartment',{exact:true})).toHaveValue(unit);
   await saved('wrong-unit-'+unit);
   const state=await control('state');assert.equal(state.database.commands.length,0);assert.equal(state.database.submissions.length,0);
  }
  await page.getByLabel('Unit or apartment',{exact:true}).fill('606');
  await page.getByRole('button',{name:'Next →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Claim this home',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'🔑 Renter / Tenant',exact:true}).click();
  await page.getByRole('button',{name:'Review claim →',exact:true}).click();await saved('correct-home-review');
  await control('mode',{mode:'residency_lost_reply'});
  await page.getByRole('button',{name:'✅ Submit Claim',exact:true}).click();
  await expect(page.getByText('The result is not confirmed.',{exact:false})).toBeVisible();
  }
  const original=(await control('state')).database.submissions;assert.equal(original.length,1);
  if(resume) await open('?joinHome='+homeId(606)); else await page.reload();
  await expect(page.getByRole('heading',{name:'Your residency request was saved',exact:true})).toBeVisible();
  await saved('saved-original-after-reload');
  await page.getByRole('button',{name:'Open My Homes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My Homes',exact:true})).toBeVisible();
  await page.locator(`a[href="/app/homes/${homeId(606)}/residency"]`).first().click();
  await expect(page.getByRole('heading',{name:'Address verification is required',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Review mail verification',exact:true})).toHaveAttribute('href',`/app/homes/${homeId(606)}/verify-postcard`);
  await expect(page.getByRole('link',{name:'Check address and request residency',exact:true})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Open Home',exact:true})).toHaveCount(0);
  await saved('saved-request-mail-next-step');
  const final=await control('state'),h=home(final,606);
  assert.equal(h.claims.length,1);assert.equal(h.claims[0].status,'pending');assert.equal(h.occupancies,1);assert.equal(h.verified_occupancies,0);
  assert.equal(final.database.commands.length,0);assert.deepEqual(final.database.submissions,original);
  assert.equal(posts(final,606).length,1);assert.equal(posts(final,603).length,0);
  assert.equal(final.events.filter(e=>e.event==='request'&&e.path.includes('postcard')).length,0);assert.deepEqual(errors,[]);
  console.log('PASS: private Home status, no-request recovery, selected-home mismatch and correction, retained submission, truthful mail next step; no duplicate Home, shared access or mail request');
 } finally {
  if(page)await page.screenshot({path:path.join(evidence,'final-screen.png'),fullPage:true}).catch(()=>{});
  fs.writeFileSync(path.join(evidence,'events.json'),JSON.stringify({events,errors},null,2),{mode:0o600});
  await context?.close();
 }
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
