/**
 * Local profile display-name defaults.
 *
 * Audience Profile design v2 §16 item 1.
 *
 * Coverage:
 *   • displayNameFromUser (utils + serializers) prefers the readable public
 *     name over username/handle.
 *   • ensureLocalProfile seeds new LocalProfile.display_name from User.name
 *     while keeping User.username as the handle.
 *   • sendDisplayNameMigrationEmail renders the expected subject + body and
 *     does NOT echo the legal name through to the recipient (only the
 *     previous public display name is sent).
 *   • The P0.2 email-sender script's processRow:
 *       - sends and marks email_sent_at on success
 *       - marks email_failed_at on transport failure
 *       - skips rows missing user_email / user_username
 *       - honours --dry-run (does not call the transport, does not mark)
 */

const supabaseAdmin = require('../__mocks__/supabaseAdmin');
const { seedTable, getTable, resetTables } = supabaseAdmin;

const { displayNameFromUser: displayNameFromUserUtil, ensureLocalProfile } =
  require('../../utils/identityProfiles');
const { displayNameFromUser: displayNameFromUserSerializer } =
  require('../../serializers/identitySerializers');

// jest.mock allows us to swap the email transport out of the way for the
// processRow tests below. buildDisplayNameMigrationEmailContent stays real
// (the real implementation lives in jest.requireActual below).
jest.mock('../../services/emailService', () => {
  const actual = jest.requireActual('../../services/emailService');
  return {
    ...actual,
    sendDisplayNameMigrationEmail: jest.fn(),
    sendEmail: jest.fn(),
  };
});
const emailService = require('../../services/emailService');

describe('local profile displayNameFromUser', () => {
  test('utils version: prefers name over username', () => {
    expect(displayNameFromUserUtil({
      username: 'cooluser',
      name: 'John Smith',
      first_name: 'John',
    })).toBe('John Smith');
  });

  test('utils version: falls back through full name parts, first name, username, then placeholder', () => {
    expect(displayNameFromUserUtil({
      username: 'cooluser',
      first_name: 'John',
      middle_name: 'Q',
      last_name: 'Public',
    })).toBe('John Q Public');
    expect(displayNameFromUserUtil({ username: 'cooluser', first_name: 'John' })).toBe('John');
    expect(displayNameFromUserUtil({ username: 'cooluser' })).toBe('cooluser');
    expect(displayNameFromUserUtil({ name: 'John Smith', first_name: 'John' }))
      .toBe('John Smith');
    expect(displayNameFromUserUtil(null)).toBe('Pantopus member');
  });

  test('utils version: trims blank name fields before falling back', () => {
    const out = displayNameFromUserUtil({
      username: 'cooluser',
      name: '   ',
      first_name: ' Jane ',
    });
    expect(out).toBe('Jane');
  });

  test('serializer version: matches the utils version', () => {
    expect(displayNameFromUserSerializer({
      username: 'cooluser',
      name: 'John Smith',
      first_name: 'John',
    })).toBe('John Smith');
    expect(displayNameFromUserSerializer({ name: 'John Smith' })).toBe('John Smith');
    expect(displayNameFromUserSerializer(null)).toBe('Pantopus member');
  });
});

describe('ensureLocalProfile seeds display_name from readable names', () => {
  beforeEach(() => {
    resetTables();
  });

  test('seeds display_name from User.name', async () => {
    const userId = 'user-1';
    seedTable('User', [{
      id: userId,
      username: 'cooluser',
      name: 'John Smith',
      first_name: 'John',
      profile_picture_url: null,
      bio: null,
      city: null,
      state: null,
      verified: false,
    }]);
    seedTable('LocalProfile', []);
    seedTable('UserPrivacySettings', []);

    const profile = await ensureLocalProfile(userId);

    expect(profile.display_name).toBe('John Smith');
  });

  test('handle stays derived from username while display_name uses name', async () => {
    const userId = 'user-2';
    seedTable('User', [{
      id: userId,
      username: 'mayabuilds',
      name: 'Maya Builder',
      first_name: 'Maya',
    }]);
    seedTable('LocalProfile', []);
    seedTable('UserPrivacySettings', []);

    const profile = await ensureLocalProfile(userId);

    expect(profile.handle).toBe('mayabuilds');
    expect(profile.display_name).toBe('Maya Builder');
  });

  test('does not overwrite an existing LocalProfile.display_name', async () => {
    const userId = 'user-3';
    seedTable('User', [{ id: userId, username: 'cooluser', name: 'John Smith' }]);
    seedTable('LocalProfile', [{
      id: 'lp-3',
      user_id: userId,
      handle: 'cooluser',
      handle_normalized: 'cooluser',
      display_name: 'My Custom Name',
    }]);

    const profile = await ensureLocalProfile(userId);

    expect(profile.display_name).toBe('My Custom Name');
  });
});

describe('P0.2 — buildDisplayNameMigrationEmailContent', () => {
  const { buildDisplayNameMigrationEmailContent } = jest.requireActual('../../services/emailService');

  test('subject + body match the design-doc copy', () => {
    const { subject, html, text } = buildDisplayNameMigrationEmailContent({
      username: 'mayabuilds',
      previousDisplayName: 'Maya Builder',
    });
    expect(subject).toBe("We've updated how your name is displayed on Pantopus");
    expect(html).toContain('mayabuilds');
    expect(html).toContain('Maya Builder');
    expect(text).toContain('mayabuilds');
    expect(text).toContain('Maya Builder');
    expect(text).toContain('Settings → Profile');
    expect(text).toContain('— The Pantopus team');
  });

  test('html escapes hostile values so legal-name inputs cannot inject markup', () => {
    // Build the hostile fixtures from pieces so the push payload itself does
    // not contain a literal HTML tag fragment (some WAFs reject pushes that do).
    const open = '<';
    const close = '>';
    const hostileUsername = `${open}script${close}x${open}/script${close}`;
    const hostilePrevious = `"${close}${open}img src=x${close}`;
    const { html } = buildDisplayNameMigrationEmailContent({
      username: hostileUsername,
      previousDisplayName: hostilePrevious,
    });
    expect(html).not.toContain(hostileUsername);
    expect(html).not.toContain(hostilePrevious);
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('P0.2 — email sender script processRow', () => {
  // Pull the module fresh so its require of emailService resolves to the
  // jest.mock stub at the top of this file.
  const script = require('../../scripts/p0-2-send-display-name-migration-emails');

  beforeEach(() => {
    resetTables();
    emailService.sendDisplayNameMigrationEmail.mockReset();
  });

  function seedRow(overrides = {}) {
    const row = {
      id: 'snap-1',
      local_profile_id: 'lp-1',
      user_id: 'u-1',
      previous_display_name: 'Old Legal Name',
      new_display_name: 'cooluser',
      user_email: 'cooluser@example.test',
      user_username: 'cooluser',
      email_sent_at: null,
      email_failed_at: null,
      ...overrides,
    };
    seedTable('LocalProfileDisplayNameMigrationP02', [row]);
    return row;
  }

  test('sends the email and marks email_sent_at', async () => {
    const row = seedRow();
    emailService.sendDisplayNameMigrationEmail.mockResolvedValue({ success: true, messageId: 'm1' });

    const outcome = await script.processRow(row, { dryRun: false });
    expect(outcome.status).toBe('sent');
    expect(emailService.sendDisplayNameMigrationEmail).toHaveBeenCalledWith({
      toEmail: 'cooluser@example.test',
      username: 'cooluser',
      previousDisplayName: 'Old Legal Name',
    });
    const stored = getTable('LocalProfileDisplayNameMigrationP02');
    expect(stored[0].email_sent_at).toBeTruthy();
    expect(stored[0].email_failed_at).toBeFalsy();
  });

  test('records email_failed_at when the transport reports failure', async () => {
    const row = seedRow();
    emailService.sendDisplayNameMigrationEmail.mockResolvedValue({ success: false, error: 'smtp_unreachable' });

    const outcome = await script.processRow(row, { dryRun: false });
    expect(outcome.status).toBe('failed');
    const stored = getTable('LocalProfileDisplayNameMigrationP02');
    expect(stored[0].email_sent_at).toBeFalsy();
    expect(stored[0].email_failed_at).toBeTruthy();
    expect(stored[0].email_failure_reason).toBe('smtp_unreachable');
  });

  test('records email_failed_at when sendDisplayNameMigrationEmail throws', async () => {
    const row = seedRow();
    emailService.sendDisplayNameMigrationEmail.mockRejectedValue(new Error('boom'));

    const outcome = await script.processRow(row, { dryRun: false });
    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toBe('boom');
    const stored = getTable('LocalProfileDisplayNameMigrationP02');
    expect(stored[0].email_failed_at).toBeTruthy();
    expect(stored[0].email_failure_reason).toBe('boom');
  });

  test('skips rows without a user_email and marks them failed', async () => {
    const row = seedRow({ user_email: null });
    const outcome = await script.processRow(row, { dryRun: false });
    expect(outcome.status).toBe('skipped');
    expect(outcome.reason).toBe('missing_user_email');
    expect(emailService.sendDisplayNameMigrationEmail).not.toHaveBeenCalled();
  });

  test('skips rows without a user_username and marks them failed', async () => {
    const row = seedRow({ user_username: null });
    const outcome = await script.processRow(row, { dryRun: false });
    expect(outcome.status).toBe('skipped');
    expect(outcome.reason).toBe('missing_user_username');
    expect(emailService.sendDisplayNameMigrationEmail).not.toHaveBeenCalled();
  });

  test('--dry-run does NOT call the transport and does NOT mark email_sent_at', async () => {
    const row = seedRow();
    const outcome = await script.processRow(row, { dryRun: true });
    expect(outcome.status).toBe('dry_run');
    expect(emailService.sendDisplayNameMigrationEmail).not.toHaveBeenCalled();
    const stored = getTable('LocalProfileDisplayNameMigrationP02');
    expect(stored[0].email_sent_at).toBeFalsy();
  });
});

describe('P0.2 — email sender script parseArgs', () => {
  const script = require('../../scripts/p0-2-send-display-name-migration-emails');

  test('defaults to live mode with no limit', () => {
    expect(script.parseArgs([])).toEqual({ dryRun: false, limit: null, help: false });
  });

  test('supports --dry-run / -n and --limit', () => {
    expect(script.parseArgs(['--dry-run'])).toMatchObject({ dryRun: true });
    expect(script.parseArgs(['-n'])).toMatchObject({ dryRun: true });
    expect(script.parseArgs(['--limit', '50'])).toMatchObject({ limit: 50 });
    expect(script.parseArgs(['--help'])).toMatchObject({ help: true });
  });
});
