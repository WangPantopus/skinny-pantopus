/**
 * The composer's AI assist: the whole post suggested from the person's photos, the
 * place they picked and what they've written so far, for the composer's own fields.
 *
 * The photos are read in memory and never stored. Each goes to Claude re-encoded as a
 * JPEG at the size Claude reads (photos.jpegBlock), which also leaves its EXIF behind,
 * so where and when it was taken stays on the phone. Nothing is saved here either: the
 * person checks the fields, changes what they like and posts with the composer's Post.
 */
const { jpegBlock } = require('./photos');
const { PLACE_POST_TYPES, RESIDENT_ALERT_KINDS, ASK_CATEGORIES } = require('./schemas');

// A few photos say what the post is about; more would cost time without adding much.
const MAX_PHOTOS = 4;
// What the post's own upload takes for a photo (routes/upload.js).
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

// Every type a composer posts (routes/posts.js POST_TYPES).
const POST_TYPES = [
  ...PLACE_POST_TYPES,
  'general', 'personal_update', 'announcement', 'service_offer', 'resources_howto', 'progress_wins',
];

// The fields each kind of post fills besides the body, as the prompt describes them.
// Every other kind fills a title.
const KIND_FIELDS = {
  ask_local: ['title', 'askCategory'],
  recommendation: ['businessName'],
  event: ['title', 'eventDate', 'eventEndDate', 'eventVenue'],
  lost_found: ['lostFoundType', 'lastSeenLocation', 'lastSeenDate'],
  alert: ['title', 'safetyAlertKind'],
  deal: ['title', 'businessName', 'dealExpiresAt'],
};

// What the person may already have filled in, as the request names it and as the prompt shows it.
const WRITTEN_FIELDS = [
  ['title', 'their_title'],
  ['body', 'their_body'],
  ['businessName', 'their_business_name'],
  ['eventVenue', 'their_venue'],
  ['lastSeenLocation', 'their_last_seen_place'],
];

/** True when the person wrote anything a post can be written from. */
function hasWords(fields) {
  return WRITTEN_FIELDS.some(([name]) => typeof fields[name] === 'string' && fields[name].trim());
}

/** The photos as Claude image blocks, and how many couldn't be read (HEIC, a corrupt file). */
async function photoBlocks(files = []) {
  const read = await Promise.all(files.slice(0, MAX_PHOTOS).map((file) => (
    file?.buffer?.length ? jpegBlock(file.buffer, { purpose: 'post-suggestion' }) : null
  )));
  const blocks = read.filter(Boolean);
  return { blocks, unreadable: read.length - blocks.length };
}

/** The words sent with the photos: the kind of post, the place, what they've written and when now is. */
function requestText({ postType, audience, place, placeAddress, photoCount, now, ...written }) {
  const lines = [
    `Kind of post: ${postType}`,
    `It goes to: ${audience === 'connections' ? 'their connections' : 'neighbors nearby'}`,
    `Photos: ${photoCount || 'none'}`,
  ];
  const where = [place, placeAddress].map((part) => (typeof part === 'string' ? part.trim() : '')).filter(Boolean);
  if (where.length) lines.push(`<place>${where.join(', ')}</place>`);
  const filled = WRITTEN_FIELDS.filter(([name]) => typeof written[name] === 'string' && written[name].trim());
  if (filled.length) {
    lines.push('', 'What they wrote so far:');
    for (const [name, tag] of filled) lines.push(`<${tag}>${written[name].trim()}</${tag}>`);
  } else {
    lines.push('', "They haven't written anything yet.");
  }
  lines.push('', `[Now: ${now}]`);
  return lines.join('\n');
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MINUTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** A real calendar day, YYYY-MM-DD ("2026-02-30" isn't one). */
function isRealDay(value) {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A real wall-clock minute, YYYY-MM-DDTHH:MM. */
function isRealMinute(value) {
  if (typeof value !== 'string' || !MINUTE.test(value)) return false;
  const date = new Date(`${value}:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 16) === value;
}

/** Now on the wall clock in `timeZone`: `day` YYYY-MM-DD and `minute` YYYY-MM-DDTHH:MM. */
function localNow(timeZone, now = new Date()) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', { ...options, timeZone }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' }).formatToParts(now);
  }
  const part = (type) => parts.find((p) => p.type === type)?.value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  return { day, minute: `${day}T${part('hour')}:${part('minute')}` };
}

/** One line of text, trimmed and capped, or null. */
function line(value, max) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return text || null;
}

/** The body with its paragraphs kept, trimmed and capped. */
function paragraphs(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max).trim();
}

/** Up to three short lowercase tags, without a leading # or repeats. */
function tagList(tags) {
  if (!Array.isArray(tags)) return [];
  const kept = new Set();
  for (const tag of tags) {
    const text = line(typeof tag === 'string' ? tag.replace(/^#+/, '') : null, 30)?.toLowerCase();
    if (text) kept.add(text);
    if (kept.size === 3) break;
  }
  return [...kept];
}

/**
 * What the composer fills in from a reading: the body, and the fields the kind of post
 * uses. Everything else is null. An event's times are wall-clock times still to come
 * (its end after its start), a deal ends today or later, and a lost-and-found day isn't
 * in the future: anything else is left for the person to set.
 */
function composerFields(reading, { postType, timeZone, now = new Date() }) {
  const today = localNow(timeZone, now);
  const uses = new Set(KIND_FIELDS[postType] || ['title']);
  const pick = (field, value) => (uses.has(field) ? value : null);

  const eventDate = isRealMinute(reading.eventDate) && reading.eventDate > today.minute ? reading.eventDate : null;
  const eventEndDate = eventDate && isRealMinute(reading.eventEndDate) && reading.eventEndDate > eventDate
    ? reading.eventEndDate : null;

  return {
    title: pick('title', line(reading.title, 255)),
    body: paragraphs(reading.body, 5000),
    eventDate: pick('eventDate', eventDate),
    eventEndDate: pick('eventEndDate', eventEndDate),
    eventVenue: pick('eventVenue', line(reading.eventVenue, 255)),
    dealExpiresAt: pick('dealExpiresAt', isRealDay(reading.dealExpiresAt) && reading.dealExpiresAt >= today.day ? reading.dealExpiresAt : null),
    businessName: pick('businessName', line(reading.businessName, 255)),
    lostFoundType: pick('lostFoundType', ['lost', 'found'].includes(reading.lostFoundType) ? reading.lostFoundType : null),
    lastSeenLocation: pick('lastSeenLocation', line(reading.lastSeenLocation, 255)),
    lastSeenDate: pick('lastSeenDate', isRealDay(reading.lastSeenDate) && reading.lastSeenDate <= today.day ? reading.lastSeenDate : null),
    safetyAlertKind: pick('safetyAlertKind', RESIDENT_ALERT_KINDS.includes(reading.safetyAlertKind) ? reading.safetyAlertKind : null),
    askCategory: pick('askCategory', ASK_CATEGORIES.includes(reading.askCategory) ? reading.askCategory : null),
    tags: tagList(reading.tags),
  };
}

/** The model's note, with a word about any photo that couldn't be read. */
function noteFor(note, unreadable) {
  const skipped = unreadable === 1
    ? "One photo couldn't be read, so the suggestion leaves it out."
    : unreadable > 1 ? `${unreadable} photos couldn't be read, so the suggestion leaves them out.` : null;
  const text = [line(note, 300), skipped].filter(Boolean).join(' ');
  return text || null;
}

module.exports = {
  MAX_PHOTOS,
  MAX_PHOTO_BYTES,
  POST_TYPES,
  hasWords,
  photoBlocks,
  requestText,
  composerFields,
  noteFor,
  localNow,
};
