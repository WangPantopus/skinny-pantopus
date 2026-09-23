// T38 fixture: two businesses owned by the fixture owner, created through the real POST /api/businesses.
// Then (SQL, synthetic, documented): the bakery is marked document_verified (the admin evidence review can't run
// here), and the editor account joins the bakery's team as a 'viewer' (no mail.send). Ids go to work/t38-*.txt.
const h = require('./h.cjs'); const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const sql = (q) => execFileSync(__dirname + '/psql.sh', ['-Atc', q]).toString().trim();
(async () => {
  const owner = await h.login('owner'); const editor = await h.login('editor');
  const out = {};
  for (const [key, username, name] of [['bakery', 'stream2_t38_bakery', 'Stream2 T38 Verified Bakery'], ['studio', 'stream2_t38_studio', 'Stream2 T38 Unverified Studio']]) {
    const r = await h.api('POST', '/api/businesses', owner, { username, name, email: `${username.replace(/_/g, '-')}@example.com`, business_type: 'for_profit' });
    const id = r.json && r.json.business && r.json.business.id;
    console.log(`owner POST /api/businesses "${name}": ${r.status} ${id ? '<' + id.slice(0, 8) + '>' : JSON.stringify(r.json)}`);
    if (id) { out[key] = id; fs.appendFileSync(__dirname + '/work/t38-business-ids.txt', `${key} ${id}\n`); }
  }
  if (out.bakery) {
    console.log('bakery verification (SQL fixture): ' + sql(`update "BusinessProfile" set verification_status='document_verified', verification_tier='document_verified', verified_at=now() where business_user_id='${out.bakery}' returning verification_status`));
    console.log('editor joins the bakery team as viewer (SQL fixture): ' + sql(`insert into "BusinessTeam" (business_user_id, user_id, role_base, title) values ('${out.bakery}', '${editor.id}', 'viewer', 'Stream2 T38 fixture') returning role_base`));
  }
  console.log('state: ' + sql(`select string_agg(u.name || ' = ' || coalesce(bp.verification_status,'-') || ' / team ' || (select string_agg(bt.role_base::text || (case when bt.user_id='${owner.id}' then '(owner acct)' when bt.user_id='${editor.id}' then '(editor acct)' else '' end), ',') from "BusinessTeam" bt where bt.business_user_id=u.id and bt.is_active), '; ') from "User" u left join "BusinessProfile" bp on bp.business_user_id=u.id where u.username like 'stream2_t38_%'`));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
