/**
 * The pickup-days card: a household's garbage and recycling days, drafted by the
 * chat assistant from what someone says or a photo of their hauler's flyer, for
 * them to check and save.
 *
 * Saving goes through the pickup calendar's own route
 * (PUT /api/homes/:id/calendar/pickup-day), so the card writes exactly what the
 * Today editor writes, and nothing is saved until the person taps Save. That save
 * replaces every pickup day the household set, so the draft starts from what is
 * saved and changes only what they told the assistant.
 */
const { composeForHomeId, localToday } = require('../addressCalendarService');
const { resolveLocation } = require('../context/locationResolver');

const WEEKDAY_NAMES = { MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday', SU: 'Sunday' };
const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
// The save route takes the next recycling pickup within one cycle of today.
const CYCLE_DAYS = { weekly: 7, biweekly: 14 };
const DAY_MS = 86400000;

const noon = (day) => new Date(`${day}T12:00:00.000Z`);
const isoDay = (date) => date.toISOString().slice(0, 10);
const isCalendarDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(noon(value).getTime()) && isoDay(noon(value)) === value;
const weekdayOf = (day) => DAY_CODES[noon(day).getUTCDay()];

/** The pickup in `anchor`'s cycle that falls in [today, today + cycle). Any date in the cycle will do. */
function nextInCycle(anchor, frequency, today) {
  const cycle = CYCLE_DAYS[frequency];
  const diff = Math.round((noon(anchor) - noon(today)) / DAY_MS);
  return isoDay(new Date(noon(today).getTime() + (((diff % cycle) + cycle) % cycle) * DAY_MS));
}

/** "Tuesday, October 20" */
function longDay(day) {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(noon(day));
}

/** What the card says: "Garbage every Tuesday. Recycling every other Tuesday, next on Tuesday, October 20." */
function summaryOf(draft) {
  const lines = [`Garbage every ${WEEKDAY_NAMES[draft.garbage_weekday]}.`];
  const next = draft.recycling_next_date;
  if (draft.recycling_frequency === 'weekly') lines.push(`Recycling every ${WEEKDAY_NAMES[weekdayOf(next)]}.`);
  if (draft.recycling_frequency === 'biweekly') {
    lines.push(`Recycling every other ${WEEKDAY_NAMES[weekdayOf(next)]}, next on ${longDay(next)}.`);
  }
  if (draft.recycling_frequency === 'not_set' && draft.no_recycling) lines.push('No recycling pickup.');
  if (draft.replaces) lines.push("This replaces the days saved now.");
  return lines.join(' ');
}

const sameSchedule = (draft, saved) => saved
  && draft.garbage_weekday === saved.weekday
  && draft.recycling_frequency === (saved.recycling_frequency || 'not_set')
  && (draft.recycling_frequency === 'not_set' || draft.recycling_next_date === saved.recycling_next_date);

function card(fields) {
  return { title: 'Pickup days', ...fields, summary: summaryOf(fields) };
}

/**
 * The draft_pickup_schedule tool: the person's call checked and filled in from the
 * home's saved days. A field Claude leaves null keeps what is saved.
 *
 * @returns {Promise<object>} { draft, valid, draftType: 'pickup_schedule', note } or { error } for Claude.
 */
async function draftPickupSchedule(args, userId) {
  const location = await resolveLocation(userId).catch(() => null);
  const homeId = location?.homeId;
  if (!homeId) {
    return { error: 'They have no home in Pantopus yet, and pickup days belong to a home. Ask them to add theirs on the Place tab first.' };
  }
  let calendar;
  try {
    calendar = await composeForHomeId(homeId, { userId });
  } catch (err) {
    return {
      error: err.statusCode === 403
        ? "They can't see this home's pickup calendar, so they can't set its pickup days."
        : "The home's pickup calendar couldn't be read just now. Ask them to try again in a moment.",
    };
  }
  const saved = calendar.pickup_schedule || null;
  const today = calendar.today || localToday(null);

  const garbage = args.garbage_weekday ? String(args.garbage_weekday).toUpperCase() : saved?.weekday;
  if (!WEEKDAY_NAMES[garbage]) return { error: 'The garbage day is missing. Ask which day their garbage is collected.' };

  let frequency = saved?.recycling_frequency || 'not_set';
  let next = frequency === 'not_set' ? null : saved.recycling_next_date || null;
  if (args.recycling_frequency === 'none') {
    frequency = 'not_set';
    next = null;
  } else if (CYCLE_DAYS[args.recycling_frequency]) {
    if (!isCalendarDay(args.recycling_next_date)) {
      return { error: 'Recycling needs the date of one collection (YYYY-MM-DD) to know which weeks it falls on. Ask for it if you can\'t work it out.' };
    }
    frequency = args.recycling_frequency;
    next = nextInCycle(args.recycling_next_date, frequency, today);
  }
  if (frequency !== 'not_set' && !next) frequency = 'not_set';

  const fields = { home_id: homeId, garbage_weekday: garbage, recycling_frequency: frequency, recycling_next_date: next };
  const draft = card({
    ...fields,
    no_recycling: args.recycling_frequency === 'none',
    replaces: Boolean(saved) && !sameSchedule(fields, saved),
  });
  return { draft, valid: true, draftType: 'pickup_schedule', note: args.note || null };
}

/**
 * A stored draft brought up to date for showing again: the next recycling pickup
 * moves with the calendar, and whether it replaces saved days is no longer known.
 */
function refreshPickupDraft(draft, now = new Date()) {
  if (!draft || !WEEKDAY_NAMES[draft.garbage_weekday] || !draft.home_id) return null;
  const frequency = CYCLE_DAYS[draft.recycling_frequency] && isCalendarDay(draft.recycling_next_date)
    ? draft.recycling_frequency : 'not_set';
  const next = frequency === 'not_set' ? null : nextInCycle(draft.recycling_next_date, frequency, localToday(null, now));
  return card({ ...draft, recycling_frequency: frequency, recycling_next_date: next, replaces: false });
}

/**
 * What the pickup editor fills in from a reading of someone's schedule (a flyer photo):
 * only the fields that were read, null for the rest so the editor keeps its own, and a
 * recycling date moved into the window the save route accepts.
 */
function editorFields(reading, today = localToday(null)) {
  const garbage = WEEKDAY_NAMES[reading.garbage_weekday] ? reading.garbage_weekday : null;
  let frequency = null;
  let next = null;
  if (reading.recycling_frequency === 'none') frequency = 'not_set';
  if (CYCLE_DAYS[reading.recycling_frequency]) {
    frequency = reading.recycling_frequency;
    next = isCalendarDay(reading.recycling_next_date) ? nextInCycle(reading.recycling_next_date, frequency, today) : null;
  }
  const read = [];
  if (garbage) read.push(`Garbage every ${WEEKDAY_NAMES[garbage]}.`);
  if (frequency === 'weekly' && next) read.push(`Recycling every ${WEEKDAY_NAMES[weekdayOf(next)]}.`);
  if (frequency === 'biweekly' && next) read.push(`Recycling every other ${WEEKDAY_NAMES[weekdayOf(next)]}, next on ${longDay(next)}.`);
  if (frequency && frequency !== 'not_set' && !next) read.push(`Recycling ${frequency === 'weekly' ? 'every week' : 'every other week'}; choose the next date.`);
  if (frequency === 'not_set') read.push('No recycling pickup.');
  return {
    garbage_weekday: garbage,
    recycling_frequency: frequency,
    recycling_next_date: next,
    summary: read.join(' ') || null,
  };
}

module.exports = { draftPickupSchedule, refreshPickupDraft, editorFields, nextInCycle };
