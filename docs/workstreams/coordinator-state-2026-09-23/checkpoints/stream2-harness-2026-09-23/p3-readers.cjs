// Phase-3 own-mail readers for the owner (synthetic Mail: one bill delivered today with a warranty key fact,
// one personal postcard delivered one year ago today). Prints no tokens.
const { login, api } = require('./h.cjs');
const HOME = 'f0e51100-0000-4000-8000-000000000200';
const P3 = '/api/mailbox/v2/p3';
(async () => {
  const label = process.argv[2] || 'run';
  const owner = await login('owner');
  const y = new Date().getFullYear();
  console.log(`# phase-3 own-mail readers (${label}) ${new Date().toISOString()}`);
  const s = await api('GET', `${P3}/mailday/summary`, owner);
  console.log('GET /mailday/summary', s.status, JSON.stringify(s.json && { total_new: s.json.total_new, arrivals: (s.json.arrivals || []).map(m => m.subject), needs_attention: (s.json.needs_attention || []).map(m => m.subject), earn_count: s.json.earn_count, memory: s.json.memory && { headline: s.json.memory.headline, items: (s.json.memory.mail_items || []).map(m => [m.subject, m.sender_name, m.delivered_at && m.delivered_at.slice(0, 10)]) } }));
  const o = await api('GET', `${P3}/memory/on-this-day`, owner);
  console.log('GET /memory/on-this-day', o.status, JSON.stringify(o.json && (o.json.memories || []).map(m => ({ headline: m.headline, items: (m.mail_items || []).map(i => [i.subject, i.sender_name, i.delivered_at && i.delivered_at.slice(0, 10)]) }))));
  for (const yr of [y, y - 1]) {
    const r = await api('GET', `${P3}/memory/year/${yr}`, owner);
    console.log(`GET /memory/year/${yr}`, r.status, JSON.stringify(r.json && { total_items: r.json.total_items, by_type: r.json.by_type, top_senders: (r.json.top_senders || []).map(t => `${t.sender_display}:${t.item_count}`), first_mail_date: r.json.first_mail_date && r.json.first_mail_date.slice(0, 10), total_packages: r.json.total_packages }));
  }
  const sg = await api('GET', `${P3}/records/suggestions?homeId=${HOME}`, owner);
  console.log('GET /records/suggestions', sg.status, JSON.stringify(sg.json && (sg.json.suggestions || []).map(x => ({ mail: x.mail && x.mail.subject, brand: x.detections && x.detections[0] && x.detections[0].candidate_brand }))));
  const ad = await api('POST', `${P3}/records/auto-detect`, owner, { homeId: HOME });
  console.log('POST /records/auto-detect', ad.status, JSON.stringify(ad.json && { count: ad.json.count, detections: (ad.json.detections || []).map(d => [d.candidate_name, d.candidate_brand]) }));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
