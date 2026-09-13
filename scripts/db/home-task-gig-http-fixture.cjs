// Isolated SQL-backed HTTP fixture shared by API and installed browser journeys.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
module.exports = function createFixture(container, database, prefix = 'ddf22000') {
assert.match(prefix, /^ddf[0-9]{5}$/);
assert.match(container || '', /^supabase_db_pantopus-home-gig-[a-z0-9_-]+$/);
assert.match(database || '', /^(postgres|[a-z0-9_]+_contract)$/);
const id = n => `${prefix}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actor=id(1), other=id(2), home=id(100), literal=v=>`'${String(v).replaceAll("'","''")}'`;
function sql(query) {
  return execFileSync('docker',['exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],
    {input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
}
const rpc = (name,args) => {
  assert.match(name,/^[a-z_]+$/);
  const params=Object.entries(args).map(([key,value])=>{
    assert.match(key,/^p_[a-z_]+$/);
    return `${key} => ${value===null?'NULL':literal(typeof value==='object'?JSON.stringify(value):value)}`;
  });
  return JSON.parse(sql(`SET ROLE service_role; SELECT public.${name}(${params.join(',')})::text; RESET ROLE;`));
};
let loseReply=false, publishEvents=0;
const db={from:table=>{
  assert.equal(table,'Gig');
  return {insert:payload=>({select:()=>({single:async()=>{
    const keys=Object.keys(payload);keys.forEach(key=>assert.match(key,/^[a-z_]+$/));
    const row=JSON.parse(sql(`SET ROLE service_role; WITH inserted AS (
      INSERT INTO public."Gig"(${keys.join(',')}) SELECT ${keys.map(key=>'g.'+key).join(',')}
      FROM jsonb_populate_record(NULL::public."Gig",${literal(JSON.stringify(payload))}::jsonb) g RETURNING *)
      SELECT to_jsonb(inserted)::text FROM inserted; RESET ROLE;`));
    return {data:row,error:null};
  }})})};
},rpc:async(name,args)=>{
  const data=rpc(name,args);
  if(name==='publish_home_task_gig' && data.ok && loseReply){loseReply=false;throw new Error('Synthetic lost committed reply');}
  return {data,error:null};
}};
const load=Module._load;
const express=require(path.join(root,'backend/node_modules/express'));
const scope=require(path.join(root,'backend/utils/requestSessionScope'));
Module._load=function(request,parent,isMain){
  if(parent?.filename.endsWith('/services/homeTaskGigService.js') && request==='../config/supabaseAdmin')return db;
  if(parent?.filename.endsWith('/routes/gigs.js')){
    if(request==='../config/supabaseAdmin')return db;
    if(request==='../middleware/verifyToken')return (req,res,next)=>{
      req.user={id:req.headers['x-fixture-actor']||actor};req.session={id:'local-task-gig-acceptance'};next();
    };
    if(request==='../middleware/optionalAuth')return (req,res,next)=>next();
    const real=['express','joi','../middleware/validate','../services/homeTaskGigService','../utils/requestSessionScope','../utils/moduleSchemas'];
    if(!real.includes(request)){
      if(request==='../services/gig/browseCacheService')return {invalidateNear:()=>{publishEvents++;}};
      if(request==='../services/savedSearchAlertService')return {alertMatchingSavedSearches:async()=>{}};
      if(request==='../utils/logger')return {info:()=>{},warn:()=>{},error:()=>{}};
      return {};
    }
  }
  return load.call(this,request,parent,isMain);
};
const router=require(path.join(root,'backend/routes/gigs'));
const service=require(path.join(root,'backend/services/homeTaskGigService'));
Module._load=load;
const app=express();app.use(express.json());app.use('/api/gigs',router);
return {id,actor,other,home,literal,sql,rpc,scope,app,service,
  loseNextReply:()=>{loseReply=true;}, publicationEvents:()=>publishEvents};
};
