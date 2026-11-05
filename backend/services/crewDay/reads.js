'use strict';

/**
 * What each side reads about bookings: the household's booking page, Your Crew Days and the Today cards
 * (01-spec.md screens 5, 9, 10), and the crew's homes on a day with the privacy rule (01-spec.md rule 7): "Home 3 ·
 * Two stories" until 6 PM the evening before the home's date, then the address, the first name and the access note
 * through the end of that day; a home waiting on a price check shows its address at once.
 */

const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const blockService = require('../blockService');
const rules = require('./rules');
const store = require('./store');
const views = require('./views');
const days = require('./days');
const bookingsService = require('./bookings');
const photos = require('./photos');
const changes = require('./changes');

const DONE_STATES = ['done', 'paid', 'payment_failed', 'refunded'];

function stepsFor(booking) {
  const order = ['booked', 'on_the_way', 'done', 'paid'];
  const reached = {
    price_pending: -1, price_offered: -1, booked: 0, new_dates: 0, on_the_way: 1, done: 2, payment_failed: 2, paid: 3,
    refunded: 3,
  }[booking.status] ?? -1;
  const requested = ['price_pending', 'price_offered'].includes(booking.status);
  return order.map((key, i) => ({
    key,
    label: key === 'booked' && requested ? 'Requested' : { booked: 'Booked', on_the_way: 'On the way', done: 'Done', paid: 'Paid' }[key],
    state: i < reached || ['paid', 'refunded'].includes(booking.status) ? 'done' : (i === reached ? 'current' : 'todo'),
  }));
}

function chargeFor(booking) {
  return {
    state: views.chargeState(booking),
    amount_cents: booking.price_cents,
    due_at: booking.charge_due_at,
    paid_at: booking.paid_at,
    refunded_cents: booking.refunded_cents || 0,
    failure: booking.charge_failure,
  };
}

function shareFor(day, stats) {
  const share = views.share(day);
  if (!share) return null;
  const service = (rules.SERVICES[day.service] || rules.SERVICES.other).label.toLowerCase();
  return {
    url: share.url,
    flyer_url: share.flyer_url,
    message: `I'm booked for ${service} on ${rules.formatDay(day.service_date, { long: true })}. The crew has room for nearby homes if you need yours done too. ${share.url}`,
    booked_count: stats.booked_count,
    spots_left: Math.max(0, day.capacity - stats.booked_count),
  };
}

// A refund Pantopus support made without a reported problem shows as a resolved case with no kind, so every app
// shows its outcome in words ("Refunded $60 of $180").
function problemFor(b) {
  if (!b.problem_kind && !b.problem_resolution) return null;
  return { status: b.problem_status, kind: b.problem_kind, note: b.problem_note, opened_at: b.problem_opened_at,
    due_at: b.problem_due_at, resolved_at: b.problem_resolved_at, resolution: b.problem_resolution,
    refunded_cents: b.refunded_cents || 0 };
}

/** The household's booking page (screen 5). Photos are signed URLs that last an hour. */
async function bookingPage(bookingId, userId) {
  const { booking, day } = await bookingsService.householdBooking(bookingId, userId);
  const [rows, facts, card, events] = await Promise.all([
    store.bookingsByDay([day.id]),
    store.crewFacts([day.business_user_id]),
    store.savedCard(userId, booking.payment_method_id),
    store.eventsFor(day.id, 'household', { bookingId: booking.id }),
  ]);
  const stats = views.dayStats(rows.get(String(day.id)));
  const cutoff = bookingsService.cancelCutoff(booking, day);
  const beforeCutoff = !cutoff || new Date() < new Date(cutoff);
  const changeable = bookingsService.CHANGEABLE.includes(booking.status);
  const option = (booking.line_items || []).find((i) => i.kind === 'option') || { id: booking.option_id };
  return {
    id: booking.id,
    crew_day: {
      id: day.id,
      code: day.share_code,
      title: day.title,
      service: day.service,
      service_label: (rules.SERVICES[day.service] || rules.SERVICES.other).label,
      street_label: day.street_label,
      city: day.city,
      state: day.state,
      timezone: day.timezone,
      status: day.status,
      included: day.included || [],
      outside_only: day.outside_only,
      crew: store.publicCrew(facts.get(String(day.business_user_id))),
    },
    status: booking.status,
    steps: stepsFor(booking),
    service_date: booking.service_date,
    window_start: rules.hhmm(booking.window_start),
    window_end: rules.hhmm(booking.window_end),
    window_starts_at: rules.windowStartsAt(booking.service_date, booking.window_start, day.timezone),
    window_ends_at: rules.windowEndsAt(booking.service_date, booking.window_end, day.timezone),
    eta: booking.eta_start ? { start: booking.eta_start, end: booking.eta_end, updated_at: booking.eta_updated_at } : null,
    gate_ready_at: booking.gate_ready_at,
    cant_get_in_at: booking.cant_get_in_at,
    prep_note: day.prep_note,
    access_note: booking.access_note,
    address: { line: booking.address_line, city: booking.address_city, state: booking.address_state, zip: booking.address_zip },
    home_id: booking.home_id,
    option: { id: option.id, label: option.label },
    add_ons: (booking.line_items || []).filter((i) => i.kind === 'add_on').map(({ id, label, price_cents: cents }) => ({ id, label, price_cents: cents })),
    line_items: booking.line_items,
    price_cents: booking.price_cents,
    card: card ? { brand: card.card_brand, last4: card.card_last4 } : null,
    cancel_cutoff_at: cutoff,
    can_cancel: changeable && beforeCutoff,
    can_change: changeable && beforeCutoff,
    can_ask_release: changeable && !beforeCutoff && !booking.release_asked_at,
    release_asked_at: booking.release_asked_at,
    charge: chargeFor(booking),
    invoice_id: booking.invoice_id,
    done_at: booking.done_at,
    done_note: booking.done_note,
    photos: await photos.signedUrls(booking.photo_paths || []),
    problem_photos: await photos.signedUrls(booking.problem_photo_paths || []),
    household_confirmed_at: booking.household_confirmed_at,
    problem: problemFor(booking),
    proposal: booking.status === 'new_dates' ? day.proposed_dates : null,
    new_date_choice: booking.new_date_choice,
    remind_next_season: booking.remind_next_season,
    cancelled_by: booking.cancelled_by,
    cancelled_at: booking.cancelled_at,
    cancel_reason: booking.cancelled_by === 'household' ? booking.cancel_reason : null,
    share: shareFor(day, stats),
    events,
    created_at: booking.created_at,
  };
}

/** What a booking card needs (Your Crew Days, Today). */
function bookingCard(booking, day, crew) {
  return {
    booking_id: booking.id,
    crew_day_id: day.id,
    code: day.share_code,
    title: day.title,
    service: day.service,
    service_label: (rules.SERVICES[day.service] || rules.SERVICES.other).label,
    street_label: day.street_label,
    timezone: day.timezone,
    service_date: booking.service_date,
    window_start: rules.hhmm(booking.window_start),
    window_end: rules.hhmm(booking.window_end),
    window_starts_at: rules.windowStartsAt(booking.service_date, booking.window_start, day.timezone),
    status: booking.status,
    price_cents: booking.price_cents,
    charge: chargeFor(booking),
    eta: booking.eta_start ? { start: booking.eta_start, end: booking.eta_end } : null,
    gate_ready_at: booking.gate_ready_at,
    photo_count: (booking.photo_paths || []).length,
    problem_status: booking.problem_status,
    crew: crew ? { business_user_id: day.business_user_id, name: crew.name, username: crew.username } : null,
  };
}

async function myBookings(userId) {
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('household_user_id', userId)
    .order('service_date', { ascending: true }).limit(200);
  if (error) throw store.unavailable('mine', error);
  const dayIds = [...new Set((rows || []).map((b) => b.crew_day_id))];
  const { data: dayRows, error: dayError } = dayIds.length
    ? await supabaseAdmin.from('CrewDay').select('*').in('id', dayIds) : { data: [] };
  if (dayError) throw store.unavailable('mine_days', dayError);
  const dayOf = new Map((dayRows || []).map((d) => [String(d.id), d]));
  const facts = await store.crewFacts((dayRows || []).map((d) => d.business_user_id));
  return (rows || []).map((b) => {
    const day = dayOf.get(String(b.crew_day_id));
    return { booking: b, day, crew: facts.get(String(day.business_user_id)) };
  });
}

async function openOffers() {
  const { data, error } = await supabaseAdmin.from('CrewDay').select('*').eq('kind', 'offer').eq('status', 'open')
    .order('service_date', { ascending: true }).limit(500);
  if (error) throw store.unavailable('open_offers', error);
  return (data || []).filter((d) => new Date() < new Date(d.booking_closes_at));
}

/** Screen 10: coming up, asked for, and done. Done cards offer "Book again" when the same crew opened a day here. */
async function mine(userId) {
  const [rows, offers, requestRows] = await Promise.all([
    myBookings(userId),
    openOffers(),
    supabaseAdmin.from('CrewDay').select('*').eq('kind', 'request').eq('created_by', userId)
      .order('created_at', { ascending: false }).limit(50),
  ]);
  if (requestRows.error) throw store.unavailable('mine_requests', requestRows.error);
  const activeDays = new Set(rows.filter(({ booking }) => !rules.INACTIVE_BOOKING_STATUSES.includes(booking.status))
    .map(({ booking }) => String(booking.crew_day_id)));
  const upcoming = [];
  const past = [];
  for (const { booking, day, crew } of rows) {
    const card = bookingCard(booking, day, crew);
    if (['paid', 'refunded', 'cancelled', 'declined'].includes(booking.status)) {
      const again = offers.find((o) => o.business_user_id === day.business_user_id && o.id !== day.id
        && !activeDays.has(String(o.id)) && rules.inArea(o, booking));
      past.push({ ...card, book_again: again ? { crew_day_id: again.id, code: again.share_code, service_date: again.service_date } : null });
    } else {
      upcoming.push(card);
    }
  }
  past.sort((a, b) => String(b.service_date).localeCompare(String(a.service_date)));
  const offerOf = new Map(offers.map((o) => [String(o.id), o]));
  return {
    upcoming,
    requests: (requestRows.data || []).map((r) => ({
      id: r.id, title: r.title, service: r.service, service_label: (rules.SERVICES[r.service] || rules.SERVICES.other).label,
      street_label: r.street_label, months: r.request_months || [], note: r.request_note, status: r.status,
      answer_note: r.review_note, answered_at: r.reviewed_at, created_at: r.created_at,
      offer: r.fulfilled_by && offerOf.get(String(r.fulfilled_by))
        ? { crew_day_id: r.fulfilled_by, code: offerOf.get(String(r.fulfilled_by)).share_code } : null,
    })),
    past: past.slice(0, 50),
  };
}

// The Today card's state for a booking: what it needs from the household, or what is coming.
function todayState(booking, day, now) {
  if (booking.status === 'price_offered') return 'price_ready';
  if (booking.status === 'new_dates') return 'new_dates';
  if (booking.status === 'payment_failed') return 'payment_failed';
  if (booking.status === 'done' && booking.problem_status !== 'open' && !booking.household_confirmed_at) return 'done';
  if (booking.status === 'on_the_way') return 'on_the_way';
  const today = rules.todayIn(day.timezone, now);
  const tomorrow = DateTime.fromISO(today).plus({ days: 1 }).toISODate();
  if (booking.service_date === today && booking.status === 'booked') return 'today';
  if (booking.service_date === tomorrow && booking.status === 'booked') return 'tomorrow';
  return booking.status;
}

/**
 * Screen 9: the household's own bookings from 7 days before through 2 days after (or whenever one needs an answer),
 * and at most one open day near one of their homes that they haven't booked or dismissed, from a crew nobody blocked.
 */
async function today(userId) {
  const now = new Date();
  const [rows, homes, offers] = await Promise.all([myBookings(userId), store.myHomes(userId), openOffers()]);
  const mineCards = [];
  for (const { booking, day, crew } of rows) {
    if (rules.INACTIVE_BOOKING_STATUSES.includes(booking.status)) continue;
    const date = DateTime.fromISO(booking.service_date, { zone: day.timezone });
    const todayLocal = DateTime.fromISO(rules.todayIn(day.timezone, now), { zone: day.timezone });
    const daysAway = date.diff(todayLocal, 'days').days;
    const needsAnswer = ['price_offered', 'new_dates', 'payment_failed'].includes(booking.status)
      || (booking.status === 'done' && !booking.household_confirmed_at && booking.problem_status !== 'open');
    if (booking.status === 'paid' && daysAway < -2) continue;
    if (!needsAnswer && (daysAway > 7 || daysAway < -2)) continue;
    mineCards.push({ ...bookingCard(booking, day, crew), today_state: todayState(booking, day, now) });
  }
  const booked = new Set(rows.map(({ booking }) => String(booking.crew_day_id)));
  let nearby = [];
  const points = homes.map((h) => h.point).filter(Boolean);
  const candidates = offers.filter((o) => !booked.has(String(o.id)) && points.some((p) => rules.inArea(o, p)));
  if (candidates.length) {
    const { data: dismissed } = await supabaseAdmin.from('CrewDayEvent').select('crew_day_id')
      .eq('actor_user_id', userId).eq('kind', 'today_dismissed').in('crew_day_id', candidates.map((o) => o.id));
    const hidden = new Set((dismissed || []).map((e) => String(e.crew_day_id)));
    const stats = await store.bookingsByDay(candidates.map((o) => o.id));
    for (const offer of candidates) {
      if (hidden.has(String(offer.id))) continue;
      if (views.derived(offer, views.dayStats(stats.get(String(offer.id)))).is_full) continue;
      if (await blockService.isBlocked(userId, offer.business_user_id)) continue;
      nearby = [{
        crew_day_id: offer.id,
        code: offer.share_code,
        title: offer.title,
        service: offer.service,
        service_label: (rules.SERVICES[offer.service] || rules.SERVICES.other).label,
        street_label: offer.street_label,
        timezone: offer.timezone,
        service_date: offer.service_date,
        window_start: rules.hhmm(offer.window_start),
        window_end: rules.hhmm(offer.window_end),
        price_from_cents: views.priceFromCents(offer),
        booking_closes_at: offer.booking_closes_at,
      }];
      break;
    }
  }
  return { mine: mineCards, nearby };
}

// ── The crew's homes ───────────────────────────────────────────

/** When the crew may see a home's address, first name and access note (rule 7). */
function addressVisible(booking, day, now = new Date()) {
  if (['price_pending', 'price_offered'].includes(booking.status)) return true;
  const zone = day.timezone || rules.DEFAULT_TIMEZONE;
  const date = DateTime.fromISO(booking.service_date, { zone });
  const from = date.minus({ days: 1 }).set({ hour: 18, minute: 0, second: 0, millisecond: 0 });
  const until = date.endOf('day');
  const at = DateTime.fromJSDate(now).setZone(zone);
  return at >= from && at <= until;
}

function detailsLine(booking) {
  return (booking.line_items || []).map((i) => (i.kind === 'add_on' ? i.label.toLowerCase() : i.label)).join(' · ');
}

/**
 * A home as the crew sees it now: "Home 3 · Two stories" or, in the job window, the address, the first name and the
 * household's user id (to open a conversation, as "Can't get in" does).
 */
function crewHome(booking, index, day, person, now) {
  const visible = addressVisible(booking, day, now);
  return {
    id: booking.id,
    label: `Home ${index + 1}`,
    details: detailsLine(booking),
    line_items: booking.line_items,
    price_cents: booking.price_cents,
    status: booking.status,
    service_date: booking.service_date,
    window_start: rules.hhmm(booking.window_start),
    window_end: rules.hhmm(booking.window_end),
    address_visible: visible,
    address: visible ? { line: booking.address_line, city: booking.address_city, state: booking.address_state,
      zip: booking.address_zip, latitude: booking.latitude, longitude: booking.longitude } : null,
    first_name: visible ? (person?.first_name || null) : null,
    household_user_id: visible ? booking.household_user_id : null,
    access_note: visible && !['price_pending', 'price_offered'].includes(booking.status) ? booking.access_note : null,
    route_position: booking.route_position,
    eta: booking.eta_start ? { start: booking.eta_start, end: booking.eta_end, updated_at: booking.eta_updated_at } : null,
    gate_ready_at: booking.gate_ready_at,
    cant_get_in_at: booking.cant_get_in_at,
    release_asked_at: booking.release_asked_at,
    done_at: booking.done_at,
    photo_count: (booking.photo_paths || []).length,
    charge_state: views.chargeState(booking),
    charge_due_at: booking.charge_due_at,
    problem: booking.problem_kind ? { status: booking.problem_status, kind: booking.problem_kind, note: booking.problem_note,
      opened_at: booking.problem_opened_at } : null,
    new_date_choice: booking.new_date_choice,
    created_at: booking.created_at,
  };
}

/** Every active home on a day (and the ended ones), numbered in booking order, with what the crew may see now. */
async function crewHomes(day, now = new Date()) {
  const { data: rows, error } = await supabaseAdmin.from('CrewDayBooking').select('*').eq('crew_day_id', day.id)
    .order('created_at', { ascending: true });
  if (error) throw store.unavailable('crew_homes', error);
  const ids = [...new Set((rows || []).map((b) => b.household_user_id))];
  const { data: people, error: peopleError } = ids.length
    ? await supabaseAdmin.from('User').select('id, first_name').in('id', ids) : { data: [] };
  if (peopleError) throw store.unavailable('crew_people', peopleError);
  const personOf = new Map((people || []).map((p) => [String(p.id), p]));
  let n = 0;
  return (rows || []).map((b) => {
    const active = !rules.INACTIVE_BOOKING_STATUSES.includes(b.status);
    const home = crewHome(b, active ? n : -1, day, personOf.get(String(b.household_user_id)), now);
    if (active) n += 1;
    else home.label = 'Cancelled home';
    return { ...home, active, row: b };
  });
}

/** Screen 15's lists: price checks and release asks that need the crew, and the homes. */
async function crewDayDetail(day, base) {
  const homes = await crewHomes(day);
  const strip = ({ row, ...home }) => home;
  const active = homes.filter((h) => h.active);
  const stats = views.dayStats(homes.map((h) => h.row));
  const facts = (await store.crewFacts([day.business_user_id])).get(String(day.business_user_id));
  const fee = await days.feeFor(day.business_user_id, facts);
  return {
    ...base,
    crew: store.publicCrew(facts),
    past_customers: ['open'].includes(day.status) ? (await changes.pastCustomers(day)).length : 0,
    money: views.money(stats, fee.rate_pct),
    needs_you: {
      price_checks: active.filter((h) => h.status === 'price_pending').map(strip),
      release_asks: active.filter((h) => h.release_asked_at && bookingsService.CHANGEABLE.includes(h.status)).map(strip),
    },
    bookings: active.map(strip),
    ended: homes.filter((h) => !h.active).map(strip),
    events: await store.eventsFor(day.id, 'crew'),
  };
}

/** Adds signed photo URLs (done and problem photos) to crew or operator homes, in one call. */
async function withPhotos(homes, rowsById) {
  const all = homes.flatMap((h) => [...(rowsById.get(h.id)?.photo_paths || []), ...(rowsById.get(h.id)?.problem_photo_paths || [])]);
  const signed = new Map((await photos.signedUrls(all)).map((p) => [p.path, p]));
  return homes.map((h) => {
    const row = rowsById.get(h.id) || {};
    return { ...h, photos: (row.photo_paths || []).map((p) => signed.get(p)).filter(Boolean),
      problem_photos: (row.problem_photo_paths || []).map((p) => signed.get(p)).filter(Boolean),
      done_note: row.done_note || null };
  });
}

module.exports = {
  withPhotos,
  bookingPage,
  bookingCard,
  mine,
  today,
  addressVisible,
  crewHomes,
  crewDayDetail,
  DONE_STATES,
};
