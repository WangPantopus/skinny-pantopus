/**
 * Evening Briefing Service
 *
 * Selects one tomorrow-relevant signal for the evening briefing and
 * builds the forecast lead-in for tomorrow.
 */

function getLocalDateKey(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const map = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
    if (map.year && map.month && map.day) {
      return `${map.year}-${map.month}-${map.day}`;
    }
  } catch {
    // Fall back below.
  }
  return date.toISOString().slice(0, 10);
}

function getLocalHour(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hourPart = parts.find((part) => part.type === 'hour');
    const hour = Number(hourPart?.value);
    if (Number.isFinite(hour)) return hour;
  } catch {
    // Fall back below.
  }
  return date.getHours();
}

function formatLocalTime(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value);
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey || '')
    .split('-')
    .map((part) => Number(part));

  if (!year || !month || !day) return null;

  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

function tomorrowDateKey(timeZone, now = new Date()) {
  const localToday = getLocalDateKey(now, timeZone);
  return addDaysToDateKey(localToday, 1) || getLocalDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone);
}

function flattenRecentSignals(recentBriefings = []) {
  return recentBriefings.flatMap((briefing) =>
    Array.isArray(briefing?.signals_snapshot) ? briefing.signals_snapshot : []
  );
}

function hasRecentSignalIdentity(recentBriefings, kind, identity) {
  if (!identity) return false;
  return flattenRecentSignals(recentBriefings).some((signal) => {
    if (signal?.kind !== kind) return false;
    if (kind === 'local_update') {
      const postIds = Array.isArray(signal?.data?.post_ids) ? signal.data.post_ids : [];
      return identity.some((postId) => postIds.includes(postId));
    }
    return signal?.data?.identity === identity
      || signal?.data?.bill_id === identity
      || signal?.data?.task_id === identity
      || signal?.data?.event_id === identity
      || signal?.data?.gig_id === identity
      || signal?.data?.tip_key === identity;
  });
}

function buildTomorrowWeatherIntro(weather) {
  const tomorrow = weather?.daily?.[1] || weather?.daily?.[0];
  if (!tomorrow) return null;

  const condition = String(tomorrow.condition_label || tomorrow.condition_code || 'clear').toLowerCase();
  const high = tomorrow.high_f != null ? Math.round(tomorrow.high_f) : null;
  const low = tomorrow.low_f != null ? Math.round(tomorrow.low_f) : null;
  const precip = tomorrow.precip_chance_pct != null ? Math.round(tomorrow.precip_chance_pct) : null;

  if (high != null && low != null && precip != null && precip >= 50) {
    return `Tomorrow looks ${condition} with a ${precip}% chance of precipitation. High ${high}°F, low ${low}°F.`;
  }
  if (high != null && low != null) {
    return `Tomorrow looks ${condition}. High ${high}°F, low ${low}°F.`;
  }
  if (high != null) {
    return `Tomorrow looks ${condition} with a high near ${high}°F.`;
  }
  return `Tomorrow looks ${condition}.`;
}

function createSignal(kind, score, detail, data = {}, label = kind, urgency = 'low', action = null) {
  return {
    kind,
    score,
    label,
    detail,
    urgency,
    source_provider: 'pantopus',
    action,
    data,
  };
}

function buildAlertSignal(alerts, recentBriefings = []) {
  const alert = (alerts?.alerts || []).find((item) =>
    ['extreme', 'severe', 'moderate'].includes(String(item.severity || '').toLowerCase())
  );
  if (!alert) return null;
  const identity = `alert:${alert.id || alert.event || alert.headline}`;
  const overnight = /overnight|tonight|tomorrow/i.test(`${alert.headline || ''} ${alert.description || ''}`);
  const detail = overnight
    ? `${alert.event || 'Alert'} remains in effect overnight. ${alert.instruction || alert.headline || ''}`.trim()
    : `${alert.event || 'Alert'} is active. ${alert.instruction || alert.headline || ''}`.trim();
  const score = String(alert.severity).toLowerCase() === 'moderate' ? 0.70 : 0.90;
  return createSignal(
    'alert',
    score,
    detail,
    { id: alert.id, severity: alert.severity, identity },
    alert.event || 'Alert',
    score >= 0.85 ? 'critical' : 'high',
    null
  );
}

function buildTomorrowEventSignal(internal, timeZone, recentBriefings = [], now = new Date()) {
  const tomorrowKey = tomorrowDateKey(timeZone, now);
  const candidates = (internal.calendar_events || [])
    .filter((event) => getLocalDateKey(event.start_at, timeZone) === tomorrowKey)
    .filter((event) => getLocalHour(event.start_at, timeZone) < 12)
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const event = candidates[0];
  if (!event) return null;
  if (hasRecentSignalIdentity(recentBriefings, 'calendar', event.id)) return null;

  return createSignal(
    'calendar',
    0.74,
    `Tomorrow morning: ${event.title} at ${formatLocalTime(event.start_at, timeZone)}.`,
    { event_id: event.id, start_at: event.start_at, identity: event.id },
    `Tomorrow: ${event.title}`,
    'high',
    { label: 'View event', route: '/app/homes' }
  );
}

function buildTomorrowBillSignal(internal, timeZone, recentBriefings = [], now = new Date()) {
  const tomorrowKey = tomorrowDateKey(timeZone, now);
  const bill = (internal.bills_due || [])
    .find((item) => getLocalDateKey(item.due_date, timeZone) === tomorrowKey);

  if (!bill) return null;
  if (hasRecentSignalIdentity(recentBriefings, 'bill_due', bill.id)) return null;

  const amount = bill.amount ? `$${Number(bill.amount).toFixed(0)} ` : '';
  return createSignal(
    'bill_due',
    0.72,
    `Your ${amount}${bill.provider_name || 'bill'} is due tomorrow.`,
    { bill_id: bill.id, due_date: bill.due_date, identity: bill.id },
    `Bill due tomorrow: ${bill.provider_name || 'Bill'}`,
    'high',
    { label: 'View bill', route: '/app/mailbox' }
  );
}

function buildTomorrowTaskSignal(internal, timeZone, recentBriefings = [], now = new Date()) {
  const tomorrowKey = tomorrowDateKey(timeZone, now);
  const task = (internal.tasks_due || [])
    .filter((item) => getLocalDateKey(item.due_at, timeZone) === tomorrowKey)
    .sort((a, b) => {
      const aPriority = ['urgent', 'high', 'medium', 'low'].indexOf(String(a.priority || 'medium').toLowerCase());
      const bPriority = ['urgent', 'high', 'medium', 'low'].indexOf(String(b.priority || 'medium').toLowerCase());
      return aPriority - bPriority || new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    })[0];

  if (!task) return null;
  if (hasRecentSignalIdentity(recentBriefings, 'task_due', task.id)) return null;

  const score = ['urgent', 'high'].includes(String(task.priority || '').toLowerCase()) ? 0.70 : 0.58;
  return createSignal(
    'task_due',
    score,
    `Tomorrow: ${task.title} is due${task.priority ? ` (${task.priority} priority)` : ''}.`,
    { task_id: task.id, due_at: task.due_at, identity: task.id },
    `Task due tomorrow: ${task.title}`,
    score >= 0.68 ? 'high' : 'medium',
    { label: 'View task', route: '/app/homes' }
  );
}

function buildUrgentMailSignal(internal, recentBriefings = []) {
  if (!internal.urgent_mail_count) return null;
  const identity = `urgent_mail:${internal.urgent_mail_count}`;
  const repeated = hasRecentSignalIdentity(recentBriefings, 'mail', identity);
  const score = repeated ? 0.40 : 0.54;
  return createSignal(
    'mail',
    score,
    `You have ${internal.urgent_mail_count} urgent mail item${internal.urgent_mail_count > 1 ? 's' : ''} worth handling tonight.`,
    { urgent_count: internal.urgent_mail_count, identity },
    `${internal.urgent_mail_count} urgent mail`,
    'medium',
    { label: 'Open mailbox', route: '/app/mailbox' }
  );
}

function buildTomorrowGigSignal(internal, timeZone, recentBriefings = [], now = new Date()) {
  const tomorrowKey = tomorrowDateKey(timeZone, now);
  const gig = (internal.active_gigs || [])
    .find((item) => item.scheduled_date && getLocalDateKey(item.scheduled_date, timeZone) === tomorrowKey);

  if (!gig) return null;
  if (hasRecentSignalIdentity(recentBriefings, 'gig', gig.id)) return null;

  return createSignal(
    'gig',
    0.57,
    `Your gig "${gig.title}" is scheduled for tomorrow.`,
    { gig_id: gig.id, identity: gig.id },
    `Gig tomorrow: ${gig.title}`,
    'medium',
    { label: 'View gig', route: `/gigs/${gig.id}` }
  );
}

function buildLocalUpdateSignal(localUpdates, recentBriefings = []) {
  if (!localUpdates?.summary) return null;
  const postIds = Array.isArray(localUpdates.post_ids) ? localUpdates.post_ids : [];
  if (postIds.length && hasRecentSignalIdentity(recentBriefings, 'local_update', postIds)) return null;

  return createSignal(
    'local_update',
    0.43,
    localUpdates.summary,
    { post_ids: postIds, titles: localUpdates.titles || [] },
    localUpdates.titles?.[0] || 'Nearby update',
    'low',
    { label: 'Open Pulse', route: '/app/pulse' }
  );
}

const EVENING_TIPS = [
  { key: 'wind_down', text: 'Set out what you need for tomorrow and give yourself a slower last 30 minutes tonight.' },
  { key: 'cool_room', text: 'A cooler, darker room usually makes it easier to fall asleep and stay asleep.' },
  { key: 'screen_break', text: 'If you can, step away from bright screens for a bit before bed to make sleep come easier.' },
  { key: 'morning_reset', text: 'A quick reset tonight, even ten tidy minutes, can make tomorrow morning feel much lighter.' },
  { key: 'hydration', text: 'A glass of water now and a calmer pace tonight can help you feel better in the morning.' },
  { key: 'walk', text: 'A short evening walk or stretch can help your body settle before bed.' },
  { key: 'quiet_start', text: 'Pick one small thing to finish tonight, then let the rest wait until tomorrow.' },
];

function buildEveningTipSignal(recentBriefings = [], now = new Date()) {
  const recentTipKeys = new Set(
    flattenRecentSignals(recentBriefings)
      .filter((signal) => signal?.kind === 'evening_tip')
      .map((signal) => signal?.data?.tip_key)
      .filter(Boolean)
  );

  const dayIndex = now.getDay();
  const orderedTips = EVENING_TIPS.map((tip, index) => EVENING_TIPS[(dayIndex + index) % EVENING_TIPS.length]);
  const tip = orderedTips.find((item) => !recentTipKeys.has(item.key)) || orderedTips[0];

  return createSignal(
    'evening_tip',
    0.22,
    tip.text,
    { tip_key: tip.key, identity: tip.key },
    'Evening tip',
    'low',
    null
  );
}

function selectEveningSignal({
  alerts,
  internal,
  timeZone,
  recentBriefings = [],
  localUpdates = null,
  includeEveningTip = true,
  now = new Date(),
}) {
  const candidates = [
    buildAlertSignal(alerts, recentBriefings),
    buildTomorrowEventSignal(internal, timeZone, recentBriefings, now),
    buildTomorrowBillSignal(internal, timeZone, recentBriefings, now),
    buildTomorrowTaskSignal(internal, timeZone, recentBriefings, now),
    buildUrgentMailSignal(internal, recentBriefings),
    buildTomorrowGigSignal(internal, timeZone, recentBriefings, now),
    buildLocalUpdateSignal(localUpdates, recentBriefings),
    includeEveningTip ? buildEveningTipSignal(recentBriefings, now) : null,
  ].filter(Boolean);

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

module.exports = {
  buildTomorrowWeatherIntro,
  selectEveningSignal,
  getLocalDateKey,
  tomorrowDateKey,
};
