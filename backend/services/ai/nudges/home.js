'use strict';

/**
 * The Home nudges (docs/product/ai-assistant-phase2-contract-2026-10-20.md §3.7 and §7),
 * sent through the engine (./engine.js), which checks the Suggestions switch, "Fewer like
 * this", the day's cap and the idempotency key, and holds pushes through quiet hours:
 *
 *   home_overdue     Mondays, from the person's morning brief time: the home's overdue tasks,
 *                    then this week's that no one has taken, where they can edit tasks. Up to 3,
 *                    each with Mark done, Move to Saturday and, when no one has it, I'll do it.
 *   home_paperwork   30 days, then 7 days, before a warranty, policy or lease ends: the
 *                    reminders a home paper made (HomeTask.details.origin "document") and
 *                    appliances' warranties (HomeAsset.warranty_expires_at). To owners and
 *                    admins who can see it, with a card for a task to check or renew it.
 *   radon_follow_up  A radon result at or above the EPA's 4.0 pCi/L with no follow-up on the
 *                    list (cards for a follow-up test and mitigation quotes), or a radon test
 *                    past its date (Mark done or move it). To people who can add tasks there.
 *                    Facts only, nothing about health.
 *
 * jobs/index.js runs it every 15 minutes for the people who turned Suggestions on, each once a
 * day after their brief time on their own clock. Everything is read as the recipient: their
 * homes and permissions, and the tasks they may see with their own capabilities.
 */

const crypto = require('crypto');
const { DateTime } = require('luxon');
const supabaseAdmin = require('../../../config/supabaseAdmin');
const logger = require('../../../utils/logger');
const homeRecordService = require('../../homeRecordService');
const { getUserAccess } = require('../../../utils/homePermissions');
const { resolveNotificationTimezone } = require('../../context/locationResolver');
const { localDisplayNames } = require('../../../utils/identityProfiles');
const { card, action, line } = require('../actionCards');
const { linkFor } = require('../appGuide');
const { clip, homesOf, firstNameOf } = require('../assistantKit');
const { DEFAULT_TIMEZONE } = require('../llm');
const { sendNudge, canNudge, nudgeCard } = require('./engine');

const OVERDUE_ITEMS = 3;
const RADON_ACTION_PCI = 4;
// hub.js's default when the person never set one.
const DEFAULT_BRIEF_TIME = '07:30';
const PAPER_WORDS = { warranty: 'Warranty', policy: 'Policy', lease: 'Lease' };
const OPEN = new Set(['open', 'in_progress']);

// The local date each person was last looked at, so a 15-minute tick looks at them once a day.
const lookedAt = new Map();

const canEditTasks = (access) => access.permissions.includes('tasks.edit') || access.permissions.includes('tasks.manage');
const ownerOrAdmin = (access) => access.isOwner || ['owner', 'admin'].includes(access.effective_role_base || access.role_base);
const isDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && DateTime.fromISO(value).isValid;
const shortDay = (at, zone) => DateTime.fromISO(String(at), { zone: 'utc' }).setZone(zone).toFormat('LLL d');
const longDay = (day) => DateTime.fromISO(day).toFormat('LLLL d, yyyy');

/** The Saturday after `local`, at 9 AM in its zone. */
function nextSaturday(local) {
  const days = ((6 - local.weekday + 7) % 7) || 7;
  return local.plus({ days }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
}

/** The home's tasks as the person sees them, each with its capabilities; null when they can't. */
async function tasksSeenBy(homeId, userId) {
  try {
    return (await homeRecordService.listCollection({ homeId, actorId: userId, kind: 'task' })).records || [];
  } catch (err) {
    if (err.statusCode === 403 || err.statusCode === 404) return null;
    throw err;
  }
}

/**
 * One row per task, with the changes its capabilities allow: Mark done (can_complete), Move to
 * Saturday and I'll do it (can_edit). Null when they may do neither.
 */
function taskItem(task, { homeId, userId, saturday, names, zone, now }) {
  const can = task.capabilities || {};
  const path = `/api/homes/${homeId}/tasks/${task.id}`;
  const done = { label: 'Updated', link: linkFor('home_task', task.id, { home: homeId }) };
  const actions = [
    can.can_complete ? action('done', 'Mark done', { method: 'PUT', path, body: { status: 'done' } }, done) : null,
    can.can_edit ? action('move', `Move to ${saturday.toFormat('ccc, LLL d')}`, {
      method: 'PUT', path, body: { due_at: saturday.toUTC().toISO({ suppressMilliseconds: true }) },
    }, done, { style: 'secondary' }) : null,
    can.can_edit && !task.assigned_to ? action('take', "I'll do it", { method: 'PUT', path, body: { assigned_to: userId } }, done, { style: 'secondary' }) : null,
  ].filter(Boolean);
  if (!actions.length) return null;
  const late = Date.parse(task.due_at) < now.getTime();
  return {
    id: crypto.randomUUID(),
    title: clip(task.title, 80),
    lines: [
      line(late ? 'Was due' : 'Due', shortDay(task.due_at, zone)),
      line('For', task.assigned_to ? (String(task.assigned_to) === String(userId) ? 'You' : names.get(String(task.assigned_to)) || 'Someone at home') : 'No one yet'),
    ].filter(Boolean),
    actions,
  };
}

async function firstNames(ids) {
  const shown = await localDisplayNames(ids).catch(() => new Map());
  return new Map(ids.map((id) => [String(id), firstNameOf({ display_name: shown.get(String(id)) })]));
}

// ─── home_overdue ──────────────────────────────────────────────────────────

async function overdueNudge({ home, tasks, userId, zone, local, now }) {
  const endOfWeek = local.endOf('week');
  const open = tasks.filter((task) => OPEN.has(task.status) && task.due_at && !task.details?.suggestion);
  const due = (task) => Date.parse(task.due_at);
  const late = open.filter((task) => due(task) < now.getTime()).sort((a, b) => due(a) - due(b));
  const untaken = open.filter((task) => !task.assigned_to && due(task) >= now.getTime()
    && DateTime.fromISO(task.due_at) <= endOfWeek).sort((a, b) => due(a) - due(b));
  const names = await firstNames([...new Set(open.map((task) => task.assigned_to).filter(Boolean))]);
  const saturday = nextSaturday(local);
  const rows = [...late, ...untaken]
    .map((task) => ({ task, item: taskItem(task, { homeId: home.id, userId, saturday, names, zone, now }) }))
    .filter((row) => row.item)
    .slice(0, OVERDUE_ITEMS);
  if (!rows.length) return null;
  const items = rows.map((row) => row.item);
  const first = rows[0].task;
  const firstLate = Date.parse(first.due_at) < now.getTime();
  const more = items.length > 1 ? `, and ${items.length - 1} more` : '';
  return sendNudge({
    userId,
    kind: 'home_overdue',
    subject: { type: 'home', id: home.id },
    checkpoint: local.toISODate(),
    title: items.length === 1 ? 'A home task is waiting' : `${items.length} home tasks are waiting`,
    body: `"${clip(first.title, 60)}" ${firstLate ? 'was due' : 'is due'} ${shortDay(first.due_at, zone)}${more}. Mark it done, move it or take it.`,
    card: card('home_task_update', {
      title: 'Home tasks waiting',
      lines: [line('Home', [home.city, home.state].filter(Boolean).join(', '))],
      actions: [],
      items,
    }),
    expiresAt: endOfWeek.toJSDate(),
  });
}

// ─── home_paperwork ────────────────────────────────────────────────────────

/** The papers ending within 30 days that this person may see. */
async function papersEnding({ home, tasks, access, today }) {
  const papers = [];
  for (const task of tasks || []) {
    const details = task.details || {};
    if (details.origin !== 'document' || !PAPER_WORDS[details.kind] || !isDay(details.ends_on) || !OPEN.has(task.status)) continue;
    papers.push({
      subject: { type: 'task', id: task.id }, suffix: '', kind: details.kind, endsOn: details.ends_on,
      name: clip(details.name, 80) || `${details.kind}`,
    });
  }
  if (access.permissions.includes('assets.view')) {
    const { data, error } = await supabaseAdmin.from('HomeAsset').select('id, name, brand, warranty_expires_at')
      .eq('home_id', home.id)
      .gte('warranty_expires_at', today.toISODate())
      .lte('warranty_expires_at', today.plus({ days: 30 }).toISODate());
    if (error) throw new Error(`Home records read failed: ${error.message}`);
    for (const asset of data || []) {
      papers.push({
        // An appliance isn't a nudge subject, so its id goes in the checkpoint (30d-<id>, 40 characters).
        subject: { type: 'home', id: home.id }, suffix: `-${asset.id}`, kind: 'warranty', endsOn: asset.warranty_expires_at,
        name: `${clip(asset.name, 60)} warranty`,
      });
    }
  }
  return papers;
}

const PAPER_TASKS = {
  warranty: (name) => `Claim any repairs under the ${name} before it ends`,
  policy: (name) => `Renew or compare the ${name}`,
  lease: () => 'Decide whether to renew the lease',
};

async function paperworkNudges({ home, tasks, access, userId, zone, local }) {
  const today = local.startOf('day');
  const results = [];
  for (const paper of await papersEnding({ home, tasks, access, today })) {
    const ends = DateTime.fromISO(paper.endsOn, { zone });
    const daysLeft = Math.round(ends.diff(today, 'days').days);
    if (daysLeft < 0 || daysLeft > 30) continue;
    const name = /warranty|policy|lease/i.test(paper.name) ? paper.name : `${paper.name} ${paper.kind}`;
    const due = DateTime.max(today.plus({ days: 1 }), ends.minus({ days: 7 }));
    const expiresAt = ends.endOf('day').toJSDate();
    const target = { userId, kind: 'home_paperwork', subject: paper.subject, checkpoint: `${daysLeft > 7 ? '30d' : '7d'}${paper.suffix}` };
    // The card is built with the chat's own tool: ask first whether the nudge would go at all.
    const verdict = await canNudge(target);
    if (!verdict.ok) {
      results.push({ sent: false, reason: verdict.reason });
      continue;
    }
    const built = await nudgeCard('draft_home_task', {
      home_id: home.id,
      title: clip(PAPER_TASKS[paper.kind](name.toLowerCase()), 255),
      description: `It ends ${longDay(paper.endsOn)}.`,
      task_type: 'reminder',
      assignee_user_id: null,
      due_date: due.toISODate(),
      due_time: null,
      repeat: null,
      priority: null,
      document: null,
      note: null,
    }, { userId, expiresAt });
    if (built.error) {
      logger.info('home_paperwork.no_card', { userId, homeId: home.id, error: built.error });
      continue;
    }
    let when = `in ${daysLeft} days`;
    if (daysLeft === 0) when = 'today';
    else if (daysLeft === 1) when = 'tomorrow';
    results.push(await sendNudge({
      ...target,
      title: `${PAPER_WORDS[paper.kind]} ends ${when}`,
      body: `${name.charAt(0).toUpperCase()}${name.slice(1)} ends ${longDay(paper.endsOn)}. Add a reminder to check it before then?`,
      card: built.card,
      expiresAt,
    }));
  }
  return results;
}

// ─── radon_follow_up ───────────────────────────────────────────────────────

/** A radon task card, as the Today radon card writes its tasks (details.suggestion, members' visibility). */
function radonTaskCard({ homeId, title, description, dueAt, suggestion, zone }) {
  const body = { task_type: 'reminder', title, description, due_at: dueAt.toUTC().toISO({ suppressMilliseconds: true }), visibility: 'members', details: { suggestion } };
  return card('home_task', {
    title,
    lines: [line('For', 'Anyone at home'), line('Due', dueAt.setZone(zone).toFormat('cccc, LLLL d'))],
    actions: [action('confirm', 'Add task', { method: 'POST', path: `/api/homes/${homeId}/tasks`, body },
      { label: 'Added', link: linkFor('home_tasks', homeId) })],
  });
}

async function radonNudges({ home, tasks, userId, zone, local, now }) {
  const results = [];
  const radon = tasks.filter((task) => task.details?.suggestion === 'radon_test');
  const finishedAt = (task) => Date.parse(task.completed_at || task.updated_at || task.created_at);
  const latest = radon.filter((task) => task.status === 'done' && Number.isFinite(Number(task.details?.result_pci)))
    .sort((a, b) => finishedAt(b) - finishedAt(a))[0];
  if (latest && Number(latest.details.result_pci) >= RADON_ACTION_PCI) {
    // A follow-up already on the list: a radon task (test or mitigation) or one named for it, since the result.
    const followed = tasks.some((task) => task.id !== latest.id && task.status !== 'canceled'
      && (['radon_test', 'radon_mitigation'].includes(task.details?.suggestion) || /radon/i.test(task.title || ''))
      && Date.parse(task.created_at) >= finishedAt(latest));
    if (!followed) {
      const due = local.plus({ days: 14 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
      const pci = Math.round(Number(latest.details.result_pci) * 100) / 100;
      results.push(await sendNudge({
        userId,
        kind: 'radon_follow_up',
        subject: { type: 'task', id: latest.id },
        checkpoint: 'result',
        title: `Radon result: ${pci} pCi/L`,
        body: `The EPA recommends fixing homes at or above 4.0 pCi/L. Add a follow-up test and mitigation quotes to your list?`,
        card: [
          radonTaskCard({
            homeId: home.id, zone, dueAt: due, suggestion: 'radon_test', title: 'Test for radon again',
            description: 'A second test confirms the first. Short-term test kits are sold at hardware stores and online. https://www.epa.gov/radon',
          }),
          radonTaskCard({
            homeId: home.id, zone, dueAt: due, suggestion: 'radon_mitigation', title: 'Get quotes for radon mitigation',
            description: 'Ask certified radon mitigation contractors for quotes. https://www.epa.gov/radon',
          }),
        ],
        expiresAt: local.plus({ days: 7 }).toJSDate(),
      }));
    }
  }
  // A test still on the list past its date ("No or not sure" on the radon card, then nothing).
  const late = radon.find((task) => OPEN.has(task.status) && task.due_at
    && DateTime.fromISO(task.due_at, { zone: 'utc' }).setZone(zone) < local.startOf('day'));
  if (late) {
    const item = taskItem(late, { homeId: home.id, userId, saturday: nextSaturday(local), names: new Map(), zone, now });
    if (item) {
      results.push(await sendNudge({
        userId,
        kind: 'radon_follow_up',
        subject: { type: 'task', id: late.id },
        checkpoint: `due-${DateTime.fromISO(late.due_at, { zone: 'utc' }).setZone(zone).toISODate()}`,
        title: `Radon test was due ${shortDay(late.due_at, zone)}`,
        body: 'Short-term test kits are sold at hardware stores and online. Mark it done or pick a new date.',
        card: card('home_task_update', { title: clip(late.title, 80), lines: [], actions: [], items: [item] }),
        expiresAt: local.endOf('week').toJSDate(),
      }));
    }
  }
  return results;
}

// ─── The run ───────────────────────────────────────────────────────────────

/** The people who turned Suggestions on, with their brief time. */
async function suggestionsOn() {
  const { data, error } = await supabaseAdmin.from('UserNotificationPreferences')
    .select('user_id, daily_briefing_time_local, daily_briefing_timezone')
    .eq('suggestions_enabled', true)
    .limit(5000);
  if (error) throw new Error(`Suggestions read failed: ${error.message}`);
  return data || [];
}

/** One person's Home nudges, once their brief time has passed today. */
async function runFor(prefs, now) {
  const userId = prefs.user_id;
  const zone = (await resolveNotificationTimezone(userId, prefs).catch(() => null)) || DEFAULT_TIMEZONE;
  const local = DateTime.fromJSDate(now).setZone(zone);
  const [hour, minute] = String(prefs.daily_briefing_time_local || DEFAULT_BRIEF_TIME).slice(0, 5).split(':').map(Number);
  if (local < local.set({ hour, minute, second: 0, millisecond: 0 }) || lookedAt.get(userId) === local.toISODate()) return [];
  const results = [];
  const { homes } = await homesOf(userId);
  for (const home of homes) {
    const access = await getUserAccess(home.id, userId);
    if (!access.hasAccess) continue;
    const tasks = await tasksSeenBy(home.id, userId);
    const context = { home, tasks, access, userId, zone, local, now };
    if (tasks && canEditTasks(access) && local.weekday === 1) results.push(await overdueNudge(context));
    if (ownerOrAdmin(access)) results.push(...await paperworkNudges(context));
    if (tasks && canEditTasks(access)) results.push(...await radonNudges(context));
  }
  // An error is tried again on the next run; anything else (sent, capped, off) waits for tomorrow.
  if (!results.some((result) => result?.reason === 'error')) lookedAt.set(userId, local.toISODate());
  return results.filter(Boolean);
}

/**
 * Every 15 minutes (jobs/index.js).
 * @returns {Promise<{ people: number, sent: number, skipped: object }>}
 */
async function runHomeNudges({ now = new Date() } = {}) {
  const people = await suggestionsOn();
  let sent = 0;
  const skipped = {};
  for (const prefs of people) {
    try {
      for (const result of await runFor(prefs, now)) {
        if (result.sent) sent += 1;
        else skipped[result.reason] = (skipped[result.reason] || 0) + 1;
      }
    } catch (err) {
      logger.warn('home_nudges.person_failed', { userId: prefs.user_id, error: err.message });
    }
  }
  if (sent || Object.keys(skipped).length) logger.info('home_nudges.run', { people: people.length, sent, skipped });
  return { people: people.length, sent, skipped };
}

module.exports = { runHomeNudges, runFor, nextSaturday };
