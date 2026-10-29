const supabaseAdmin = require('../../config/supabaseAdmin');
const { getAuthorizedMail } = require('../../services/ai/mailAccess');

describe('AI mail access guards', () => {
  beforeEach(() => {
    supabaseAdmin.resetTables?.();
    supabaseAdmin.resetRpc?.();
  });

  test('allows the letter\'s own recipient', async () => {
    supabaseAdmin.seedTable('Mail', [
      {
        id: 'mail-0',
        recipient_user_id: 'user-1',
        recipient_home_id: null,
        subject: 'Your letter',
        deleted_at: null,
        delivered_at: '2026-10-01T14:00:00.000Z',
      },
    ]);

    const item = await getAuthorizedMail({
      mailItemId: 'mail-0',
      userId: 'user-1',
      select: 'subject',
    });

    expect(item).toMatchObject({ id: 'mail-0', subject: 'Your letter' });
  });

  test('allows a household letter to a resident who may read the Home\'s mail', async () => {
    supabaseAdmin.seedTable('Mail', [
      {
        id: 'mail-1',
        recipient_user_id: null,
        recipient_home_id: 'home-1',
        privacy: 'shared_household',
        subject: 'Home bill',
        deleted_at: null,
        delivered_at: '2026-10-01T14:00:00.000Z',
      },
    ]);
    supabaseAdmin.seedTable('HomeOccupancy', [
      {
        home_id: 'home-1',
        user_id: 'user-2',
        role_base: 'member',
        is_active: true,
        verification_status: 'verified',
        verification_source: 'address',
      home: { home_status: 'active', security_state: 'normal' },
      },
    ]);

    const item = await getAuthorizedMail({
      mailItemId: 'mail-1',
      userId: 'user-2',
      select: 'subject',
    });

    expect(item).toMatchObject({ id: 'mail-1', subject: 'Home bill' });
  });

  test('returns null for a household letter to someone outside the household', async () => {
    supabaseAdmin.seedTable('Mail', [
      {
        id: 'mail-2',
        recipient_user_id: null,
        recipient_home_id: 'home-2',
        privacy: 'shared_household',
        subject: 'Restricted mail',
        deleted_at: null,
        delivered_at: '2026-10-01T14:00:00.000Z',
      },
    ]);

    const item = await getAuthorizedMail({
      mailItemId: 'mail-2',
      userId: 'user-3',
      select: 'subject',
    });

    expect(item).toBeNull();
  });

  test('returns null when mail row is missing', async () => {
    const item = await getAuthorizedMail({
      mailItemId: 'missing-id',
      userId: 'user-1',
      select: 'subject',
    });

    expect(item).toBeNull();
  });
});
