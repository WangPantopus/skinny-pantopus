/**
 * Letters from Pantopus (Mail tab, SRV-6): the welcome letter, a Home's welcome and the residency letter. This is the
 * one writer for them. Each is marked from_pantopus (mail_extracted, with no sending person or business, so nobody
 * else can carry the mark), carries Pantopus's official mark (sender Pantopus, verified), follows the delivery rule,
 * brings the note Pantopus wrote ("Pantopus read this for you", never the AI's), and is made at most once: its id
 * comes from what it is for (welcome:<person>, home:<home>:<person>, residency:<letter>), so a retry or a second proof
 * finds the one already there.
 */
const crypto = require('crypto');
const supabaseAdmin = require('../config/supabaseAdmin');
const logger = require('../utils/logger');
const { isLaunchFeatureEnabled } = require('../utils/featureFlags');
const mailDelivery = require('./mailDelivery');

const SENDER = { sender_display: 'Pantopus', sender_business_name: 'Pantopus', sender_trust: 'verified_business' };
const made = new Set(); // keys this process already found or made

/** The letter's id: a UUID from what it is for, so the same letter is never stored twice. */
function letterId(key) {
  const hex = crypto.createHash('sha256').update(`pantopus:letter:v1:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Store one Pantopus letter unless it is already there. `letter`: recipient fields, subject, content, summary,
 * key_facts, and optionally enclosures, drawer, privacy fields, category, `immediate` (in the box now, not special),
 * `delivered_at` (a given round instead of the next one) and `filed_folder_id` (it goes straight into that Vault
 * folder, a receipt in Receipts). Answers { id, created }.
 */
async function send(key, letter) {
  const id = letterId(key);
  if (made.has(key)) return { id, created: false };
  // Made before: the letter is still there, or it was shredded and purged (its MailEvent stays, mail_id set null).
  const [{ data: existing, error: readError }, { data: marker, error: markerError }] = await Promise.all([
    supabaseAdmin.from('Mail').select('id').eq('id', id).maybeSingle(),
    supabaseAdmin.from('MailEvent').select('id').eq('event_type', 'pantopus_letter_made').eq('metadata->>letter', key).limit(1),
  ]);
  if (readError || markerError) throw new Error((readError || markerError).message);
  if (existing || marker?.length) { made.add(key); return { id, created: false }; }
  const now = new Date();
  const row = {
    id,
    ...SENDER,
    recipient_user_id: letter.recipient_user_id || null,
    recipient_home_id: letter.recipient_home_id || null,
    drawer: letter.drawer || 'personal',
    privacy: letter.privacy || 'private_to_person',
    delivery_visibility: letter.delivery_visibility || null,
    attn_user_id: letter.attn_user_id || null,
    type: 'letter',
    mail_type: 'letter',
    mail_object_type: 'envelope',
    subject: letter.subject,
    display_title: letter.subject,
    content: letter.content,
    preview_text: letter.content.slice(0, 140),
    key_facts: letter.key_facts || [],
    lifecycle: letter.filed_folder_id ? 'filed' : 'delivered',
    ...(letter.filed_folder_id ? { vault_folder_id: letter.filed_folder_id } : {}),
    ...(letter.category ? { category: letter.category } : {}),
    tags: ['pantopus-letter'],
    mail_extracted: {
      from_pantopus: true,
      pantopus_letter: key,
      summary: letter.summary,
      summary_source: 'sender',
      summary_at: now.toISOString(),
      ...(letter.enclosures?.length ? { enclosures: letter.enclosures } : {}),
    },
  };
  const delivery = letter.delivered_at
    ? { delivered_at: new Date(letter.delivered_at).toISOString(), special_delivery: false }
    : await mailDelivery.deliveryFor(row, { now, immediate: Boolean(letter.immediate) });
  const stored = { ...row, ...delivery };
  const { error } = await supabaseAdmin.from('Mail').insert(stored);
  if (error) {
    if (error.code === '23505') { made.add(key); return { id, created: false }; } // made at the same moment elsewhere
    throw new Error(error.message);
  }
  made.add(key);
  if (made.size > 20000) made.clear();
  await supabaseAdmin.from('MailEvent').insert({ event_type: 'pantopus_letter_made', mail_id: id,
    user_id: letter.recipient_user_id || null, metadata: { letter: key } });
  await mailDelivery.afterStored([stored]);
  return { id, created: true };
}

/** Never throws: a letter that couldn't be written is logged and tried again the next time. */
async function sendSafe(key, letter) {
  try {
    return await send(key, letter);
  } catch (error) {
    logger.warn('Pantopus letter not written', { kind: key.split(':')[0], error: error.message });
    return null;
  }
}

/**
 * The welcome letter: once per person, the first time they open Mail while the mailbox is on. It waits sealed in Me
 * (in the box at once, not a special delivery). Words from the drawings (R13), kept true.
 */
async function ensureWelcomeLetter(userId, { homes = null, loadHomes = null } = {}) {
  if (!userId || !isLaunchFeatureEnabled('mailbox')) return null;
  const key = `welcome:${userId}`;
  if (made.has(key)) return { id: letterId(key), created: false };
  if (!homes && loadHomes) homes = await loadHomes().catch(() => []);
  homes = homes || [];
  const { data: user } = await supabaseAdmin.from('User').select('first_name, name').eq('id', userId).maybeSingle();
  const first = (user?.first_name || '').trim() || (user?.name || '').trim().split(/\s+/)[0] || '';
  const home = homes.find((h) => h.mail_access === 'open' && h.address_line);
  const opening = home ? `Welcome to your mailbox at ${home.address_line}.` : 'Welcome to your Pantopus mailbox.';
  const content = [
    first ? `Dear ${first},` : 'Hello,',
    '',
    opening,
    '',
    'From now on, mail for you and your home comes here once a day, in the morning: bills from businesses you hire '
      + 'through Pantopus and notices about your home.',
    '',
    "Anything that can't wait, like certified mail, comes right away as Special delivery.",
    '',
    "When something needs you, it waits on your Counter. When you're done, file it in the Vault, and it will be there "
      + 'whenever you need it.',
    '',
    'See you tomorrow morning,',
    'Your Pantopus carrier',
  ].join('\n');
  return sendSafe(key, {
    recipient_user_id: userId,
    subject: 'Welcome to your mailbox',
    content,
    summary: 'Your mailbox is ready. Mail comes once a morning; anything that can\'t wait comes right away as Special delivery.',
    key_facts: [{ label: 'Delivery', value: 'Every morning, about 7 a.m.' }, { label: 'Urgent mail', value: 'Comes right away' }],
    immediate: true,
  });
}

/**
 * A Home's welcome: when a person can open a Home's mail (they proved the address), a letter welcomes them to that
 * Home's mailbox. It goes to them alone, in the Home drawer, with the morning's mail.
 */
async function ensureHomeLetter(userId, home) {
  if (!userId || !home?.home_id || !isLaunchFeatureEnabled('mailbox')) return null;
  if (made.has(`home:${home.home_id}:${userId}`)) return { id: letterId(`home:${home.home_id}:${userId}`), created: false };
  let addressLine = home.address_line;
  if (!addressLine) {
    const { data } = await supabaseAdmin.from('Home').select('address, address2, name').eq('id', home.home_id).maybeSingle();
    addressLine = data ? [data.address, data.address2].filter(Boolean).join(', ') || data.name : null;
  }
  const address = addressLine || home.name || 'your home';
  return sendSafe(`home:${home.home_id}:${userId}`, {
    recipient_user_id: userId,
    recipient_home_id: home.home_id,
    drawer: 'home',
    delivery_visibility: 'attn_only',
    attn_user_id: userId,
    subject: `Welcome to the mailbox at ${address}`,
    content: [
      `You proved you live at ${address}, so its mail now comes to you too.`,
      '',
      'Bills and notices for your household arrive in the Home drawer each morning. When one of you opens a household '
        + 'letter, it is opened for everyone, like a real envelope.',
      '',
      'Your Pantopus carrier',
    ].join('\n'),
    summary: `You can now open the mail for ${address}. Household mail comes to the Home drawer each morning.`,
    key_facts: [{ label: 'Home', value: address }, { label: 'Delivery', value: 'Every morning, about 7 a.m.' }],
  });
}

/** Home welcomes for every Home whose mail this person may open now (`homes` from mailHomesOrThrow). */
async function ensureHomeLetters(userId, homes) {
  for (const home of (homes || []).filter((h) => h.mail_access === 'open')) await ensureHomeLetter(userId, home);
}

/**
 * The residency letter, as a Pantopus letter in Me with its PDF enclosed (privately), when one is issued.
 * `letter` is the issued ResidencyLetter row; `pdf` its bytes.
 */
async function residencyLetter({ userId, letter, pdf }) {
  if (!userId || !letter?.id || !pdf || !isLaunchFeatureEnabled('mailbox')) return null;
  const key = `residency:${letter.id}`;
  if (made.has(key)) return { id: letterId(key), created: false };
  try {
    const { data: existing } = await supabaseAdmin.from('Mail').select('id').eq('id', letterId(key)).maybeSingle();
    if (existing) { made.add(key); return { id: existing.id, created: false }; }
    // eslint-disable-next-line global-require
    const enclosure = await require('./mailEnclosures').keep({ buffer: pdf, name: 'Residency letter.pdf', mimeType: 'application/pdf' });
    const address = [letter.address_line1, letter.city].filter(Boolean).join(', ') || 'your home';
    const until = letter.expires_at ? new Date(letter.expires_at).toISOString().slice(0, 10) : null;
    return await send(key, {
      recipient_user_id: userId,
      subject: `Your residency letter for ${letter.address_line1 || 'your home'}`,
      content: [
        `Your residency letter for ${address} is enclosed.`,
        '',
        'Whoever you give it to can check it on pantopus.com with the code printed on it. '
          + (until ? `It is valid until ${until}, ` : '') + 'and you can revoke it any time from your home.',
        '',
        'Your Pantopus carrier',
      ].join('\n'),
      summary: `Your residency letter for ${address} is enclosed${until ? `; it's valid until ${until}` : ''}.`,
      key_facts: [{ label: 'Address', value: address }, ...(until ? [{ label: 'Valid until', value: until }] : []),
        ...(letter.purpose ? [{ label: 'Purpose', value: String(letter.purpose).slice(0, 80) }] : [])],
      enclosures: [enclosure],
    });
  } catch (error) {
    logger.warn('Pantopus residency letter not written', { error: error.message });
    return null;
  }
}

module.exports = { letterId, sendSafe, ensureWelcomeLetter, ensureHomeLetter, ensureHomeLetters, residencyLetter };
