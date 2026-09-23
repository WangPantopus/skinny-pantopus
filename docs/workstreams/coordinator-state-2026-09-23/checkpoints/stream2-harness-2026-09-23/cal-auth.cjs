// The owner sets the household pickup day (real route); compare Hub Today for the owner and a pending applicant.
const { login, api } = require('./h.cjs'); const fs = require('fs');
const HOME = fs.readFileSync(__dirname + '/work/cal-home-id.txt', 'utf8').trim();
(async () => {
  const label = process.argv[2] || 'run';
  const owner = await login('calowner'); const pending = await login('calpending');
  console.log(`# household pickup rule vs Hub Today (${label}) ${new Date().toISOString()}`);
  if (process.argv[3] === 'set') {
    const p = await api('PUT', `/api/homes/${HOME}/calendar/pickup-day`, owner, { weekday: 'WE' });
    console.log('owner PUT pickup-day WE', p.status, JSON.stringify(p.json?.calendar?.next && [p.json.calendar.next.title, p.json.calendar.next.date, p.json.calendar.next.scope, p.json.calendar.next.confidence]));
  }
  for (const [who, s] of [['owner', owner], ['pending applicant', pending]]) {
    const c = await api('GET', `/api/homes/${HOME}/calendar`, s);
    const t = await api('GET', '/api/hub/today', s);
    console.log(`${who}: calendar route ${c.status}${c.status === 200 ? ' next=' + JSON.stringify(c.json.calendar.next && [c.json.calendar.next.title, c.json.calendar.next.date, c.json.calendar.next.scope]) : ''} | hub/today ${t.status} location=${t.json?.location?.source}:${t.json?.location?.label} signals=${JSON.stringify((t.json?.signals || []).map(x => `${x.kind}:${x.label}${x.data?.scope ? '(' + x.data.scope + ')' : ''}`))}`);
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
