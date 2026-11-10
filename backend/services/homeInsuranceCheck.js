/**
 * The Home Money Check's insurance card (the money page's `money_cards`, serializers/placeIntelligenceSerializer.js).
 *
 * The facts are the household's own: a policy page someone sent to the assistant becomes a Home task whose details
 * say what the paper is and when it ends (services/ai/actionCards.js `draftHomeTask`). For a policy on the home the
 * task also keeps the premium for the term, as an amount in cents and its period, the day the term starts and the
 * insurer's name. Nothing else from the paper is kept: no policy or account number.
 *
 * The card states what those papers say: when the term starts and ends, its premium, and the term before beside it
 * when both are known. It never says a premium is too high and never names another insurer.
 */

const { DateTime } = require('luxon');
const homeRecordService = require('./homeRecordService');
const assistantBudget = require('./ai/assistantBudget');

const PERIODS = { year: 'a year', six_months: 'for six months', month: 'a month' };
// $1 to $250,000 for a term: wide enough for any home, narrow enough to refuse a misread page.
const MIN_CENTS = 100;
const MAX_CENTS = 25000000;
// A policy that ended stays on the page this long, so the card can ask for the new page.
const KEEP_ENDED_DAYS = 90;
const RENEWS_SOON_DAYS = 45;
const MAX_CARDS = 3;

const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && DateTime.fromISO(value, { zone: 'utc' }).isValid;
const longDay = (day) => DateTime.fromISO(day, { zone: 'utc' }).toFormat('LLLL d, yyyy');
const clip = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** A premium as the task keeps it ({ amount_cents, period }), or null when it isn't one. */
function premiumOf(value) {
  if (!value || typeof value !== 'object') return null;
  const cents = value.amount_cents;
  if (!Number.isInteger(cents) || cents < MIN_CENTS || cents > MAX_CENTS || !PERIODS[value.period]) return null;
  return { amount_cents: cents, period: value.period };
}

/** "$1,842" or "$1,842.50". */
function dollars(cents) {
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 })}`;
}
const premiumText = (premium) => `${dollars(premium.amount_cents)} ${PERIODS[premium.period]}`;

/** The home's policy papers that carry a premium, as { name, insurer, startsOn, endsOn, premium, lastPremium, addedOn }. */
function policiesIn(tasks) {
  const papers = [];
  for (const task of tasks || []) {
    const details = task.details || {};
    const premium = premiumOf(details.premium);
    if (details.origin !== 'document' || details.kind !== 'policy' || !isDay(details.ends_on) || !premium) continue;
    if (task.status === 'cancelled' || task.status === 'canceled') continue;
    papers.push({
      name: clip(details.name, 80) || 'Home insurance policy',
      insurer: clip(details.insurer, 60) || null,
      // The day the term starts, when the page printed it: a renewal page comes before its term does.
      startsOn: isDay(details.starts_on) && details.starts_on < details.ends_on ? details.starts_on : null,
      endsOn: details.ends_on,
      premium,
      lastPremium: premiumOf(details.last_premium),
      addedOn: typeof task.created_at === 'string' ? task.created_at.slice(0, 10) : null,
    });
  }
  return papers;
}

/**
 * One policy with the term before it: the newest paper of each name is the current term; the term before is the
 * figure its own page printed, else the paper of the same name that ended before it. Only like periods are compared.
 */
function terms(papers) {
  const byName = new Map();
  for (const paper of papers) {
    const key = paper.name.toLowerCase();
    byName.set(key, [...(byName.get(key) || []), paper]);
  }
  return [...byName.values()].map((group) => {
    const [current, earlier] = [...group].sort((a, b) => b.endsOn.localeCompare(a.endsOn));
    const before = current.lastPremium || (earlier && earlier.endsOn < current.endsOn ? earlier.premium : null);
    return { ...current, before: before && before.period === current.premium.period ? before : null };
  });
}

const daysBetween = (from, to) => Math.round(DateTime.fromISO(to, { zone: 'utc' }).diff(DateTime.fromISO(from, { zone: 'utc' }), 'days').days);
const inDays = (verb, days) => {
  if (days === 0) return `${verb} today`;
  return days === 1 ? `${verb} tomorrow` : `${verb} in ${days} days`;
};

/**
 * Where the term stands today: `ended`, `upcoming` (a renewal page for a term that hasn't started, which is what an
 * insurer sends a month or two ahead) or running.
 */
function standing(term, today) {
  if (term.endsOn < today) return 'ended';
  return term.startsOn && term.startsOn > today ? 'upcoming' : 'running';
}

function chipFor(term, today, stands) {
  if (stands === 'ended') return { tone: 'neutral', text: 'Ended' };
  if (term.before) {
    const pct = Math.round(((term.premium.amount_cents - term.before.amount_cents) / term.before.amount_cents) * 100);
    if (pct > 0) return { tone: 'warning', text: `Up ${pct}%` };
    if (pct < 0) return { tone: 'success', text: `Down ${Math.abs(pct)}%` };
    return { tone: 'neutral', text: 'No change' };
  }
  const days = daysBetween(today, stands === 'upcoming' ? term.startsOn : term.endsOn);
  return days <= RENEWS_SOON_DAYS ? { tone: 'neutral', text: inDays(stands === 'upcoming' ? 'Starts' : 'Ends', days) } : null;
}

function leadFor(term, stands) {
  if (stands === 'ended') return `The policy on file ended on ${longDay(term.endsOn)}.`;
  const upcoming = stands === 'upcoming';
  const timing = upcoming ? `starts on ${longDay(term.startsOn)}` : `ends on ${longDay(term.endsOn)}`;
  if (!term.before) return `${upcoming ? 'The new term' : 'This term'} ${timing}.`;
  const change = term.premium.amount_cents - term.before.amount_cents;
  const compared = change === 0 ? 'the same as' : `${dollars(Math.abs(change))} ${change > 0 ? 'more' : 'less'} than`;
  return `${upcoming ? "The new term's" : "This term's"} premium is ${compared} the term before. It ${timing}.`;
}

function cardFor(term, today, id, assistantOn) {
  const stands = standing(term, today);
  const change = term.before ? term.premium.amount_cents - term.before.amount_cents : null;
  let changeText = null;
  if (change !== null) changeText = change === 0 ? 'None' : `${change > 0 ? '+' : '-'}${dollars(Math.abs(change))}`;
  const kept = `Read from the page you sent${term.addedOn ? `, saved on ${longDay(term.addedOn)}` : ''}. Pantopus keeps the dates, the insurer's name and the premium, and never the policy number.`;
  return {
    id,
    title: 'Home insurance',
    chip: chipFor(term, today, stands),
    lead: leadFor(term, stands),
    rows: [
      { id: 'policy', label: 'Policy', value: term.name },
      { id: 'insurer', label: 'Insurer', value: term.insurer },
      term.startsOn
        ? { id: 'term', label: 'Term', value: `${longDay(term.startsOn)} to ${longDay(term.endsOn)}` }
        : { id: 'ends', label: stands === 'ended' ? 'Ended' : 'Ends', value: longDay(term.endsOn) },
      { id: 'premium', label: stands === 'upcoming' ? 'Premium for the new term' : 'Premium this term', value: premiumText(term.premium) },
      { id: 'before', label: 'Premium the term before', value: term.before ? premiumText(term.before) : null },
      { id: 'change', label: 'Change', value: changeText },
    ],
    notes: [
      kept,
      assistantOn ? 'When the next renewal page comes, send a photo of it to Pantopus AI in the iPhone or Android app to see the two terms side by side.' : null,
      'This is information, not insurance advice.',
    ],
    source: 'The policy page you sent',
    action: assistantOn ? { label: 'Open Pantopus AI', url: '/assistant' } : null,
  };
}

/** The cards for a home's policy papers: those still running first by the day they end, then one that ended lately. */
function cards(tasks, today, { assistantOn = true } = {}) {
  const oldest = DateTime.fromISO(today, { zone: 'utc' }).minus({ days: KEEP_ENDED_DAYS }).toISODate();
  const shown = terms(policiesIn(tasks)).filter((term) => term.endsOn >= oldest);
  const running = shown.filter((term) => term.endsOn >= today).sort((a, b) => a.endsOn.localeCompare(b.endsOn));
  const ended = shown.filter((term) => term.endsOn < today).sort((a, b) => b.endsOn.localeCompare(a.endsOn));
  return [...running, ...ended].slice(0, MAX_CARDS)
    .map((term, index) => cardFor(term, today, index === 0 ? 'home_insurance' : `home_insurance_${index + 1}`, assistantOn));
}

/** The card for a home with no policy on file yet: what the check is and how to start it. */
function invite() {
  return {
    id: 'home_insurance',
    title: 'Home insurance',
    chip: null,
    lead: "Keep this home's insurance renewal here: the day the policy ends, and this term's premium beside the term before.",
    rows: [],
    notes: [
      'Send a photo of the renewal page to Pantopus AI in the iPhone or Android app. It keeps the dates, the insurer\'s name and the premium, and never the policy number.',
    ],
    source: null,
    action: { label: 'Open Pantopus AI', url: '/assistant' },
  };
}

/**
 * The insurance cards for one person looking at one home: from the tasks they may see, so a reminder kept to the
 * home's managers stays with them. `invited` (a boolean, or a promise of one) adds the starting card when there is no
 * policy on file (the caller says where the Home Money Check is on); it needs the assistant, which reads the page.
 */
async function forHome({ homeId, userId, timeZone, invited = false }) {
  let tasks;
  try {
    tasks = (await homeRecordService.listCollection({ homeId, actorId: userId, kind: 'task' })).records || [];
  } catch (err) {
    if (err.statusCode === 403 || err.statusCode === 404) return [];
    throw err;
  }
  const zone = timeZone && DateTime.now().setZone(timeZone).isValid ? timeZone : 'utc';
  const assistantOn = !assistantBudget.isAssistantOff();
  const found = cards(tasks, DateTime.now().setZone(zone).toISODate(), { assistantOn });
  if (found.length) return found;
  return assistantOn && await invited ? [invite()] : [];
}

module.exports = { forHome, cards, invite, premiumOf, premiumText, dollars, PERIODS, MIN_CENTS, MAX_CENTS };
