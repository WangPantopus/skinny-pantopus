#!/usr/bin/env node
// Installed native UI -> production Home/Place HTTP/services -> owned SQL.
// Identity, list/dashboard shell and unrelated provider responses are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const [container,output,portText='18083'] = process.argv.slice(2), port=Number(portText);
assert(path.isAbsolute(output || '') && !output.startsWith(root+'/')); assert(port>=18083 && port<=18089);
const f = require('../db/home-bill-comparison-http-fixture.cjs')(container);
const { actor,home,sql,q } = f;
const express = require(path.join(root,'backend/node_modules/express'));
const app=express(); app.use(express.json());
const token='pantopus-synthetic-bill-ui-loopback-only', email='bill-ui@example.com';
const stamp='2026-09-11T12:00:00Z';
const user={id:actor,email,username:'bill_ui_fixture',name:'Bill UI Fixture',firstName:'Bill',lastName:'Fixture',
  accountType:'personal',account_type:'personal',role:'user',verified:true,createdAt:stamp,updatedAt:stamp};
const homeRow={id:home,owner_id:actor,name:'Bill UI Fixture',address:'1 Synthetic Street',city:'Test',state:'WA',zipcode:'98607',
  home_type:'house',isOwner:true,isOccupant:true,ownership_status:'verified',is_primary_owner:true};
let initialized=false,server,mode='current',events=[],periods,holdCurrency=null,pendingBillReply=null;
const state=()=>({home_id:home,mode,periods,events,held:!!pendingBillReply});
function reset(){ pendingBillReply?.cancel();pendingBillReply=null;holdCurrency=null;if(initialized)f.cleanup(); periods=f.setup(); initialized=true;mode='current';events=[]; }
const access=()=>{
  const a=JSON.parse(sql(`SELECT public.home_effective_access(${q(home)},${q(actor)});`));
  return {hasAccess:a.has_access,is_owner:a.is_owner,isOwner:a.is_owner,role_base:a.role_base,
    effective_role_base:a.effective_role_base,permissions:a.permissions};
};
app.use(async(req,res,next)=>{
  const p=req.path,m=req.method; res.set('Cache-Control','private, no-store');
  try{
    if(p==='/fixture/state' && m==='GET')return res.json(state());
    if(p==='/fixture/reset' && m==='POST'){reset();return res.json(state());}
    if(p==='/fixture/hold-currency' && m==='POST'){assert(/^[A-Z]{3}$/.test(req.body.currency));holdCurrency=req.body.currency;return res.json(state());}
    if(p==='/fixture/release-read' && m==='POST'){const pending=pendingBillReply;pendingBillReply=null;pending?.send();return res.json(state());}
    if(p==='/fixture/history' && m==='POST'){
      const rows=[];
      for(let month=0;month<24;month++) for(let index=0;index<f.homes.length;index++) {
        rows.push(`(${q(f.id(2000+month*10+index))},${q(f.homes[index])},${q(actor)},'electric',${(index===0?137.25:100.50)+month},'USD','paid',(date_trunc('month',CURRENT_DATE)-interval '${month} months')::date)`);
      }
      sql(`BEGIN; DELETE FROM public."HomeBill" WHERE home_id IN(${f.homes.map(q)}) AND currency='USD';
        INSERT INTO public."HomeBill"(id,home_id,created_by,bill_type,amount,currency,status,period_start) VALUES ${rows.join(',')}; COMMIT;`);
      periods={...periods,oldest:f.month(23),latest:f.month(0)};events.push({event:'history',months:24});return res.json(state());
    }
    if(p==='/fixture/mode' && m==='POST'){
      assert(['current','error','malformed','legacy','wrong_currency','empty','optout','unmatched','denied'].includes(req.body.mode));
      mode=req.body.mode;
      sql(`BEGIN; DELETE FROM public."HomePermissionOverride" WHERE home_id=${q(home)};
        UPDATE public."HomePreference" SET settings=jsonb_set(settings,'{bill_benchmark_opt_in}',${mode==='optout'?"'false'":"'true'"}) WHERE home_id=${q(home)};
        UPDATE public."HomeBill" SET status=CASE WHEN id=${q(f.bills[13])} OR (${q(mode)}='empty' AND home_id=${q(home)}) THEN 'due' ELSE 'paid' END WHERE home_id IN(${f.homes.map(q)});
        UPDATE public."HomeBill" SET period_start=${q((mode==='unmatched'?periods.previous:periods.current)+'-01')} WHERE home_id IN(${f.homes.slice(1).map(q)}); COMMIT;`);
      if(mode==='denied')sql(`INSERT INTO public."HomePermissionOverride"(home_id,user_id,permission,allowed) VALUES(${q(home)},${q(actor)},'finance.view',false);`);
      events.push({event:'mode',mode});return res.json(state());
    }
    if(p==='/api/users/login' && m==='POST'){
      assert.equal(req.body.email,email);assert.equal(req.body.password,'synthetic-loopback-only');
      events.push({event:'signed_in'});return res.json({user,accessToken:token,refreshToken:token+'-refresh',expiresIn:86400,
        sessionId:'local-bill-native',session:{id:'local-bill-native',context:'interactive'}});
    }
    if(p.startsWith('/api/') && req.headers.authorization!=='Bearer '+token)return res.status(401).json({error:'Synthetic sign-in required'});
    if(m==='GET' && p===`/api/homes/${home}/bill-trends`){
      const started=Date.now(), requestMode=mode;
      res.once('finish',()=>events.push({event:'bill_response',currency:req.query.currency,mode:requestMode,status:res.statusCode,duration_ms:Date.now()-started}));
      events.push({event:'bill_read',format:req.query.format,currency:req.query.currency,mode});
      if(mode==='error')return res.status(503).json({error:'Synthetic unavailable current bill service'});
      const json=res.json.bind(res);res.json=body=>{
        if(mode==='malformed')body={...body,bills_by_type:{electric:{months:[periods.current],amounts:[]}}};
        if(mode==='legacy')body={...body,format_version:1};
        if(mode==='wrong_currency')body={...body,currency:'CAD'};
        if(holdCurrency===req.query.currency){
          holdCurrency=null;events.push({event:'bill_held',currency:req.query.currency});
          const pending={send:()=>json(body),cancel:()=>res.destroy()};pendingBillReply=pending;
          res.once('close',()=>{if(pendingBillReply===pending)pendingBillReply=null;});return res;
        }
        return json(body);
      };return next();
    }
    if(m==='GET' && ['/me','/iam/me','/health-score','/seasonal-checklist','/property-value'].some(s=>p===`/api/homes/${home}`+s))return next();
    if(m==='GET'){
      if(['/api/users/profile','/api/users/me'].includes(p))return res.json({user,...user});
      if(p==='/api/hub')return res.json({user,context:{activeHomeId:home,activePersona:{type:'personal'}},
        availability:{hasHome:true,hasBusiness:false,hasPayoutMethod:false},homes:[],businesses:[],
        setup:{steps:[],allDone:true,profileCompleteness:{score:100,checks:{firstName:true,lastName:true,photo:false,bio:false,skills:false},missingFields:[]}},
        statusItems:[],cards:{personal:{unreadChats:0,earnings:0,gigsNearby:0,rating:0,reviewCount:0}},jumpBackIn:[],activity:[]});
      if(p==='/api/homes'||p.endsWith('/my-homes'))return res.json({homes:[homeRow]});
      if(p==='/api/homes/primary')return res.json({home:homeRow});
      if(p===`/api/homes/${home}`)return res.json({home:homeRow});
      if(p===`/api/homes/${home}/dashboard`)return res.json({home:homeRow,myAccess:access(),members:[],tasks:[],bills:[],issues:[],packages:[],events:[],documents:[]});
      if(p.endsWith('/unread-count'))return res.json({count:0,unread_count:0,unreadCount:0});
      if(p==='/api/notifications')return res.json({notifications:[],unreadCount:0,pagination:{page:1,totalPages:0,total:0}});
      if(p.includes('/claims'))return res.json({claims:[]});
    }
    return res.status(404).json({error:'Not part of the synthetic native bill fixture'});
  }catch(error){ events.push({event:'fixture_error',message:error.message});return res.status(500).json({error:error.message}); }
});
app.use(f.app);
reset();server=app.listen(port,'127.0.0.1',()=>console.log('Owned native bill fixture listening on loopback; production HTTP and SQL'));
let stopping=false;
async function stop(){if(stopping)return;stopping=true;fs.writeFileSync(output,JSON.stringify(state(),null,2),{mode:0o600});
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});f.cleanup();f.restoreModules();console.log('PASS: exact native bill fixture SQL cleanup');}
process.on('SIGINT',()=>stop().catch(()=>{process.exitCode=1;}));
process.on('SIGTERM',()=>stop().catch(()=>{process.exitCode=1;}));
