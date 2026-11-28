'use strict';
const fs=require('node:fs'), path=require('node:path'), zlib=require('node:zlib');
const [data, repo] = process.argv.slice(2);
if (!data || !repo) throw new Error('Expected private input directory and Pantopus checkout');
const root=path.resolve(data), pkg=path.resolve(repo, 'backend'), snapshot=path.join(root,'snapshots');
if (root.startsWith(path.resolve(repo) + path.sep) || root===path.resolve(repo)) throw new Error('Use a private directory outside Git');
const read=(p)=>JSON.parse(fs.readFileSync(p,'utf8'));
const jsonl=(p)=>fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
process.env.NODE_ENV='production'; process.env.PROPERTY_RECORDS_MANIFEST_URL='file://'+snapshot;process.env.PROPERTY_RECORDS_SWITCHES='production';process.env.PROPERTY_RECORDS_LIVE_JURISDICTIONS='';process.env.PROPERTY_RECORDS_SHADOW_JURISDICTIONS='';
require(pkg+'/utils/logger').silent=true;
const {parse,city,zip5}=require(pkg+'/services/propertyRecords/addressKey');
const router=require(pkg+'/services/propertyRecords/router'),{lookup}=require(pkg+'/services/propertyRecords');
const {addressSuppressed,parcelSuppressed}=require(pkg+'/services/propertyRecords/suppressions');
const fips='25025', policy=read(path.join(snapshot,'suppressions.json')), county=read(path.join(snapshot,'states/MA.json')).jurisdictions[fips], reg=read(path.join(snapshot,'registry/states/MA.json')).jurisdictions[fips];
function *blocks(dir) {
 const m=JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/manifest.json.gz'))), b=fs.readFileSync(dir+'/data.bin');let off=0;
 for(const len of m.lengths){yield* JSON.parse(zlib.gunzipSync(b.subarray(off,off+len)));off+=len;}if(off!==b.length) throw Error('invalid index length');
}
const key=(a,z)=>a?JSON.stringify([a.number,a.pre,a.name,a.suffix,a.post,a.building||'',a.urbanization||'',a.unit||'',z].map(v=>v||'')):'';
const many=(m,k,v)=>{if(!m.has(k))m.set(k,[]);m.get(k).push(v)};
const q=(number,suffix,street,unit,whichCity,z)=>({line1:number.trim()+suffix.trim()+' '+street.trim(),unit,city:whichCity,state:'MA',zip:zip5(z)});
const canon=(a)=>key(parse(a.line1,a.unit,{state:'MA',zip:a.zip}),a.zip);
const registry=new Map();for(const r of blocks(path.join(snapshot,'registry/releases',fips,reg.release))){if(r.kind==='unit')many(registry,key(r.address,r.address.zip),city(r.address.city))}
const rosterByID=new Map(), rosterByKey=new Map(), exact=new Set();
for(const row of jsonl(path.join(data,'city-units.ndjson'))){
 const a=q(row.street_number,'',row.street,row.unit,row.city,row.zip), id=row.pid+'|'+row.unit, k=canon(a);
 const cities=new Set([city(row.city),city(row.neighborhood)].filter(Boolean));
 many(rosterByID,id,{k,cities});many(rosterByKey,k,id);
}
for(const [id,sites] of rosterByID){
 const conflicting=sites.some(({k,cities})=>new Set(rosterByKey.get(k)).size>1||(registry.get(k)||[]).filter(x=>cities.has(x)).length>1);
 if(!conflicting&&sites.some(({k,cities})=>(registry.get(k)||[]).filter(x=>cities.has(x)).length===1))exact.add(id);
}
const exportsByKey=new Map();
for(const r of jsonl(path.join(root,'export-sites.ndjson'))){const query=q(r.street_number,r.street_number_suffix,r.street_name,r.apt_unit,r.city,r.location_zip_code);many(exportsByKey,canon(query),r.parcel_id)}
const cand=jsonl(path.join(root,'candidate-2027.ndjson')), maps=read(path.join(root,'child-map.json')), ids=new Set(cand.map(r=>r.child));const priorIDs=new Set();
for(const r of blocks(path.join(snapshot,'releases',fips,county.release))){if(ids.has(r.facts?.parcel_number))priorIDs.add(r.facts.parcel_number)}
const counts={roster:rosterByID.size,registryExact:exact.size,priorParcelIDs:priorIDs.size}, tally=(k,b)=>{counts[k]=(counts[k]||0)+Number(!!b)};
const rows=[];
(async()=>{
 for(let i=0;i<100&&!router.switchesKnown();i++)await new Promise(r=>setTimeout(r,50));
 if(router.municipalityFor(fips)!=='BOSTON')throw Error('wrong gate');
 for(const a of cand){
 const query=q(a.number,a.numberSuffix,a.street,a.unit,a.city,a.zip), k=canon(query), id=a.parent+'|'+a.unit;
 const sites=rosterByID.get(id)||[], matching=sites.filter(v=>v.k===k&&v.cities.has(city(a.city)));
 const m=maps[a.child], mc=m?.length===1&&m[0], mapsAgree=mc&&mc.master_parcel_id.trim().padStart(10,'0')===a.parent&&canon(q(mc.street_number,mc.street_number_suffix,mc.street_name,mc.apt_unit,a.city,a.zip))===k;
 const parsed=parse(query.line1,query.unit,{state:'MA',zip:query.zip});
 const pa={...parsed,unit:''}, protectedHit=addressSuppressed(policy,fips,parsed)||addressSuppressed(policy,fips,pa)||[a.parent,a.child].some(p=>parcelSuppressed(policy,fips,p));
 const exists=(await lookup(query)), prior=exists.match==='exact', collision=new Set(exportsByKey.get(k)||[]).size!==1;
 const hit=(registry.get(k)||[]).filter(c=>matching.some(s=>s.cities.has(c)));
 const props={cohortID:exact.has(id),matchesSAMPhysicalSite:sites.some(v=>v.k===k),matchesSAMSiteAndCity:matching.length>0,exactRegistryAtSite:hit.length===1,twoCityTablesSameSite:!!mapsAgree,protectedHit,existingExact:prior,hasPriorChildID:priorIDs.has(a.child),q1DuplicateSite:collision,ownThree:[a.beds,a.full,a.half].every(Number.isInteger)&&a.beds>0&&a.beds<=20&&a.full>=0&&a.full<=15&&a.half>=0&&a.half<=15&&a.full+a.half/2>0&&a.living>0};
 const joined=props.cohortID&&props.matchesSAMSiteAndCity&&props.exactRegistryAtSite&&props.twoCityTablesSameSite&&!protectedHit&&!prior&&!collision&&!props.hasPriorChildID&&props.ownThree;
 for(const [k,v] of Object.entries(props))tally(k,v);tally('intersection',joined);
 rows.push({...a,props,joined,baselineMatch:exists.match});
 }
 counts.parentsInIntersection=new Set(rows.filter(r=>r.joined).map(r=>r.parent)).size;
 counts.baselineModes=Object.fromEntries([...new Set(rows.map(r=>r.baselineMatch))].map(k=>[k,rows.filter(r=>r.baselineMatch===k).length]));
 fs.writeFileSync(path.join(root,'private-candidate-evidence.ndjson'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n',{mode:0o600});
 fs.writeFileSync(path.join(root,'identity-counts.json'),JSON.stringify(counts,null,2));console.log(counts);
 if(counts.registryExact!==48431)process.exitCode=1;
})().catch(e=>{console.error('failed',e.name);process.exitCode=1});
