/**
 * The days ahead in one look (the founder, November 14, 2026: "do a check on their schedule and
 * weather and everything"): each of the next days with its forecast and everything dated the
 * person can see in Pantopus.
 *
 * Nothing is read in a new way. Each part comes from the reader its own screen or tool uses, as
 * the person: the weather and the address calendar from Place and Today (readSections,
 * composeForHomeId), household tasks from the home's record functions (openTasks), plans from
 * planService.listMine, mail that is due from find_mail (so only with the mailbox on and the
 * app's identity check passed), and their waiting check-backs. A part that fails, or that isn't
 * theirs to see here, is left out and named in `not_included`, so the assistant never fills a gap
 * with a guess.
 */
const { DateTime } = require('luxon');
const logger = require('../../utils/logger');
const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');
const { composeForHomeId } = require('../addressCalendarService');
const { loadViewer } = require('../plans/planViewer');
const planService = require('../plans/planService');
const readTools = require('./readTools');
const { dueMail } = require('./readToolsMail');
const followUps = require('./followUps');
const {
  OTHERS_WORDS, clip, chosenHome, zoneOr, todayIn,
} = require('./assistantKit');

const DEFAULT_DAYS = 7;
const MAX_DAYS = 14;
const MAX_ITEMS_A_DAY = 12;
const MAX_OVERDUE = 10;
const PICKUP_KINDS = { garbage: 'Garbage pickup', recycling: 'Recycling pickup', yard_waste: 'Yard waste pickup', bulk_pickup: 'Bulk pickup' };

const scheduleReadToolDefinitions = [
  {
    name: 'get_schedule',
    description: "The days ahead in one look: each of the next days (7 unless you say otherwise, at most 14) with its forecast and everything dated the person can see in Pantopus: plans they host or are going to, household tasks due, pickup days and the other dates on their address calendar, mail that is due, and the check-backs they asked for; plus what is already overdue. Use it for \"what does my week look like?\", \"what's coming up?\", \"am I free Saturday?\" or \"will it rain for my plan?\". For today alone, get_today has more (the hourly forecast, air and alerts). `not_included` names anything that couldn't be read: say so rather than treating it as empty.",
    input_schema: {
      type: 'object',
      properties: {
        days: { type: ['integer', 'null'], minimum: 1, maximum: MAX_DAYS, description: `How many days from today, at most ${MAX_DAYS}. Null means ${DEFAULT_DAYS}.` },
        home_id: { type: ['string', 'null'], description: 'One of their homes, or null for the home Today shows.' },
      },
      required: ['days', 'home_id'],
      additionalProperties: false,
    },
  },
];

/** `read()`, or null with the part's name noted when it fails. */
async function part(name, missing, ctx, read) {
  try {
    return await read();
  } catch (err) {
    logger.warn('assistant schedule part failed', { part: name, userId: ctx.userId, error: err?.message });
    missing.push(`${name} (couldn't be read just now)`);
    return null;
  }
}

const timeOf = (iso, zone) => {
  const at = DateTime.fromISO(String(iso || ''), { zone: 'utc' }).setZone(zoneOr(zone));
  return at.isValid ? at.toFormat('h:mm a') : null;
};
const dayOf = (iso, zone) => {
  const at = DateTime.fromISO(String(iso || ''), { zone: 'utc' }).setZone(zoneOr(zone));
  return at.isValid ? at.toISODate() : null;
};
const words = (code) => (code ? String(code).replace(/_/g, ' ') : null);

/** One day's forecast in a line, from the weather section's daily entries. */
function forecastLine(entry) {
  if (!entry) return null;
  const bits = [];
  if (entry.high_f != null && entry.low_f != null) bits.push(`high ${entry.high_f}°F, low ${entry.low_f}°F`);
  if (entry.precip_chance != null) bits.push(`${entry.precip_chance}% chance of rain or snow`);
  const sky = words(entry.condition_code);
  if (sky) bits.push(sky);
  return bits.join(', ') || null;
}

async function getSchedule(args, ctx) {
  const zone = zoneOr(ctx.timeZone);
  const days = Number.isInteger(args.days) ? Math.min(Math.max(args.days, 1), MAX_DAYS) : DEFAULT_DAYS;
  const today = todayIn(zone);
  const start = DateTime.fromISO(today, { zone: 'utc' });
  const dates = Array.from({ length: days }, (_, i) => start.plus({ days: i }).toISODate());
  const last = dates[dates.length - 1];
  // What this answer leaves out: what it can't have (no home, Mail behind the identity check), then any part that failed.
  const failed = [];
  const mailOn = isLaunchFeatureEnabled('mailbox');

  // The parts that don't go by a home (plans, mail that is due, check-backs) start while the home is looked up.
  const plansRead = part('plans', failed, ctx, async () => {
    if (!(await readTools.plansOn(ctx))) return null;
    const viewer = await loadViewer({ id: ctx.userId, role: ctx.user?.role || null });
    const mine = await planService.listMine(viewer);
    return [...(mine.hosting || []), ...(mine.going || [])];
  });
  // find_mail's own list of what is due, without the Mail tab's counts, which this answer doesn't carry.
  const mailRead = mailOn && ctx.identity ? part('mail that is due', failed, ctx, () => dueMail(days - 1, ctx)) : null;
  const checkBacksRead = part('check-backs', failed, ctx, () => followUps.listWaiting(ctx.userId));

  const home = await chosenHome(ctx.userId, args.home_id);
  const cannotHave = [];
  if (!home) cannotHave.push('the weather, pickup days and household tasks (they have no home in Pantopus yet)');
  if (mailOn && !ctx.identity) cannotHave.push("mail that is due (Mail opens only after the app checks it's them)");

  const [weather, calendar, tasks, plans, mail, checkBacks] = await Promise.all([
    home ? part('the forecast', failed, ctx, async () => {
      const intelligence = await readTools.readSections(home.id, ctx.userId, ['weather'], ctx.user);
      const section = readTools.sectionsOf(intelligence).find((item) => item.id === 'weather');
      return Array.isArray(section?.data?.daily) ? section.data.daily : [];
    }) : null,
    home ? part('pickup days and calendar dates', failed, ctx, () => composeForHomeId(home.id, { userId: ctx.userId })) : null,
    home ? part('household tasks', failed, ctx, () => readTools.openTasks(home.id, ctx.userId)) : null,
    plansRead,
    mailRead,
    checkBacksRead,
  ]);
  const missing = [...cannotHave, ...failed];

  const byDay = new Map(dates.map((date) => [date, []]));
  const overdue = [];
  const put = (date, item) => {
    if (!date) return;
    if (byDay.has(date)) byDay.get(date).push(item);
  };

  for (const card of plans || []) {
    if (card.state !== 'upcoming' && card.state !== 'live') continue;
    const planZone = card.timezone || zone;
    const date = card.starts_at ? dayOf(card.starts_at, planZone) : card.starts_on;
    const shown = readTools.planForModel(card, zone);
    put(date, {
      kind: 'plan',
      time: card.starts_at ? timeOf(card.starts_at, planZone) : (card.day_part || null),
      sort: card.starts_at || `${date}T00:00`,
      plan_id: card.id,
      title_text: shown.title_text,
      when: shown.when,
      your_role: shown.your_role,
      area: shown.area,
      ...(shown.place?.name_text ? { place_text: shown.place.name_text } : {}),
      going: shown.going,
    });
  }

  for (const task of tasks?.records || []) {
    if (!task.due_at) continue;
    const date = dayOf(task.due_at, zone);
    const item = {
      kind: 'task',
      time: timeOf(task.due_at, zone),
      sort: task.due_at,
      ...readTools.taskForModel(task, tasks.names, zone),
    };
    if (date && date < today) overdue.push(item);
    else put(date, item);
  }

  for (const entry of calendar?.upcoming || []) {
    if (entry.kind === 'pickup_holiday') continue;
    const pickup = PICKUP_KINDS[entry.kind];
    let source = 'the address calendar';
    if (entry.scope === 'home') source = 'set by their household';
    else if (pickup) source = entry.confidence === 'official' ? "the city's published schedule" : "the city's schedule, not confirmed";
    put(entry.date, {
      kind: pickup ? 'pickup' : 'date',
      time: null,
      sort: `${entry.date}T00:00`,
      title_text: clip(pickup || entry.title, 100),
      ...(entry.detail && !pickup ? { detail_text: clip(entry.detail, 160) } : {}),
      source,
      ...(entry.moved_from ? { moved_from: entry.moved_from, because: entry.holiday || 'a holiday' } : {}),
    });
  }

  for (const piece of mail || []) {
    const inDays = Number.isInteger(piece.due_in_days) ? piece.due_in_days : null;
    if (inDays == null) continue;
    const item = {
      kind: 'mail_due',
      time: null,
      sort: `${start.plus({ days: inDays }).toISODate()}T00:01`,
      mail_id: piece.mail_id,
      title_text: piece.title_text || null,
      sender_text: piece.sender_text || null,
      amount_due_text: piece.amount_due_text || null,
      due: piece.due || null,
    };
    if (inDays < 0) overdue.push(item);
    else put(start.plus({ days: inDays }).toISODate(), item);
  }

  for (const row of checkBacks || []) {
    put(dayOf(row.due_at, zone), {
      kind: 'check_back',
      time: timeOf(row.due_at, zone),
      sort: row.due_at,
      follow_up_id: row.id,
      about_text: clip(row.summary, 140),
    });
  }

  const forecast = new Map((weather || []).map((entry) => [String(entry.date).slice(0, 10), entry]));
  const strip = ({ sort: _sort, ...item }) => Object.fromEntries(Object.entries(item).filter(([, value]) => value != null));
  const schedule = dates.map((date) => {
    const items = byDay.get(date).sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
    const day = DateTime.fromISO(date, { zone: 'utc' });
    return {
      date,
      day: `${day.toFormat('cccc, LLLL d')}${date === today ? ' (today)' : ''}`,
      forecast: forecastLine(forecast.get(date)) || (home && weather ? 'no forecast this far ahead' : null),
      items: items.slice(0, MAX_ITEMS_A_DAY).map(strip),
      ...(items.length > MAX_ITEMS_A_DAY ? { more_items: items.length - MAX_ITEMS_A_DAY } : {}),
    };
  });

  return {
    note: OTHERS_WORDS,
    from: today,
    to: last,
    home: home ? { home_id: home.id, city: home.city, state: home.state } : null,
    days: schedule,
    overdue: overdue.sort((a, b) => String(b.sort).localeCompare(String(a.sort))).slice(0, MAX_OVERDUE).map(strip),
    ...(overdue.length > MAX_OVERDUE ? { more_overdue: overdue.length - MAX_OVERDUE } : {}),
    ...(missing.length ? { not_included: missing } : {}),
    about: 'A day with no items has nothing dated in Pantopus; it says nothing about the rest of their life. Times are their local time.',
  };
}

const SCHEDULE_TOOL_NAMES = new Set(['get_schedule']);

async function runScheduleReadTool(name, args, ctx) {
  if (name !== 'get_schedule') return null;
  try {
    return await getSchedule(args || {}, ctx);
  } catch (err) {
    logger.warn('assistant read tool failed', { tool: name, userId: ctx?.userId, error: err?.message });
    return { error: `That couldn't be read just now (${name}).` };
  }
}

module.exports = { scheduleReadToolDefinitions, runScheduleReadTool, SCHEDULE_TOOL_NAMES };
