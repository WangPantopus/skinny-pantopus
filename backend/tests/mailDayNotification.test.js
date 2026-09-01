// ============================================================
// TEST: Mail Day daily push — jobs/mailDayNotification.js
//
// The job shipped as a Phase-1 stub that wrote a MailEvent row and never
// called the notification service, on a fixed 08:00 UTC cron (1am
// Pacific). These tests pin the rewritten contract:
//   * it sends through notificationService (so preferences/push/badge
//     plumbing applies) rather than talking to pushService directly,
//   * exactly one push per user per mail day,
//   * it defers rather than drops outside the local daytime window,
//   * the copy never carries a sender or a category.
// ============================================================

jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn(),
}));

const { resetTables, seedTable, getTable } = require('./__mocks__/supabaseAdmin');
const notificationService = require('../services/notificationService');
const mailDayNotification = require('../jobs/mailDayNotification');
const { composeMailDayPush, isSendableNow, inQuietHours, localHour } = mailDayNotification;

const USER = 'mailday-user-1';
const OTHER = 'mailday-user-2';
const TODAY = new Date().toISOString().slice(0, 10);

// The job derives its candidates from the SCAN side — unresolved
// MailRoutingQueue rows on homes the user occupies — and materialises
// MailDayItem itself. Seeding MailDayItem directly (as these tests first
// did) reads the artifact rather than the source, and that is precisely
// what hid the defect: the push could only reach users who had already
// opened the Mail Day screen that day.
//
// seedTable replaces the table, so multi-user cases push onto the live array.
function seedScannedMail(userId, kinds) {
  const homeId = `${userId}-home`;
  // Mail is a trusted-occupancy surface (utils/homeMailAccess): the fixture
  // occupancy must be verified for the push to be owed.
  getTable('HomeOccupancy').push({ user_id: userId, home_id: homeId, is_active: true, verification_status: 'verified' });
  kinds.forEach((kind, i) => {
    const mailId = `${userId}-mail-${i}`;
    getTable('Mail').push({
      id: mailId,
      // kindFor() maps category/object type onto the triage kind.
      category: kind === 'bill' ? 'bill' : null,
      mail_object_type: kind === 'package' ? 'package' : 'envelope',
      subject: 'A piece of mail',
      created_at: new Date().toISOString(),
    });
    getTable('MailRoutingQueue').push({
      id: `${userId}-q-${i}`,
      home_id: homeId,
      mail_id: mailId,
      resolved: false,
      best_match_confidence: 0.9,
      Mail: getTable('Mail').find((m) => m.id === mailId),
    });
  });
}

/** Pre-materialised triage rows, for the already-reviewed case. */
function seedItems(userId, kinds, status = 'unreviewed') {
  getTable('MailDayItem').push(...kinds.map((kind, i) => ({
    id: `${userId}-item-${i}`,
    user_id: userId,
    kind,
    status,
    day_date: TODAY,
    scanned_at: new Date().toISOString(),
  })));
}

/** A timezone where "now" is reliably mid-afternoon, whatever the runner's clock. */
function timezoneWhereItIsHour(targetHour) {
  const utcHour = new Date().getUTCHours();
  // Etc/GMT offsets are inverted: Etc/GMT+5 is UTC-5.
  let offset = targetHour - utcHour;
  while (offset > 12) offset -= 24;
  while (offset < -11) offset += 24;
  return offset <= 0 ? `Etc/GMT+${Math.abs(offset)}` : `Etc/GMT-${offset}`;
}

const MIDDAY_TZ = timezoneWhereItIsHour(14);
const NIGHT_TZ = timezoneWhereItIsHour(3);

function seedPrefs(userId, extra = {}) {
  getTable('UserNotificationPreferences').push({
    user_id: userId,
    daily_briefing_timezone: MIDDAY_TZ,
    quiet_hours_start_local: null,
    quiet_hours_end_local: null,
    ...extra,
  });
}

describe('composeMailDayPush', () => {
  test('counts pieces and calls out the ones needing action', () => {
    const push = composeMailDayPush([
      { kind: 'envelope' }, { kind: 'bill' }, { kind: 'flyer' },
    ]);
    expect(push.body).toBe('3 pieces today — 1 needs you.');
    expect(push.pieces).toBe(3);
    expect(push.needs_you).toBe(1);
  });

  test('drops the "needs you" clause when nothing is actionable', () => {
    expect(composeMailDayPush([{ kind: 'flyer' }, { kind: 'magazine' }]).body)
      .toBe('2 pieces today.');
  });

  test('singularises a lone piece', () => {
    expect(composeMailDayPush([{ kind: 'postcard' }]).body).toBe('1 piece today.');
  });

  test('returns null when there is nothing to say', () => {
    expect(composeMailDayPush([])).toBeNull();
  });

  test('never leaks a sender or a category into the copy', () => {
    const push = composeMailDayPush([
      { kind: 'bill', sender: 'Kaiser Permanente', label: 'Explanation of Benefits' },
      { kind: 'envelope', sender: 'Multnomah County Elections', label: 'Ballot' },
    ]);
    const text = `${push.title} ${push.body}`;
    expect(text).not.toMatch(/Kaiser|Multnomah|Benefits|Ballot|bill/i);
  });
});

describe('quiet hours', () => {
  test('handles a range that wraps past midnight', () => {
    expect(inQuietHours(23, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(2, '22:00', '07:00')).toBe(true);
    expect(inQuietHours(12, '22:00', '07:00')).toBe(false);
    expect(inQuietHours(7, '22:00', '07:00')).toBe(false);
  });

  test('handles a same-day range', () => {
    expect(inQuietHours(14, '13:00', '16:00')).toBe(true);
    expect(inQuietHours(17, '13:00', '16:00')).toBe(false);
  });

  test('is inert when unset or degenerate', () => {
    expect(inQuietHours(3, null, null)).toBe(false);
    expect(inQuietHours(3, '08:00', '08:00')).toBe(false);
  });
});

describe('localHour', () => {
  test('resolves a real zone', () => {
    expect(localHour('UTC')).toBe(new Date().getUTCHours());
  });

  test('falls back rather than throwing on a bad zone', () => {
    expect(Number.isInteger(localHour('Not/AZone'))).toBe(true);
  });
});

describe('isSendableNow', () => {
  test('sends in the local afternoon', () => {
    expect(isSendableNow({ daily_briefing_timezone: MIDDAY_TZ })).toBe(true);
  });

  test('never sends in the middle of the local night', () => {
    expect(isSendableNow({ daily_briefing_timezone: NIGHT_TZ })).toBe(false);
  });

  test('respects quiet hours inside the daytime window', () => {
    expect(isSendableNow({
      daily_briefing_timezone: MIDDAY_TZ,
      quiet_hours_start_local: '13:00',
      quiet_hours_end_local: '16:00',
    })).toBe(false);
  });
});

describe('mailDayNotification job', () => {
  beforeEach(() => {
    resetTables();
    notificationService.createNotification.mockReset();
    notificationService.createNotification.mockResolvedValue({ id: 'notif-1' });
  });

  test('sends one push through the notification service', async () => {
    seedScannedMail(USER, ['envelope', 'bill']);
    seedPrefs(USER);

    await mailDayNotification();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    const arg = notificationService.createNotification.mock.calls[0][0];
    expect(arg.userId).toBe(USER);
    // 'mail_summary' is gated by the existing mail_summary_enabled toggle.
    expect(arg.type).toBe('mail_summary');
    expect(arg.body).toBe('2 pieces today — 1 needs you.');
    expect(arg.metadata.day_date).toBe(TODAY);
  });

  test('claims the day so a second run does not re-send', async () => {
    seedScannedMail(USER, ['bill']);
    seedPrefs(USER);

    await mailDayNotification();
    await mailDayNotification();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    const session = getTable('MailDaySession').find((s) => s.user_id === USER);
    expect(session.notified_at).toBeTruthy();
  });

  // Regression: idempotency is keyed to the UTC day but the send window
  // is LOCAL. For the Americas, UTC midnight lands inside the local
  // evening — push at 10:00 PDT for UTC day N, then 17:15 PDT is already
  // UTC day N+1 with no session row, and the same unresolved pieces fired
  // AGAIN the same local evening. The cooldown is the fix.
  test('does not re-push after the UTC rollover when yesterday was pushed hours ago', async () => {
    seedScannedMail(USER, ['bill']);
    seedPrefs(USER);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    seedTable('MailDaySession', [{
      id: 'sess-yesterday', user_id: USER, day_date: yesterday,
      // "Yesterday" by UTC calendar, two hours ago by the clock.
      notified_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    }]);

    await mailDayNotification();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  test('a push from a full day ago does not block today', async () => {
    seedScannedMail(USER, ['bill']);
    seedPrefs(USER);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    seedTable('MailDaySession', [{
      id: 'sess-yesterday', user_id: USER, day_date: yesterday,
      notified_at: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    }]);

    await mailDayNotification();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
  });

  test('skips a user who already finished the day', async () => {
    seedScannedMail(USER, ['bill']);
    seedPrefs(USER);
    seedTable('MailDaySession', [{
      user_id: USER, day_date: TODAY, finished_at: new Date().toISOString(), streak_days: 4,
    }]);

    await mailDayNotification();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  test('defers instead of dropping when it is night for the user', async () => {
    seedScannedMail(USER, ['bill']);
    seedPrefs(USER, { daily_briefing_timezone: NIGHT_TZ });

    await mailDayNotification();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    // No delivery record written — the next run re-evaluates.
    const session = (getTable('MailDaySession') || []).find((s) => s.user_id === USER);
    expect(session?.notified_at).toBeFalsy();
  });

  test('ignores users whose mail is already triaged', async () => {
    seedItems(USER, ['bill'], 'reviewed');
    seedPrefs(USER);

    await mailDayNotification();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  test('retries next run when the notification fails to write', async () => {
    seedScannedMail(USER, ['bill']);
    seedPrefs(USER);
    notificationService.createNotification.mockResolvedValueOnce(null);

    await mailDayNotification();
    const afterFailure = (getTable('MailDaySession') || []).find((s) => s.user_id === USER);
    expect(afterFailure?.notified_at).toBeFalsy();

    await mailDayNotification();
    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
  });

  test('handles several users independently', async () => {
    seedScannedMail(USER, ['bill', 'envelope']);
    seedScannedMail(OTHER, ['envelope']);
    seedPrefs(USER);
    seedPrefs(OTHER, { daily_briefing_timezone: NIGHT_TZ });

    await mailDayNotification();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    expect(notificationService.createNotification.mock.calls[0][0].userId).toBe(USER);
  });
});

// ── Regression: who the push can actually reach ──────────────────────────
// Candidates used to come from MailDayItem, whose only production writer is
// `ensureTodayItems` — called from GET /today and nowhere else. So the push
// could only reach a user who had ALREADY opened the Mail Day screen that
// day: the exact inverse of "schedule off the scan, not the clock".
describe('reaches users who have not opened the app', () => {
  beforeEach(() => {
    resetTables();
    notificationService.createNotification.mockReset();
    notificationService.createNotification.mockResolvedValue({ id: 'notif-1' });
  });

  test('notifies from scanned mail alone, with no pre-existing triage rows', async () => {
    seedScannedMail(USER, ['bill', 'envelope']);
    seedPrefs(USER);
    // Nothing has ever materialised a MailDayItem for this user.
    expect(getTable('MailDayItem')).toHaveLength(0);

    await mailDayNotification();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    // The job materialised the day itself, exactly as the screen would.
    expect(getTable('MailDayItem').length).toBeGreaterThan(0);
  });

  test('ignores mail whose routing is already resolved', async () => {
    seedScannedMail(USER, ['bill']);
    getTable('MailRoutingQueue').forEach((q) => { q.resolved = true; });
    seedPrefs(USER);

    await mailDayNotification();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  test('ignores a home the user no longer occupies', async () => {
    seedScannedMail(USER, ['bill']);
    getTable('HomeOccupancy').forEach((o) => { o.is_active = false; });
    seedPrefs(USER);

    await mailDayNotification();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  test('does not seed streak_days when it claims the day', async () => {
    // The job is often the first writer of today's session row. Writing a
    // streak here would blank a live streak in GET /today all day.
    seedScannedMail(USER, ['bill']);
    seedPrefs(USER);

    await mailDayNotification();

    const session = getTable('MailDaySession').find((s) => s.user_id === USER);
    expect(session.notified_at).toBeTruthy();
    expect(session.finished_at).toBeFalsy();
    expect(session.streak_days).toBeUndefined();
  });
});
