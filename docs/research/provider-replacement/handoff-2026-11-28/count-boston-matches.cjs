'use strict';
// Private inputs only. Output is an aggregate. Reuse the exact checkout's street parser.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const [repo, roster, manifestFile, dataFile, candidateFile, matchedFile] = process.argv.slice(2);
if (!dataFile) throw new Error('Expected REPO ROSTER.ndjson MANIFEST.json.gz DATA.bin');
const {parse, city} = require(path.resolve(repo,'backend/services/propertyRecords/addressKey.js'));
const site = (a) => [a.number,a.pre,a.name,a.suffix,a.post,a.zip].map(v=>v||'').join('|');
const cityKeys = new Map();
const subjects = new Map();
for (const line of fs.readFileSync(roster,'utf8').trimEnd().split('\n')) {
  if (!line) continue;
  const r = JSON.parse(line);
  const a = parse(r.street_number+' '+r.street,r.unit,{state:'MA',zip:r.zip});
  if (!a || !a.unit) throw new Error('unparseable official site');
  const key = site({...a,zip:r.zip})+'|'+a.unit;
  const id = r.pid+'|'+r.unit;
  if (!cityKeys.has(key)) cityKeys.set(key,new Set());
  cityKeys.get(key).add(id);
  if (!subjects.has(id)) subjects.set(id,[]);
  subjects.get(id).push({site:site({...a,zip:r.zip}),key,
    cities:new Set([city(r.city),city(r.neighborhood)].filter(Boolean))});
}
const unitKeys = new Map();
const siteCities = new Map();
const manifest = JSON.parse(zlib.gunzipSync(fs.readFileSync(manifestFile)));
const data = fs.readFileSync(dataFile);
let offset = 0;
let records = 0;
for(const length of manifest.lengths) {
  const group = JSON.parse(zlib.gunzipSync(data.subarray(offset,offset+length)));
  offset += length;
  for(const r of group) {
    records++;
    const a = r.address;
    const key = site(a);
    const where = city(a.city);
    if(!siteCities.has(key)) siteCities.set(key,new Set());
    siteCities.get(key).add(where);
    if(r.kind!=='unit' || a.building || a.urbanization) continue;
    const full = key+'|'+a.unit;
    if(!unitKeys.has(full)) unitKeys.set(full,[]);
    unitKeys.get(full).push(where);
  }
}
if(offset!==data.length) throw new Error('manifest and data size disagree');
const counts = {release:manifest.release,registryRowsRead:records,officialUnits:subjects.size,
  exact:0,ambiguous:0,unitKeyCityMismatch:0,siteOnly:0,siteAbsent:0};
for(const entries of subjects.values()) {
  let match=false, conflicting=false, mismatch=false, knownSite=false;
  for(const e of entries) {
    const unitCities = unitKeys.get(e.key)||[];
    const hits = unitCities.filter(c=>e.cities.has(c));
    if(cityKeys.get(e.key).size>1 || hits.length>1) conflicting=true;
    if(hits.length===1) match=true;
    if(unitCities.length && !hits.length) mismatch=true;
    if([...(siteCities.get(e.site)||[])].some(c=>e.cities.has(c))) knownSite=true;
  }
  if(conflicting) counts.ambiguous++;
  else if(match) counts.exact++;
  else if(mismatch) counts.unitKeyCityMismatch++;
  else if(knownSite) counts.siteOnly++;
  else counts.siteAbsent++;
}
if (candidateFile) {
  const probes=fs.readFileSync(candidateFile,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
  const results=[];
  const checked={candidates:probes.length,exactCityAndRegistry:0,noMatchingOfficialSite:0,registryMissingOrContested:0,duplicateChildren:0};
  const seen=new Set();
  for (const c of probes) {
    if (seen.has(c.child)) {checked.duplicateChildren++;continue;}
    seen.add(c.child);
    const a=parse(c.number+(c.numberSuffix||'')+' '+c.street,c.unit,{state:'MA',zip:c.zip});
    if(!a) {checked.noMatchingOfficialSite++;continue;}
    const key=site({...a,zip:c.zip})+'|'+a.unit;
    const entries=(subjects.get(c.parent+'|'+c.unit)||[]).filter(e=>e.key===key && e.cities.has(city(c.city)));
    if(!entries.length) {checked.noMatchingOfficialSite++;continue;}
    const hits=(unitKeys.get(key)||[]).filter(cn=>entries.some(e=>e.cities.has(cn)));
    if(cityKeys.get(key).size!==1 || hits.length!==1) {checked.registryMissingOrContested++;continue;}
    checked.exactCityAndRegistry++;
    results.push(c);
  }
  counts.conversions=checked;
  if(matchedFile) fs.writeFileSync(matchedFile,results.map(r=>JSON.stringify(r)+'\n').join(''),{mode:0o600});
}
console.log(JSON.stringify(counts,null,2));
