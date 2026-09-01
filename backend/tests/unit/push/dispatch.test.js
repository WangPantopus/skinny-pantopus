const { dispatchToTokens } = require('../../../services/push/dispatch');

function fakeSender({ configured = true, invalid = [] } = {}) {
  return {
    isConfigured: jest.fn(() => configured),
    sendMany: jest.fn(async () => ({ invalidTokens: invalid })),
  };
}

const message = { title: 'Hi', body: 'There', data: { link: '/x' } };

describe('push/dispatch.dispatchToTokens', () => {
  it('routes each token to the sender for its provider', async () => {
    const senders = { apns: fakeSender(), fcm: fakeSender(), expo: fakeSender() };
    const rows = [
      { token: 'a1', provider: 'apns' },
      { token: 'f1', provider: 'fcm' },
      { token: 'ExponentPushToken[e1]', provider: 'expo' },
      { token: 'a2', platform: 'ios' }, // provider derived from platform
    ];

    await dispatchToTokens(rows, senders, message);

    expect(senders.apns.sendMany).toHaveBeenCalledWith(['a1', 'a2'], message);
    expect(senders.fcm.sendMany).toHaveBeenCalledWith(['f1'], message);
    expect(senders.expo.sendMany).toHaveBeenCalledWith(['ExponentPushToken[e1]'], message);
  });

  it('aggregates invalid tokens across providers', async () => {
    const senders = {
      apns: fakeSender({ invalid: ['a1'] }),
      fcm: fakeSender({ invalid: ['f1'] }),
      expo: fakeSender(),
    };
    const rows = [
      { token: 'a1', provider: 'apns' },
      { token: 'f1', provider: 'fcm' },
    ];

    const { invalidTokens } = await dispatchToTokens(rows, senders, message);
    expect(invalidTokens.sort()).toEqual(['a1', 'f1']);
  });

  it('skips providers that are not configured', async () => {
    const senders = {
      apns: fakeSender({ configured: false }),
      fcm: fakeSender(),
      expo: fakeSender(),
    };
    const rows = [{ token: 'a1', provider: 'apns' }, { token: 'f1', provider: 'fcm' }];

    await dispatchToTokens(rows, senders, message);

    expect(senders.apns.sendMany).not.toHaveBeenCalled();
    expect(senders.fcm.sendMany).toHaveBeenCalled();
  });

  it('isolates a throwing provider so others still send', async () => {
    const senders = {
      apns: {
        isConfigured: () => true,
        sendMany: jest.fn(async () => { throw new Error('boom'); }),
      },
      fcm: fakeSender({ invalid: ['f1'] }),
      expo: fakeSender(),
    };
    const rows = [{ token: 'a1', provider: 'apns' }, { token: 'f1', provider: 'fcm' }];

    const { invalidTokens } = await dispatchToTokens(rows, senders, message);

    expect(senders.fcm.sendMany).toHaveBeenCalled();
    expect(invalidTokens).toEqual(['f1']);
  });

  it('does nothing when there are no rows', async () => {
    const senders = { apns: fakeSender(), fcm: fakeSender(), expo: fakeSender() };
    const { invalidTokens, counts } = await dispatchToTokens([], senders, message);
    expect(invalidTokens).toEqual([]);
    expect(counts).toEqual({ apns: 0, fcm: 0, expo: 0 });
  });
});
