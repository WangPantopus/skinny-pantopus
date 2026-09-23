// Address calendar: the Place calendar route vs the Hub Today signals for the same owner and Home.
const { login, api } = require('./h.cjs'); const fs = require('fs');
const HOME = fs.readFileSync(__dirname + '/work/cal-home-id.txt', 'utf8').trim();
(async () => {
  const label = process.argv[2] || 'run';
  const s = await login('calowner');
  console.log(`# address calendar (${label}) ${new Date().toISOString()}`);
  const c = await api('GET', `/api/homes/${HOME}/calendar`, s);
  const cal = c.json?.calendar;
  console.log('GET /api/homes/:id/calendar', c.status, JSON.stringify(cal && { next: cal.next && [cal.next.title, cal.next.date, cal.next.days_until], upcoming: (cal.upcoming || []).slice(0, 4).map(e => `${e.kind}:${e.date}(${e.days_until}d, lead ${e.lead_days})`), needs_pickup_day: cal.needs_pickup_day }));
  const t = await api('GET', '/api/hub/today', s);
  const today = t.json;
  console.log('GET /api/hub/today', t.status, JSON.stringify(today && { location: today.location && [today.location.source, today.location.label], signals: (today.signals || []).map(x => `${x.kind}:${x.label}`), summary: today.summary }));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
