// Records link/unlink authorization probe. The owner links household mail to their asset (legitimate);
// an outsider (no Home) links their own mail to the owner's asset and unlinks the owner's link.
const { login, api } = require('./h.cjs');
const fs = require('fs');
const P3 = '/api/mailbox/v2/p3';
(async () => {
  const label = process.argv[2] || 'run';
  const [mOut, mHome] = fs.readFileSync(__dirname + '/work/probe-mail-ids.txt', 'utf8').split('\n').filter(l => /^[0-9a-f-]{36}$/.test(l));
  const assetId = fs.readFileSync(__dirname + '/.asset-probe-id', 'utf8').trim();
  const owner = await login('owner'); const outsider = await login('outsider');
  const s = (r) => JSON.stringify(r.json && (r.json.link ? { link: r.json.link.id.slice(0, 8) } : r.json.asset ? { mail: (r.json.mail || []).map(m => m.subject) } : r.json));
  console.log(`# records link/unlink probe (${label}) ${new Date().toISOString()}`);
  const own = await api('POST', `${P3}/records/link`, owner, { mailId: mHome, assetId, linkType: 'manual' });
  console.log('owner POST /records/link (household mail -> own asset)', own.status, s(own));
  const inj = await api('POST', `${P3}/records/link`, outsider, { mailId: mOut, assetId, linkType: 'manual' });
  console.log('outsider POST /records/link (own mail -> owner\'s asset)', inj.status, s(inj));
  const steal = await api('POST', `${P3}/records/link`, outsider, { mailId: mHome, assetId, linkType: 'receipt' });
  console.log('outsider POST /records/link (household mail -> owner\'s asset)', steal.status, s(steal));
  const detail1 = await api('GET', `${P3}/records/asset/${assetId}/mail`, owner);
  console.log('owner GET /records/asset/:id/mail', detail1.status, s(detail1));
  const ownLink = own.json?.link?.id;
  const del = ownLink ? await api('DELETE', `${P3}/records/unlink/${ownLink}`, outsider) : { status: 'skip', json: null };
  console.log('outsider DELETE /records/unlink/<owner link>', del.status, JSON.stringify(del.json));
  const detail2 = await api('GET', `${P3}/records/asset/${assetId}/mail`, owner);
  console.log('owner GET /records/asset/:id/mail (after outsider unlink)', detail2.status, s(detail2));
  const ownDel = ownLink ? await api('DELETE', `${P3}/records/unlink/${ownLink}`, owner) : { status: 'skip' };
  console.log('owner DELETE /records/unlink/<own link>', ownDel.status);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
