'use strict';

/**
 * "Ask for a Crew Day on my street" (01-spec.md screens 11 and 23): a household with a home asks for a service; the
 * operator answers with an open Crew Day ("Offer ready") or "No crew yet" with a note. Neighbors see the street and the
 * service, never who asked.
 */

const { DateTime } = require('luxon');

const supabaseAdmin = require('../../config/supabaseAdmin');
const rules = require('./rules');
const store = require('./store');
const notices = require('./notices');
const admin = require('./admin');

const { CrewDayError } = rules;

function invalid(message, field) {
  return new CrewDayError(422, 'VALIDATION', message, field ? { field } : {});
}

// "123 Maple Lane" → "Maple Lane": the street, never the house.
function streetOf(line) {
  return String(line || '').replace(/^\s*\d+[A-Za-z]?\s+/, '').split(',')[0].trim().slice(0, 80) || 'your street';
}

/** POST /api/crew-days/requests { service, home_id, months, note } */
async function create(userId, body = {}) {
  if (!rules.SERVICE_KEYS.includes(body.service)) throw invalid('Pick a service.', 'service');
  const homes = await store.myHomes(userId);
  if (!homes.length) throw new CrewDayError(422, 'HOME_REQUIRED', 'Add your home first.');
  const home = body.home_id ? homes.find((h) => String(h.id) === String(body.home_id)) : homes[0];
  if (!home?.point) throw invalid("We couldn't find that home.", 'home_id');
  const thisMonth = DateTime.now().setZone(rules.DEFAULT_TIMEZONE).startOf('month');
  const allowed = new Set(Array.from({ length: 6 }, (_, i) => thisMonth.plus({ months: i }).toFormat('yyyy-LL')));
  const months = Array.isArray(body.months) && body.months.length ? [...new Set(body.months.map(String))] : ['any'];
  if (!(months.length === 1 && months[0] === 'any') && !months.every((m) => allowed.has(m))) {
    throw invalid('Pick months in the next six, or any time.', 'months');
  }
  const note = body.note == null ? null : String(body.note).trim();
  if (note && note.length > 500) throw invalid('Keep the note to 500 characters.', 'note');
  const street = streetOf(home.line);
  const { data: request, error } = await supabaseAdmin.from('CrewDay').insert({
    kind: 'request', created_by: userId, service: body.service,
    title: `${rules.SERVICES[body.service].label} on ${street}`.slice(0, 80), street_label: street,
    city: home.city || 'Unknown', state: home.state || 'WA', center_latitude: home.point.latitude,
    center_longitude: home.point.longitude, timezone: rules.timezoneFor(home.point.latitude, home.point.longitude),
    request_months: months, request_note: note || null, request_home_id: home.id, status: 'requested',
  }).select('*').single();
  if (error) throw store.unavailable('request_create', error);
  await store.addEvent({ day: request, actorUserId: userId, actorRole: 'household', kind: 'request_created', visibleTo: 'operator' });
  await notices.requestNew(request).catch(() => {});
  return request;
}

function card(request) {
  return {
    id: request.id, title: request.title, service: request.service,
    service_label: (rules.SERVICES[request.service] || rules.SERVICES.other).label, street_label: request.street_label,
    months: request.request_months || [], note: request.request_note, status: request.status,
    answer_note: request.review_note, answered_at: request.reviewed_at, created_at: request.created_at,
    offer: null,
  };
}

/** POST /api/admin/crew-days/requests/:id { action: offer_ready, crew_day_id } or { action: no_crew, note } */
async function answer(requestId, operatorId, body = {}) {
  const request = await store.getDay(requestId, { kind: 'request' });
  if (!request) throw new CrewDayError(404, 'NOT_FOUND', "We couldn't find that request.");
  const now = new Date().toISOString();
  let fields;
  let offer = null;
  if (body.action === 'offer_ready') {
    offer = await store.getDay(body.crew_day_id, { kind: 'offer' });
    if (!offer || offer.status !== 'open') throw invalid('Pick an open Crew Day.', 'crew_day_id');
    fields = { status: 'offer_ready', fulfilled_by: offer.id, review_note: body.note ? String(body.note).trim().slice(0, 500) : null };
  } else if (body.action === 'no_crew') {
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';
    if (!note) throw invalid('Write a note for the household.', 'note');
    fields = { status: 'no_crew', review_note: note };
  } else {
    throw invalid('Pick offer_ready or no_crew.', 'action');
  }
  const { data: updated, error } = await supabaseAdmin.from('CrewDay')
    .update({ ...fields, reviewed_by: operatorId, reviewed_at: now, updated_at: now }).eq('id', request.id).select('*').single();
  if (error) throw store.unavailable('request_answer', error);
  await store.addEvent({ day: updated, actorUserId: operatorId, actorRole: 'operator', kind: 'request_answered',
    data: { action: body.action, crew_day_id: offer?.id || null }, visibleTo: 'operator' });
  await notices.requestAnswered(updated, offer).catch(() => {});
  const people = await admin.households([updated.created_by]);
  return admin.requestCard(updated, people.get(String(updated.created_by)));
}

module.exports = { create, answer, card, streetOf };
