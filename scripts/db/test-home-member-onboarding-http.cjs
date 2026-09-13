#!/usr/bin/env node
// Shipped member/tenant and bare-member invitation admission,
// followed by current Home/Task HTTP -> production service -> local SDK/SQL.
// Run against a fresh, exclusively owned member-onboarding UI fixture. This
// baseline mode expects the unresolved Task permission denial; member-tasks
// exercises deliberate candidate first use. Shipped UI acceptance is separate.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const [fixture,capabilityFile,container,output,mode='baseline']=process.argv.slice(2);
assert(['baseline','member-tasks'].includes(mode));const candidate=mode==='member-tasks';
const root=path.resolve(__dirname,'../..');
assert.match(fixture||'',/^http:\/\/127\.0\.0\.1:1808[3-9]$/);
assert.match(container||'',/^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert(path.isAbsolute(output||'')&&!output.startsWith(root+'/'));
fs.mkdirSync(output,{recursive:true,mode:0o700});
const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2),{flag:'wx',mode:0o600});
const caps=JSON.parse(fs.readFileSync(capabilityFile,'utf8')), {home,actors}=caps;
assert.equal(caps.home_name,'Member first use fixture');assert.equal(caps.capabilities.length,0);assert.equal(actors.length,6);
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const sql=query=>JSON.parse(execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],
  {input:'BEGIN READ ONLY;'+query+'ROLLBACK;',encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:20000}).trim());
const events=[],scopes=new Map(),results=[],memberTasks=[];
async function request(route,index=0,method='GET',body) {
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+actors[index].auth_token};
  if(scopes.has(index))headers['x-pantopus-session-scope']=scopes.get(index);
  const r=await fetch(fixture+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const value=await r.json();events.push({route:route.replace(/\/token\/[^/]+/,'/token/[redacted]'),index,method,status:r.status,code:value.code,state:value.state});
  return {status:r.status,body:value};
}
async function control(route,body) {const r=await request('/fixture/'+route,0,body===undefined?'GET':'POST',body);assert.equal(r.status,200);return r.body;}
const state=()=>control('state');
async function main(){
  const initial=await state();assert.equal(initial.tasks.length,0);assert.equal(initial.task_receipts.length,0);assert.equal(initial.memberships.length,1);
  assert.equal(initial.policy_mode,mode);
  assert.equal(initial.claim_count,0);assert.equal(initial.ownership_claim_count,0);assert.equal(initial.ownership.length,1);assert.equal(initial.ownership[0].subject_id,actors[0].id);
  const policy=sql(`SELECT jsonb_build_object('role_rows',(SELECT jsonb_agg(to_jsonb(r) ORDER BY role_base,permission) FROM public."HomeRolePermission"r),
    'preset_rows',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY key),'[]') FROM public."HomeRolePreset"r),
    'member_policy',public.home_invite_policy('member',NULL),'tenant_policy',public.home_invite_policy('member','tenant'));`);
  save('candidate-policy.json',policy);
  assert.equal(policy.preset_rows.length,0,'Baseline needs inspection if retained preset policy changes');
  assert(policy.role_rows.some(r=>r.role_base==='member'&&r.permission==='home.view'&&r.allowed));
  for(const permission of ['tasks.view','tasks.edit'])assert.equal(policy.role_rows.some(r=>r.role_base==='member'&&r.permission===permission&&r.allowed),candidate);
  assert(!policy.role_rows.some(r=>r.role_base==='member'&&r.permission==='tasks.manage'&&r.allowed));
  for(const index of [0,1,2]) {const r=await request('/api/homes/invitations/sender/session',index);assert.equal(r.status,200);assert.equal(r.body.session.actor_id,actors[index].id);scopes.set(index,r.body.session.session_scope);}
  // A legitimate owner control record proves the actual Task gateway is live,
  // without granting the ordinary invitee any permission in fixture setup.
  const ownerList=await request(`/api/homes/${home}/tasks`);assert.equal(ownerList.status,200);assert.equal(ownerList.body.collection_capabilities.can_create,true);
  const ownerOriginal={request_id:crypto.randomUUID(),title:'Existing household control',description:'Owned synthetic Task',task_type:'chore'};
  await control('fault',{action:'task_create',kind:'after'});
  assert.equal((await request(`/api/homes/${home}/tasks`,0,'POST',ownerOriginal)).status,503);
  const recovered=await request(`/api/homes/${home}/tasks`,0,'POST',ownerOriginal);assert.equal(recovered.status,200);assert.equal(recovered.body.replayed,true);
  const task=recovered.body.task;assert.equal(task.visibility,'members');assert.equal(task.created_by,actors[0].id);
  assert.equal((await request(`/api/homes/${home}/tasks/${task.id}`)).status,200);
  for(const suffix of ['recurrence','gig-publication'])assert.equal((await request(`/api/homes/${home}/tasks/${task.id}/${suffix}`)).status,200);
  const ownerMedia=await request(`/api/upload/home-task-media/${home}/${task.id}`);assert.equal(ownerMedia.status,200);assert.deepEqual(ownerMedia.body.media,[]);
  const taskSnapshot=sql(`SELECT jsonb_build_object('tasks',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public."HomeTask"t WHERE home_id=${q(home)}),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM public."HomeTaskCreateReceipt"r WHERE home_id=${q(home)}));`);
  for(const [index,preset] of [[1,'tenant'],[2,null]]) {
    const payload={email:actors[index].email,relationship:'member',...(preset?{preset_key:preset}:{})};
    const intent={action:'create',home_id:home,payload};
    const prepared=await request('/api/homes/invitations/sender/context',0,'POST',intent);assert.equal(prepared.status,200);
    const original={request_id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('hex'),...intent,decision_token:prepared.body.decision_token};
    const created=await request('/api/homes/invitations/sender/commands',0,'POST',original);assert.equal(created.status,201);assert.equal(created.body.state,'completed');
    const dynamic=await control('capabilities');assert(dynamic.capabilities.some(c=>c.actor_id===actors[index].id&&c.sender_request_id===original.request_id&&c.token===original.token));
    const review=await request(`/api/homes/invitations/token/${original.token}/decision-context`,index);assert.equal(review.status,200);
    const accepted=await request('/api/homes/invitations/decisions',index,'POST',{request_id:crypto.randomUUID(),token:original.token,
      home_id:home,invitation_id:created.body.invitation_id,action:'accept',decision_token:review.body.decision_token});
    assert.equal(accepted.status,201);assert.equal(accepted.body.state,'completed');assert.equal(accepted.body.current_access,'not_checked');
    const list=await request('/api/homes/my-homes',index);assert.equal(list.status,200);
    const claims=await request('/api/homes/my-ownership-claims',index);assert.equal(claims.status,200);assert.deepEqual(claims.body.claims,[]);assert.equal(claims.body.upload_session.actor_id,actors[index].id);
    const card=list.body.homes.find(h=>h.id===home);assert(card);assert.equal(card.role_base,'member');assert.equal(card.access_kind,'shared');
    assert.equal(card.occupancy.verification_status,'verified');assert.equal(card.ownership_status,null);assert.equal(card.verification_tier,null);
    const detail=await request(`/api/homes/${home}`,index);assert.equal(detail.status,200);save('member-'+index+'-home.json',{list:list.body,detail:detail.body});
    const denied=[];
    if(!candidate) {
      for(const [route,method,body] of [[`/tasks`,'GET'],[`/tasks/${task.id}`,'GET'],[`/tasks`,'POST',{request_id:crypto.randomUUID(),title:'Ordinary first Task',task_type:'chore'}],
        [`/tasks/${task.id}`,'PUT',{status:'done'}]]) {
        const r=await request(`/api/homes/${home}${route}`,index,method,body);assert.equal(r.status,403);assert.equal(r.body.code,'HOME_RECORD_DENIED');denied.push({route,method,code:r.body.code});
      }
    } else {
      const collection=await request(`/api/homes/${home}/tasks`,index);assert.equal(collection.status,200);assert.equal(collection.body.collection_capabilities.can_create,true);
      const existing=await request(`/api/homes/${home}/tasks/${task.id}`,index);assert.equal(existing.status,200);assert.equal(existing.body.task.capabilities.can_edit,false);
      const otherEdit=await request(`/api/homes/${home}/tasks/${task.id}`,index,'PUT',{title:'Unauthorized other creator edit'});
      assert.equal(otherEdit.status,403);assert.equal(otherEdit.body.code,'HOME_RECORD_WRITE_DENIED');
      const ownOriginal={request_id:crypto.randomUUID(),title:'Ordinary first Task '+index,description:'Household members audience',task_type:'chore'};
      await control('fault',{action:'task_create',kind:'after'});assert.equal((await request(`/api/homes/${home}/tasks`,index,'POST',ownOriginal)).status,503);
      const committed=(await state()).tasks.filter(t=>t.created_by===actors[index].id);assert.equal(committed.length,1);
      await control('fault',{action:'task_read',kind:'before'});assert.equal((await request(`/api/homes/${home}/tasks/${committed[0].id}`,index)).status,503);
      const retried=await request(`/api/homes/${home}/tasks`,index,'POST',ownOriginal);assert.equal(retried.status,200);assert.equal(retried.body.replayed,true);
      assert.equal(retried.body.task.id,committed[0].id);assert.equal(retried.body.task.visibility,'members');assert.equal(retried.body.creation_receipt.request_id,ownOriginal.request_id);
      assert.equal((await request(`/api/homes/${home}/tasks`,index,'POST',{...ownOriginal,title:'Changed original'})).status,409);
      const ownId=retried.body.task.id;
      const media=await request(`/api/upload/home-task-media/${home}/${ownId}`,index);assert.equal(media.status,200);assert.deepEqual(media.body.media,[]);assert.equal(media.body.can_upload,true);
      assert.equal((await request(`/api/homes/${home}/tasks/${ownId}`,index,'PUT',{description:'Edited after current read'})).status,200);
      const completed=await request(`/api/homes/${home}/tasks/${ownId}`,index,'PUT',{status:'done'});assert.equal(completed.status,200);assert.equal(completed.body.task.status,'done');assert(completed.body.task.completed_at);
      const saved=(await state()).tasks.find(t=>t.id===ownId);
      for(const [scenario,code] of [['deny_tasks_edit','HOME_RECORD_WRITE_DENIED'],['deny_tasks_view','HOME_RECORD_DENIED'],['remove','HOME_RECORD_DENIED']]) {
        await control('member-scenario',{index,mode:scenario});
        const listNow=await request(`/api/homes/${home}/tasks`,index);assert.equal(listNow.status,scenario==='deny_tasks_edit'?200:403);
        if(scenario==='deny_tasks_edit')assert.equal(listNow.body.collection_capabilities.can_create,false);
        const deniedRetry=await request(`/api/homes/${home}/tasks`,index,'POST',ownOriginal);assert.equal(deniedRetry.status,403);assert.equal(deniedRetry.body.code,code);
        assert.deepEqual((await state()).tasks.find(t=>t.id===ownId),saved);
        await control('member-scenario',{index,mode:'restore'});assert.equal((await request(`/api/homes/${home}/tasks/${ownId}`,index)).status,200);
      }
      const resumed=await request(`/api/homes/${home}/tasks`,index,'POST',ownOriginal);assert.equal(resumed.status,200);assert.equal(resumed.body.replayed,true);
      memberTasks.push({index,id:ownId,request_id:ownOriginal.request_id});
    }
    const current=await state();const membership=current.memberships.find(m=>m.user_id===actors[index].id);
    assert.equal(membership.role_base,'member');assert.equal(membership.verification_status,'verified');assert.equal(membership.is_active,true);
    assert.equal(current.claim_count,0);assert.equal(current.ownership_claim_count,0);assert.equal(current.ownership.length,1);
    const access=current.member_access.find(a=>a.actor_id===actors[index].id).access;
    assert.deepEqual(access.permissions,candidate?['home.view','tasks.edit','tasks.view']:['home.view']);
    const admitted=sql(`SELECT jsonb_build_object('invitation',(SELECT to_jsonb(i)-'token'-'token_hash' FROM public."HomeInvite"i WHERE id=${q(created.body.invitation_id)}),
      'occupancy',(SELECT to_jsonb(o) FROM public."HomeOccupancy"o WHERE home_id=${q(home)} AND user_id=${q(actors[index].id)}),
      'overrides',(SELECT coalesce(jsonb_agg(to_jsonb(o)),'[]') FROM public."HomePermissionOverride"o WHERE home_id=${q(home)} AND user_id=${q(actors[index].id)}));`);
    assert.equal(admitted.overrides.length,0);save('member-'+index+'-admission.json',admitted);
    results.push({kind:preset?'browser_member_tenant':'native_bare_member',admitted:true,role:'member',preset,
      shared_home:true,occupancy_verification:'verified',residency_claims:0,ownership_claims:0,own_ownership_records:0,task_denials:denied,
      ...(candidate?{created_read_edited_completed:true,lost_reply_recovered_once:true,current_denies_preserved:true}: {})});
  }
  const currentControl=sql(`SELECT jsonb_build_object('tasks',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public."HomeTask"t WHERE home_id=${q(home)} AND created_by=${q(actors[0].id)}),
    'receipts',(SELECT jsonb_agg(to_jsonb(r) ORDER BY request_id) FROM public."HomeTaskCreateReceipt"r WHERE home_id=${q(home)} AND actor_user_id=${q(actors[0].id)}));`);
  assert.deepEqual(currentControl,taskSnapshot);
  if(candidate) {
    const own=memberTasks[0];assert.equal((await request(`/api/homes/${home}/tasks/${own.id}`,1,'PUT',{assigned_to:actors[2].id,status:'open'})).status,200);
    assert.equal((await request(`/api/homes/${home}/tasks/${own.id}`,2,'PUT',{title:'Assignee content edit'})).status,403);
    assert.equal((await request(`/api/homes/${home}/tasks/${own.id}`,2,'PUT',{status:'canceled'})).status,403);
    assert.equal((await request(`/api/homes/${home}/tasks/${own.id}`,2,'PUT',{status:'done'})).status,200);
    for(const visibility of ['managers','sensitive']) {
      const created=await request(`/api/homes/${home}/tasks`,0,'POST',{request_id:crypto.randomUUID(),title:'Restricted '+visibility+' Task',visibility});assert.equal(created.status,201);
      for(const index of [1,2])assert.equal((await request(`/api/homes/${home}/tasks/${created.body.task.id}`,index)).status,404);
    }
    const source=await control('member-private-source',{});assert.equal((await request(`/api/homes/${home}/tasks/${source.task_id}`)).status,200);
    for(const index of [1,2])assert.equal((await request(`/api/homes/${home}/tasks/${source.task_id}`,index)).status,404);
    for(const own of memberTasks) {
      const posts=(await state()).events.filter(e=>e.event==='request'&&e.actor===own.index&&e.path===`/api/homes/${home}/tasks`&&e.method==='POST'&&e.request_id===own.request_id);
      assert.equal(posts.length,7);assert.equal(new Set(posts.filter((_,index)=>index!==2).map(e=>e.request_hash)).size,1);
    }
  }
  await control('member-scenario',{index:1,mode:'deny_home_view'});assert(!(await request('/api/homes/my-homes',1)).body.homes.some(h=>h.id===home));
  await control('member-scenario',{index:1,mode:'restore'});assert((await request('/api/homes/my-homes',1)).body.homes.some(h=>h.id===home));
  await control('member-scenario',{index:1,mode:'remove'});assert(!(await request('/api/homes/my-homes',1)).body.homes.some(h=>h.id===home));
  await control('member-scenario',{index:1,mode:'restore'});assert((await request('/api/homes/my-homes',1)).body.homes.some(h=>h.id===home));
  const final=await state();assert.equal(final.tasks.length,candidate?6:1);assert.equal(final.task_receipts.length,candidate?5:1);assert.equal(final.sender_commands.length,2);assert.equal(final.commands.length,2);
  const taskRequests=final.events.filter(e=>e.event==='request'&&e.path===`/api/homes/${home}/tasks`&&e.method==='POST'&&e.actor===0);
  assert.equal(taskRequests.length,candidate?4:2);assert.equal(taskRequests[0].request_id,taskRequests[1].request_id);assert.equal(taskRequests[0].request_hash,taskRequests[1].request_hash);
  save('final-state.json',final);save('http-events.json',events);save('result.json',{pass:true,mode,expected_unresolved_task_denial:!candidate,
    owner_gateway_control:{lost_reply_recovered_once:true,metadata_reads:true,visibility:'members'},results,
    limits:['Synthetic authentication and controlled delivery','HTTP/SDK/SQL baseline; shipped UI acceptance separate','No positive fixture grants','No deployment or residency verification claim']});
  console.log(candidate?'PASS: both ordinary member invitations reach real household Tasks, exact lost-reply recovery, edits/completion, current denial/recovery and visibility/source privacy.'
    :'PASS: both ordinary invitation variants admit canonical members; current Home access succeeds; all 8 Task operations deny without mutation. Owned Task gateway and exact lost-reply control verified.');
}
main().catch(error=>{save('failure.txt',{error:String(error.stack),events});console.error('Ordinary member baseline failed; private diagnostics retained. Fixture must be stopped and exact cleanup checked.');process.exitCode=1;});
