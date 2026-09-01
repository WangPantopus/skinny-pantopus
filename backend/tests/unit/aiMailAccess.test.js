const supabaseAdmin = require('../../config/supabaseAdmin');
const { canUserViewMail, getAuthorizedMail } = require('../../services/ai/mailAccess');

describe('AI mail access guards', () => {
  beforeEach(() => {
    supabaseAdmin.resetTables?.();
    supabaseAdmin.resetRpc?.();
  });

  test('allows direct recipient access without RPC', async () => {
    const allowed = await canUserViewMail({
      recipientUserId: 'user-1',
      recipientHomeId: null,
      userId: 'user-1',
    });

    expect(allowed).toBe(true);
  });

  test('allows home access when can_view_mail returns true', async () => {
    supabaseAdmin.seedTable('Mail', [
      {
        id: 'mail-1',
        recipient_user_id: null,
        recipient_home_id: 'home-1',
        subject: 'Home bill',
      },
    ]);
    supabaseAdmin.setRpcMock(async (fn, args) => {
      if (fn !== 'can_view_mail') {
        return { data: null, error: { message: 'Unexpected RPC call' } };
      }
      expect(args).toMatchObject({
        p_recipient_home_id: 'home-1',
        p_user_id: 'user-2',
      });
      return { data: true, error: null };
    });

    const item = await getAuthorizedMail({
      mailItemId: 'mail-1',
      userId: 'user-2',
      select: 'subject',
    });

    expect(item).toMatchObject({ id: 'mail-1', subject: 'Home bill' });
  });

  test('returns null when can_view_mail denies access', async () => {
    supabaseAdmin.seedTable('Mail', [
      {
        id: 'mail-2',
        recipient_user_id: null,
        recipient_home_id: 'home-2',
        subject: 'Restricted mail',
      },
    ]);
    supabaseAdmin.setRpcMock(async () => ({ data: false, error: null }));

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
