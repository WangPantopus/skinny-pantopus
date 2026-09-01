const {
  serializePrivateAccount,
  serializeLocalProfileForViewer,
  serializeAudienceProfileForViewer,
  serializeBusinessSeatForViewer,
} = require('../../serializers/identitySerializers');

function flattenKeys(value, prefix = '') {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, nested]) => [
    prefix ? `${prefix}.${key}` : key,
    ...flattenKeys(nested, prefix ? `${prefix}.${key}` : key),
  ]);
}

describe('identity serializers', () => {
  test('audience profile does not expose private account or local fields', () => {
    const serialized = serializeAudienceProfileForViewer({
      id: 'persona-1',
      user_id: 'private-user-1',
      handle: 'MayaBuilds',
      display_name: 'Maya Builds',
      avatar_url: 'https://cdn.example.com/avatar.jpg',
      bio: 'Workshop updates',
      follower_count: 42,
      post_count: 7,
      category: 'creator',
      audience_label: 'followers',
      audience_mode: 'open',
      home_address: '1 Private Way',
      city: 'San Francisco',
      state: 'CA',
      phone: '+15555555555',
      email: 'maya@example.com',
    });

    const keys = flattenKeys(serialized);
    expect(serialized).toMatchObject({
      type: 'persona',
      handle: 'MayaBuilds',
      displayName: 'Maya Builds',
      href: '/@MayaBuilds',
    });
    expect(keys).not.toEqual(expect.arrayContaining([
      'user_id',
      'userId',
      'home_address',
      'phone',
      'email',
      'city',
      'state',
    ]));
  });

  test('local profile exposes local identity but not private verification data', () => {
    const serialized = serializeLocalProfileForViewer({
      id: 'local-1',
      user_id: 'private-user-1',
      handle: 'RiverHome',
      display_name: 'RiverHome',
      avatar_url: 'https://cdn.example.com/local.jpg',
      bio: 'Nearby help',
      city: 'Oakland',
      state: 'CA',
      neighborhood: 'Grand Lake',
      legal_name: 'Maya Private',
      email: 'maya@example.com',
      phone: '+15555555555',
    });

    const keys = flattenKeys(serialized);
    expect(serialized).toMatchObject({
      type: 'local',
      handle: 'RiverHome',
      displayName: 'RiverHome',
      href: '/RiverHome',
    });
    expect(keys).not.toEqual(expect.arrayContaining(['user_id', 'userId', 'legal_name', 'email', 'phone']));
  });

  test('private account stays explicit and business serializer hides bound users', () => {
    expect(serializePrivateAccount({
      id: 'user-1',
      email: 'private@example.com',
      legal_name: 'Private Person',
      phone: '+15555555555',
      address_verified: true,
    })).toMatchObject({
      id: 'user-1',
      email: 'private@example.com',
      legalName: 'Private Person',
      phone: '+15555555555',
      verified: true,
    });

    const business = serializeBusinessSeatForViewer({
      id: 'seat-1',
      business_user_id: 'business-1',
      display_name: 'Front Desk',
      bound_user_id: 'private-user-1',
      invite_email: 'owner@example.com',
    });
    expect(flattenKeys(business)).not.toEqual(expect.arrayContaining(['bound_user_id', 'invite_email']));
  });
});
