const {
  serializePrivateAccount,
  serializeLocalProfileForViewer,
  serializeAudienceProfileForViewer,
  serializeBusinessSeatForViewer,
  sanitizePersonaPostForViewer,
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

  // Live Photo regression pin. sanitizePersonaPostForViewer is a
  // pass-through for the four media columns today, but every Beacon read
  // path funnels through it, so a future entry in
  // PERSONA_LOCAL_POST_FIELDS that happened to name a media array would
  // silently strip Live Photos from every persona surface at once. These
  // are PARALLEL arrays — slot i of each describes attachment i — so the
  // assertion is on the whole array, padding included, not just on
  // presence.
  test('persona post sanitizer preserves the parallel media arrays (Live Photo pass-through)', () => {
    const sanitized = sanitizePersonaPostForViewer({
      id: 'persona-live-photo-post',
      identity_context_type: 'persona',
      identity_context_id: 'persona-1',
      content: 'Two stills and one Live Photo',
      media_urls: [
        'https://cdn.example.com/still.jpg',
        'https://cdn.example.com/live-key.heic',
        'https://cdn.example.com/clip.mp4',
      ],
      media_types: ['image', 'live_photo', 'video'],
      media_thumbnails: ['', 'https://cdn.example.com/live-thumb.jpg', 'https://cdn.example.com/clip-poster.jpg'],
      media_live_urls: ['', 'https://cdn.example.com/live-clip.mov', ''],
      // Local-side fields that MUST still be stripped — proves the test
      // is exercising the stripping loop, not a no-op early return.
      home_id: 'home-1',
      latitude: 37.7749,
      longitude: -122.4194,
      location_address: '1 Private Way',
    });

    expect(sanitized.media_urls).toEqual([
      'https://cdn.example.com/still.jpg',
      'https://cdn.example.com/live-key.heic',
      'https://cdn.example.com/clip.mp4',
    ]);
    expect(sanitized.media_types).toEqual(['image', 'live_photo', 'video']);
    expect(sanitized.media_thumbnails).toEqual([
      '', 'https://cdn.example.com/live-thumb.jpg', 'https://cdn.example.com/clip-poster.jpg',
    ]);
    expect(sanitized.media_live_urls).toEqual([
      '', 'https://cdn.example.com/live-clip.mov', '',
    ]);
    // Index alignment is the whole contract: slot 1 is the Live Photo.
    expect(sanitized.media_types[1]).toBe('live_photo');
    expect(sanitized.media_live_urls[1]).toBe('https://cdn.example.com/live-clip.mov');
    expect(sanitized.media_urls).toHaveLength(sanitized.media_live_urls.length);
    expect(sanitized.media_urls).toHaveLength(sanitized.media_thumbnails.length);

    const keys = flattenKeys(sanitized);
    expect(keys).toEqual(expect.arrayContaining([
      'media_urls', 'media_types', 'media_thumbnails', 'media_live_urls',
    ]));
    expect(keys).not.toEqual(expect.arrayContaining([
      'home_id', 'latitude', 'longitude', 'location_address',
    ]));
  });

  test('persona post sanitizer keeps empty media arrays as empty arrays, never undefined', () => {
    const sanitized = sanitizePersonaPostForViewer({
      id: 'persona-text-post',
      identity_context_type: 'persona',
      content: 'No attachments',
      media_urls: [],
      media_types: [],
      media_thumbnails: [],
      media_live_urls: [],
    });
    expect(sanitized.media_live_urls).toEqual([]);
    expect(sanitized.media_thumbnails).toEqual([]);
  });
});
