#!/usr/bin/env node
// Actual Chrome invitation rendering against the owned production HTTP/SDK/SQL fixture.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const {chromium,expect}=require(path.join(root,'frontend/apps/web/node_modules/@playwright/test'));
const [base,fixture,capabilityFile,evidence,mode='baseline']=process.argv.slice(2);
assert.match(base||'',/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(fixture||'',/^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert(path.isAbsolute(capabilityFile||'')&&!capabilityFile.startsWith(root+'/'));
assert(path.isAbsolute(evidence||'')&&!evidence.startsWith(root+'/'));assert(['baseline','candidate'].includes(mode));
fs.mkdirSync(evidence,{recursive:true,mode:0o700});
const bundle=JSON.parse(fs.readFileSync(capabilityFile,'utf8'));
let capability=bundle.capabilities.find(c=>c.index===1);assert(capability);
let context,page;const errors=[],events=[];
const control=async(action,body)=>{
 const r=await fetch(fixture+'/fixture/'+action,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal(r.status,200);return r.json();
};
async function saved(name){
 await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true});
 fs.writeFileSync(path.join(evidence,name+'.json'),JSON.stringify(await control('state'),null,2),{mode:0o600});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
async function candidate(){
 const heading=name=>page.getByRole('heading',{name,exact:true});
 const pending=()=>expect(heading("You're Invited!")).toBeVisible();
 const read=()=>control('state');
 const row=(state,index)=>state.invitations.find(i=>i.id===bundle.capabilities.find(c=>c.index===index).invitation_id);
 const open=async(index)=>{capability=bundle.capabilities.find(c=>c.index===index);await page.goto(base+'/invite/'+capability.token,{waitUntil:'domcontentloaded'});await pending();};
 await control('scenario',{mode:'legacy_metadata',index:1});await page.reload();await pending();await saved('legacy-null-expiry-and-home-type');
 for(const kind of ['before','malformed']){
  await control('fault',{action:'preview',kind,persistent:true});await page.reload();
  await expect(heading('Could not load invitation')).toBeVisible();
  await expect(page.getByRole('button',{name:'✓ Accept Invitation',exact:true})).toHaveCount(0);
  assert.equal(row(await read(),1).status,'pending');await saved('preview-'+kind+'-retry');
  await control('fault',{action:'preview',kind:'clear'});await page.getByRole('button',{name:'Retry',exact:true}).click();await pending();
 }
 await page.goto(base+'/invite/missing-fixture-invitation',{waitUntil:'domcontentloaded'});
 await expect(heading('Invitation not found')).toBeVisible();await saved('unknown-invitation');
 await open(2);
 await control('fault',{action:'decline',kind:'before'});
 await page.getByRole('button',{name:'Decline',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Decline',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Decline could not be confirmed'})).toContainText('Decline could not be confirmed');
 await expect(page.getByRole('button',{name:'✓ Accept Invitation',exact:true})).toBeDisabled();
 assert.equal(row(await read(),2).status,'pending');await saved('decline-failure-preserves-invitation');
 await page.getByRole('button',{name:'Recheck invitation',exact:true}).click();await pending();
 await page.getByRole('button',{name:'Decline',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Decline',exact:true}).click();
 await expect(heading('Invitation Declined')).toBeVisible();assert.equal(row(await read(),2).status,'revoked');
 await page.reload();await expect(heading('Invitation closed')).toBeVisible();await saved('revoked-invitation-after-reload');
 await open(3);capability=bundle.capabilities.find(c=>c.index===2);
 await page.getByRole('button',{name:'✓ Accept Invitation',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Acceptance could not be confirmed'})).toContainText('Acceptance could not be confirmed');
 assert.equal(row(await read(),3).status,'pending');await saved('wrong-recipient-denied');
 await open(3);await control('fault',{action:'accept',kind:'after'});
 await page.getByRole('button',{name:'✓ Accept Invitation',exact:true}).click();
 await expect(page.getByRole('alert').filter({hasText:'Acceptance could not be confirmed'})).toContainText('Acceptance could not be confirmed');
 assert.equal(row(await read(),3).status,'accepted');await saved('lost-accept-reply');
 await page.getByRole('button',{name:'Recheck invitation',exact:true}).click();
 await expect(heading('Invitation already accepted')).toBeVisible();
 await expect(page.getByRole('button',{name:'My Homes',exact:true})).toBeVisible();
 await saved('saved-acceptance-is-not-current-access');
 await control('scenario',{mode:'scheduled',index:4});await open(4);
 await expect(page.getByText(/Access starts /)).toBeVisible();
 await page.getByRole('button',{name:'✓ Accept Invitation',exact:true}).click();
 await expect(heading('Acceptance recorded')).toBeVisible();await saved('future-access-acceptance-recorded');
 await page.waitForTimeout(2200);
 assert.equal(new URL(page.url()).pathname,'/invite/'+capability.token,'No automatic household destination');
 const future=(await read()).memberships.find(m=>m.user_id===capability.actor_id);
 assert(Date.parse(future.access_start_at)>Date.now());
 await open(1);await control('fault',{action:'preview',kind:'hold'});await page.reload({waitUntil:'domcontentloaded'});
 await expect.poll(async()=> (await read()).events.filter(e=>e.event==='reply_held').length).toBe(1);
 await control('scenario',{mode:'expire',index:1});
 const other=await context.newPage();await other.goto(base+'/privacy',{waitUntil:'domcontentloaded'});
 await other.evaluate(()=>localStorage.setItem('pantopus_auth_session_change','invitation-acceptance-'+Date.now()));
 await page.bringToFront();await expect(heading('Invitation Expired')).toBeVisible();
 await control('release',{});
 await expect.poll(async()=> (await read()).events.filter(e=>e.event==='reply_released').length).toBe(1);
 await expect(heading('Invitation Expired')).toBeVisible();
 await expect(page.getByRole('button',{name:'✓ Accept Invitation',exact:true})).toHaveCount(0);
 await saved('late-pending-reply-cannot-restore-expired-invite');await other.close();
 const state=await read();
 assert.equal(state.audit.filter(a=>a.action==='HOME_INVITE_ACCEPTED').length,2);
 assert.equal(state.audit.filter(a=>a.action==='HOME_INVITE_REVOKED').length,1);
 assert.equal(state.memberships.filter(m=>bundle.capabilities.some(c=>c.actor_id===m.user_id)).length,2);
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({passed:true,preview_failure_retry:true,malformed_failure_retry:true,
  unknown_revoked_expired_distinct:true,nullable_legacy_metadata:true,decline_failure_truthful:true,wrong_recipient_denied:true,lost_acceptance_truthful:true,
  future_access_no_automatic_navigation:true,retired_reply_discarded:true,acceptance_audit_count:2,decline_audit_count:1},null,2),{mode:0o600});
 console.log('PASS: actual browser invitation reads, failed decline, wrong recipient, lost acceptance, future access and retired reply');
}
async function main(){
 try{
  context=await chromium.launchPersistentContext(path.join(evidence,'browser-profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844}});
  await context.addCookies([{name:'pantopus_session',value:'1',url:base},{name:'pantopus_access',value:'synthetic-loopback-session',url:base,httpOnly:true}]);
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url()),p=u.pathname;
   if(u.origin!==base)return route.abort();
   if(!p.startsWith('/api/'))return p.startsWith('/socket.io/')?route.fulfill({status:503,body:''}):route.continue();
   try{
    let body={},status=200;
    if(p.startsWith('/api/homes/')||p==='/api/users/profile'||p==='/api/users/me'){
     const r=await fetch(fixture+p+u.search,{method:request.method(),headers:{Authorization:'Bearer '+capability.auth_token,'Content-Type':'application/json'},body:request.postData()||undefined,signal:AbortSignal.timeout(30000)});
     body=await r.json();status=r.status;events.push({path:p.replace(/\/token\/[^/]+/,'/token/[redacted]'),method:request.method(),status});
    }else if(p.includes('unread')||p.includes('badge'))body={count:0,unreadCount:0,total:0,byContext:{}};
    else if(p.includes('business'))body={businesses:[],seats:[]};
    else if(p.includes('conversations'))body={conversations:[],hasMore:false};
    await route.fulfill({status,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(body)});
   }catch(error){errors.push(error.name);await route.abort().catch(()=>{});}
  });
  page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.name));
  await page.goto(base+'/invite/'+capability.token,{waitUntil:'domcontentloaded',timeout:120000});
  await expect(page.getByRole('heading',{name:"You're Invited!",exact:true})).toBeVisible();await saved('healthy-invitation');
  if(mode==='candidate'){await candidate();return;}
  await control('fault',{action:'preview',kind:'before',persistent:true});await page.reload();
  await expect(page.getByRole('heading',{name:'Invitation Not Found',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/retry|try again/i})).toHaveCount(0);
  const state=await control('state');assert.equal(state.invitations.find(i=>i.id===capability.invitation_id).status,'pending');
  assert(state.events.some(e=>e.event==='unavailable_before_decision'&&e.action==='preview'));
  await saved('temporary-failure-misreported-as-not-found');
  await control('fault',{action:'preview',kind:'clear'});await page.reload();
  await expect(page.getByRole('heading',{name:"You're Invited!",exact:true})).toBeVisible();await saved('same-invitation-after-manual-reload');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({reproduced:true,pending_invitation_preserved:true,missing_retry:true},null,2),{mode:0o600});
  console.log('REPRODUCED: a temporary real invitation-read failure appears as not found with no retry; the unchanged pending invitation loads after manual reload');
 }finally{
  if(page)await page.screenshot({path:path.join(evidence,'final-screen.png'),fullPage:true}).catch(()=>{});
  fs.writeFileSync(path.join(evidence,'events.json'),JSON.stringify({events,errors},null,2),{mode:0o600});await context?.close();
 }
}
main().catch(error=>{fs.writeFileSync(path.join(evidence,'failure.txt'),String(error.stack),{mode:0o600});console.error('Invitation browser journey failed; private diagnostics retained');process.exitCode=1;});
