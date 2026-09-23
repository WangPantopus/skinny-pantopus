// Positive case for a non-owner: grant the lease resident assets.view (then assets.manage too) with a
// HomePermissionOverride, read and upload as them, then remove the overrides. Signed URLs are never printed.
const h = require('./h.cjs');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const ASSET = sql(`select id from "HomeAsset" where home_id='${HOME}' and name='Stream2 RD washer'`);
(async () => {
  const v = await h.login('viewer'); const owner = await h.login('owner');
  const read = async (tag) => {
    const det = await h.api('GET', `/api/mailbox/v2/p3/records/asset/${ASSET}/mail`, v);
    const photos = (det.json && det.json.photos) || [];
    let ok = 0; for (const p of photos) { const r = await fetch(p.url); if (r.status === 200) ok += 1; }
    console.log(`${tag}: viewer detail ${det.status}, photos ${photos.length}, signed URLs that load ${ok}`);
  };
  const up = async (tag) => {
    const fd = new FormData(); fd.append('file', new Blob([fs.readFileSync(__dirname + '/work/t32/washer2.png')], { type: 'image/png' }), 'washer2.png');
    const r = await fetch(h.BASE + `/api/mailbox/v2/p3/records/asset/${ASSET}/photos`, { method: 'POST', headers: { authorization: 'Bearer ' + v.token }, body: fd });
    const j = await r.json().catch(() => null);
    if (j && j.photo) fs.appendFileSync(__dirname + '/work/t32-photo-ids.txt', j.photo.id + '\n');
    console.log(`${tag}: viewer POST photos -> ${r.status} ${j && j.photo ? 'photo ' + j.photo.id.slice(0, 8) : JSON.stringify(j)}`);
  };
  await read('no override'); await up('no override');
  const o1 = sql(`insert into "HomePermissionOverride" (home_id, user_id, permission, allowed, created_by) values ('${HOME}', '${v.id}', 'assets.view', true, '${owner.id}') returning id`).split('\n')[0];
  fs.appendFileSync(__dirname + '/work/t32-override-ids.txt', o1 + '\n');
  await read('override assets.view'); await up('override assets.view');
  const o2 = sql(`insert into "HomePermissionOverride" (home_id, user_id, permission, allowed, created_by) values ('${HOME}', '${v.id}', 'assets.manage', true, '${owner.id}') returning id`).split('\n')[0];
  fs.appendFileSync(__dirname + '/work/t32-override-ids.txt', o2 + '\n');
  await up('overrides assets.view + assets.manage'); await read('overrides assets.view + assets.manage');
  sql(`delete from "HomePermissionOverride" where id in ('${o1}', '${o2}')`);
  await read('overrides removed');
  console.log(`overrides left for the viewer on the fixture Home: ${sql(`select count(*) from "HomePermissionOverride" where home_id='${HOME}' and user_id='${v.id}'`)}`);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
