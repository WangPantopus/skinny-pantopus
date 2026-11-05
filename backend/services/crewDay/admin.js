'use strict';

/**
 * The operator's Crew Day pages (docs/product/crew-day-build/01-spec.md §6, screens 20–23): the tabbed list and one
 * day with everything about it. The operator sees every address and household, for support; opening a day records
 * the access on its timeline.
 */

const supabaseAdmin = require('../../config/supabaseAdmin');
const days = require('./days');
const reads = require('./reads');
const rules = require('./rules');
const store = require('./store');
const views = require('./views');

const TABS = ['waiting', 'open', 'today', 'problems', 'done', 'requests'];

/** Per business: finished days and the problems households reported, for the approval card. */
async function crewHistory(businessUserIds) {
  const ids = [...new Set(businessUserIds.filter(Boolean).map(String))];
  const history = new Map(ids.map((id) => [id, { past_days: 0, problems: 0 }]));
  if (ids.length === 0) return history;
  const { data: days, error } = await supabaseAdmin.from('CrewDay').select('id, business_user_id, status')
    .in('business_user_id', ids).eq('kind', 'offer').in('status', ['done', 'in_progress', 'open', 'cancelled']);
  if (error) throw store.unavailable('crew_history', error);
  const dayOwner = new Map((days || []).map((d) => [String(d.id), String(d.business_user_id)]));
  for (const d of days || []) if (d.status === 'done') history.get(String(d.business_user_id)).past_days += 1;
  if (dayOwner.size) {
    const { data: problems, error: problemError } = await supabaseAdmin.from('CrewDayBooking').select('crew_day_id')
      .in('crew_day_id', [...dayOwner.keys()]).not('problem_kind', 'is', null);
    if (problemError) throw store.unavailable('crew_problems', problemError);
    for (const p of problems || []) history.get(dayOwner.get(String(p.crew_day_id))).problems += 1;
  }
  return history;
}

function adminCrew(facts, history) {
  return facts ? { ...facts, ...(history || { past_days: 0, problems: 0 }) } : null;
}

function adminDayCard(day, stats, facts, history) {
  return {
    ...views.crewDayForCrew(day, stats),
    crew: adminCrew(facts, history),
  };
}

function requestCard(day, asker) {
  return {
    id: day.id,
    kind: 'request',
    title: day.title,
    service: day.service,
    service_label: (rules.SERVICES[day.service] || rules.SERVICES.other).label,
    street_label: day.street_label,
    city: day.city,
    state: day.state,
    months: day.request_months || [],
    note: day.request_note,
    status: day.status,
    asked_by: asker ? { user_id: asker.id, first_name: asker.first_name || null } : null,
    answer_note: day.review_note,
    answered_at: day.reviewed_at,
    offer_crew_day_id: day.fulfilled_by,
    created_at: day.created_at,
  };
}

async function offers(statuses) {
  const { data, error } = await supabaseAdmin.from('CrewDay').select('*').eq('kind', 'offer').in('status', statuses)
    .order('service_date', { ascending: true }).limit(500);
  if (error) throw store.unavailable('admin_offers', error);
  return data || [];
}

async function dayCards(days) {
  const [bookings, facts, history] = await Promise.all([
    store.bookingsByDay(days.map((d) => d.id)),
    store.crewFacts(days.map((d) => d.business_user_id)),
    crewHistory(days.map((d) => d.business_user_id)),
  ]);
  const now = new Date();
  return days.map((day) => {
    const stats = views.dayStats(bookings.get(String(day.id)), now);
    return adminDayCard(day, stats, facts.get(String(day.business_user_id)), history.get(String(day.business_user_id)));
  });
}

async function problemCards() {
  const { data, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('problem_status', 'open')
    .order('problem_due_at', { ascending: true }).limit(200);
  if (error) throw store.unavailable('admin_problems', error);
  const rows = data || [];
  if (rows.length === 0) return [];
  const dayIds = [...new Set(rows.map((b) => b.crew_day_id))];
  const { data: days, error: dayError } = await supabaseAdmin.from('CrewDay').select('*').in('id', dayIds);
  if (dayError) throw store.unavailable('admin_problem_days', dayError);
  const dayOf = new Map((days || []).map((d) => [String(d.id), d]));
  const [facts, people] = await Promise.all([
    store.crewFacts((days || []).map((d) => d.business_user_id)),
    households(rows.map((b) => b.household_user_id)),
  ]);
  return rows.map((b) => {
    const day = dayOf.get(String(b.crew_day_id));
    return {
      ...adminBooking(b, people.get(String(b.household_user_id))),
      crew_day: day ? { id: day.id, title: day.title, timezone: day.timezone, business_user_id: day.business_user_id } : null,
      crew: facts.get(String(day?.business_user_id)) || null,
    };
  });
}

async function households(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabaseAdmin.from('User').select('id, first_name, last_name, name, email').in('id', ids);
  if (error) throw store.unavailable('admin_households', error);
  return new Map((data || []).map((u) => [String(u.id), u]));
}

/** A booking as the operator sees it: everything, with the charge state in words the admin pills use. */
function adminBooking(b, person) {
  return {
    id: b.id,
    crew_day_id: b.crew_day_id,
    household: person ? { user_id: person.id, first_name: person.first_name, last_name: person.last_name,
      name: person.name, email: person.email } : { user_id: b.household_user_id },
    address: { line: b.address_line, city: b.address_city, state: b.address_state, zip: b.address_zip },
    option_id: b.option_id,
    add_on_ids: b.add_on_ids,
    line_items: b.line_items,
    price_cents: b.price_cents,
    status: b.status,
    service_date: b.service_date,
    window_start: rules.hhmm(b.window_start),
    window_end: rules.hhmm(b.window_end),
    access_note: b.access_note,
    charge_state: views.chargeState(b),
    charge_due_at: b.charge_due_at,
    invoice_id: b.invoice_id,
    charge_failure: b.charge_failure,
    refunded_cents: b.refunded_cents,
    paid_at: b.paid_at,
    done_at: b.done_at,
    problem: b.problem_kind ? {
      status: b.problem_status, kind: b.problem_kind, note: b.problem_note, opened_at: b.problem_opened_at,
      due_at: b.problem_due_at, resolved_at: b.problem_resolved_at, resolution: b.problem_resolution,
    } : null,
    cancelled_by: b.cancelled_by,
    cancelled_at: b.cancelled_at,
    created_at: b.created_at,
  };
}

async function requestCards() {
  const { data, error } = await supabaseAdmin.from('CrewDay').select('*').eq('kind', 'request')
    .order('created_at', { ascending: false }).limit(300);
  if (error) throw store.unavailable('admin_requests', error);
  const rows = (data || []).sort((a, b) => Number(b.status === 'requested') - Number(a.status === 'requested'));
  const people = await households(rows.map((d) => d.created_by));
  return rows.map((d) => requestCard(d, people.get(String(d.created_by))));
}

function isToday(card) {
  return card.dates.includes(rules.todayIn(card.timezone));
}

/** Screen 20: one tab's items and every tab's count. */
async function list(tab) {
  const selected = TABS.includes(tab) ? tab : 'waiting';
  const [waiting, live, done, problems, requests] = await Promise.all([
    offers(['pending_review']),
    offers(['open', 'in_progress']),
    offers(['done']),
    problemCards(),
    requestCards(),
  ]);
  const liveCards = await dayCards(live);
  const today = liveCards.filter(isToday);
  const open = liveCards.filter((c) => !isToday(c));
  const items = {
    waiting: () => dayCards(waiting),
    open: async () => open,
    today: async () => today,
    problems: async () => problems,
    done: async () => (await dayCards(done)).reverse(),
    requests: async () => requests,
  };
  return {
    tab: selected,
    counts: {
      waiting: waiting.length,
      open: open.length,
      today: today.length,
      problems: problems.length,
      done: done.length,
      requests: requests.filter((r) => r.status === 'requested').length,
    },
    items: await items[selected](),
  };
}

// Repeated openings within ten minutes are one access.
const VIEW_DEDUPE_MS = 10 * 60 * 1000;

/** Screen 21: everything about one day (or a street request), and the access recorded. */
async function detail(dayId, operatorId) {
  const day = await store.getDay(dayId);
  if (!day) return null;
  if (day.kind === 'request') {
    const people = await households([day.created_by]);
    return { kind: 'request', request: requestCard(day, people.get(String(day.created_by))) };
  }
  const { data: recent } = await supabaseAdmin.from('CrewDayEvent').select('id').eq('crew_day_id', day.id)
    .eq('kind', 'operator_viewed').eq('actor_user_id', operatorId)
    .gte('created_at', new Date(Date.now() - VIEW_DEDUPE_MS).toISOString()).limit(1);
  if (!recent?.length) {
    await store.addEvent({ day, actorUserId: operatorId, actorRole: 'operator', kind: 'operator_viewed', visibleTo: 'operator' });
  }
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('crew_day_id', day.id)
    .order('route_position', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
  if (error) throw store.unavailable('admin_detail', error);
  const [facts, history, people, events] = await Promise.all([
    store.crewFacts([day.business_user_id]),
    crewHistory([day.business_user_id]),
    households((rows || []).map((b) => b.household_user_id)),
    store.eventsFor(day.id, 'operator'),
  ]);
  const stats = views.dayStats(rows || []);
  const crew = facts.get(String(day.business_user_id));
  const fee = await days.feeFor(day.business_user_id, crew);
  return {
    kind: 'offer',
    day: adminDayCard(day, stats, crew, history.get(String(day.business_user_id))),
    money: views.money(stats, fee.rate_pct),
    bookings: await reads.withPhotos((rows || []).map((b) => adminBooking(b, people.get(String(b.household_user_id)))),
      new Map((rows || []).map((b) => [b.id, b]))),
    events,
  };
}

module.exports = { TABS, list, detail, adminBooking, households, crewHistory, requestCard };
