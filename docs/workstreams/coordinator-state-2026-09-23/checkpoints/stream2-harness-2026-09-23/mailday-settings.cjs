// Mail Day settings save journey (GET → PATCH → PATCH → GET) for one account. Prints no tokens.
const { login, api } = require('./h.cjs');
const P3 = '/api/mailbox/v2/p3';
(async () => {
  const who = process.argv[2] || 'viewer'; const label = process.argv[3] || 'run';
  const s = await login(who);
  console.log(`# Mail Day settings (${label}) as ${who} ${new Date().toISOString()}`);
  const g0 = await api('GET', `${P3}/mailday/settings`, s);
  console.log('GET settings', g0.status, JSON.stringify({ delivery_time: g0.json?.delivery_time, sound_type: g0.json?.sound_type, include_community: g0.json?.include_community, stored: !!g0.json?.user_id }));
  const p1 = await api('PATCH', `${P3}/mailday/settings`, s, { delivery_time: '07:30', sound_type: 'classic' });
  console.log('PATCH 1 {delivery_time 07:30, sound_type classic}', p1.status, JSON.stringify(p1.json?.settings ? { delivery_time: p1.json.settings.delivery_time, sound_type: p1.json.settings.sound_type } : p1.json));
  const p2 = await api('PATCH', `${P3}/mailday/settings`, s, { include_community: false });
  console.log('PATCH 2 {include_community false}', p2.status, JSON.stringify(p2.json?.settings ? { include_community: p2.json.settings.include_community } : p2.json));
  const g1 = await api('GET', `${P3}/mailday/settings`, s);
  console.log('GET settings', g1.status, JSON.stringify({ delivery_time: g1.json?.delivery_time, sound_type: g1.json?.sound_type, include_community: g1.json?.include_community, stored: !!g1.json?.user_id }));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
