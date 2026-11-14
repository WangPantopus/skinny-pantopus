/**
 * The person's Mail (launch key `mailbox`): what their Mail tab, Mail search and Sent show them, read
 * with the same rules and helpers as those screens, so the assistant can bring up a piece they ask about.
 *
 * find_mail mirrors the lists: a drawer (GET /api/mailbox/v2/drawer/:drawer, routes/mailboxV2.js:359), the
 * search (GET /api/mailbox/v2/search, routes/mailboxV2.js:512), the drawers' unread counts (GET /drawers,
 * routes/mailboxV2.js:238) and Sent (GET /api/mailbox/sent, routes/mailbox.js:2940). get_mail_item mirrors one
 * piece (GET /api/mailbox/v2/item/:id, routes/mailboxV2.js:615, and GET /api/mailbox/:id, routes/mailbox.js:3030)
 * and one piece in Sent (GET /api/mailbox/sent/:id, routes/mailbox.js:2973).
 *
 * Who may read what comes from utils/homeMailAccess: their own mail, their proven Homes' mail only as the
 * Home mail rule shows this member (homesMailFilter, visibleMailFilter, canAccessMail), and only pieces in
 * the box by now (onlyDelivered). Like the lists it leaves out deleted and shredded pieces, the Earn drawer
 * (hidden with mail_extras) and a bundle's wrapper where the screen shows its pieces. A failed access read
 * shows nothing.
 *
 * Read only. Nothing here marks a piece opened or viewed, makes a "Pantopus read this for you" note, starts
 * a read session or creates the welcome letter or a Vault folder: the routes do those on open, this doesn't.
 * No file links, storage keys, sender addresses or the email a card went to reach the model.
 */
const { DateTime } = require('luxon');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');
const {
  getAccessibleHomeIds, mailHomesOrThrow, canAccessMail, homeMailNeedsProof, homesMailFilter, visibleMailFilter, onlyDelivered,
  MAIL_HOME_NEEDS_PROOF,
} = require('../../utils/homeMailAccess');
const mailDelivery = require('../mailDelivery');
const mailPiece = require('../mailPiece');
const holidayCards = require('../holidayCards');
const mailEnclosures = require('../mailEnclosures');
const mailObjects = require('../mailObjectStorage');
const { attachInvoices } = require('../invoiceBills');
const { loadChatPeople } = require('../chatPeople');
const { presentMailSender, nameMailSenders } = require('../../utils/mailSenderView');
const { OTHERS_WORDS, isUuid, clip, dayLabel, todayIn, zoneOr } = require('./assistantKit');

const LIST_MAX = 15;
// Sent has no search of its own: words are matched against this many of the newest pieces.
const SENT_SEARCH_MAX = 50;
const LETTER_CHARS = 6000;
const BUNDLE_PIECES_MAX = 15;

const BOXES = ['me', 'home', 'business'];
const TABS = ['incoming', 'counter', 'vault', 'archived'];
// The tool's boxes are the Mail tab's drawers (Me, Home, Biz). Earn isn't one: it stays hidden with mail_extras.
const BOX_DRAWER = { me: 'personal', home: 'home', business: 'business' };
const DRAWER_BOX = { personal: 'me', home: 'home', business: 'business', earn: 'earn' };

const mailTools = [
  {
    name: 'find_mail',
    description: "Search or list the person's own Mail (the in-app mailbox) as their Mail tab, Mail search and Sent show it: their own mail, their home's mail only where Pantopus shows it to them, and Biz. Returns up to 15 pieces, newest delivery first (with tab \"counter\" or due_within_days, soonest due first), each with its mail_id, who it's from as the mailbox shows them and whether that sender is verified, title, kind, the day it came, due date, urgency, an amount due when its key facts have one, a bill's status, the \"Pantopus read this for you\" note, unread, starred and where it is (box, tab, Vault folder); also unread counts per box, how many pieces need them today, and `more` when more match. Use it for \"did my water bill come?\", \"what's due this week?\", \"find the letter from the county\" or \"what did I send Maya?\", then get_mail_item with a mail_id to read one piece in full. Read it again each time they ask: mail changes. Reading never marks anything opened.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: ['string', 'null'], maxLength: 100, description: 'Words every match must contain (in the sender, title, letter text or note), or null to list.' },
        box: { type: ['string', 'null'], enum: [...BOXES, null], description: '"me" (their own Me drawer), "home" (their home\'s mail), "business" (Biz), or null for all of them.' },
        tab: { type: ['string', 'null'], enum: [...TABS, null], description: '"incoming" (in the box), "counter" (waiting on them: due, or put on the Counter; these are in Incoming too), "vault" (filed), "archived", or null for every tab.' },
        unread_only: { type: ['boolean', 'null'], description: 'True for pieces they haven\'t opened yet. Null means any.' },
        due_within_days: { type: ['integer', 'null'], minimum: 0, maximum: 365, description: 'Only pieces due on or before this many days from today, overdue ones included (0 is today). With tab null, only pieces still in the box, not filed or archived. Null means any.' },
        direction: { type: ['string', 'null'], enum: ['received', 'sent', null], description: '"sent" for the letters and Christmas cards they sent (box, tab, unread_only and due_within_days don\'t apply there). Null means received.' },
      },
      required: ['query', 'box', 'tab', 'unread_only', 'due_within_days', 'direction'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_mail_item',
    description: "One piece of the person's Mail in full, by a mail_id from find_mail: the letter's text, the stored key facts, due date, sender, the names of its enclosures, a bill's status, and for a Christmas card its caption and note (no note while it's sealed until Christmas morning). A bundle lists its pieces; a piece they sent shows where it is, as Sent says it, and their own note. Use it before answering what a letter says or summarizing it. Never guess a mail_id: find it with find_mail first. Reading never marks it opened.",
    input_schema: {
      type: 'object',
      properties: { mail_id: { type: 'string', description: 'The mail_id from find_mail.' } },
      required: ['mail_id'],
      additionalProperties: false,
    },
  },
];

// ─── Words and dates ───────────────────────────────────────────────────────

const TRUST_WORDS = {
  verified_gov: 'verified government sender',
  verified_utility: 'verified utility',
  verified_business: 'verified business',
  pantopus_user: 'Pantopus member',
  unknown: 'not verified',
};
const URGENCY_WORDS = { due_soon: 'due soon', overdue: 'overdue', time_sensitive: 'time-sensitive' };

const sameYear = (at, zone) => at.year === DateTime.now().setZone(zoneOr(zone)).year;

/** "Tuesday, October 20" for a time in `zone`, with the year when it isn't this year. */
function dayWithYear(iso, zone) {
  const label = dayLabel(iso, zone);
  if (!label) return null;
  const at = DateTime.fromISO(String(iso), { zone: 'utc' }).setZone(zoneOr(zone));
  return sameYear(at, zone) ? label : `${label}, ${at.year}`;
}

/**
 * "Friday, November 20" for a bare date ("2026-11-20"), read as that day: a due date has no time, and
 * dayLabel would move it to the day before in the Americas.
 */
function dateLabel(isoDate, zone) {
  const day = DateTime.fromISO(String(isoDate || '').slice(0, 10), { zone: 'utc' });
  if (!day.isValid) return null;
  const label = day.toFormat('cccc, LLLL d');
  return sameYear(day, zone) ? label : `${label}, ${day.year}`;
}

/** Whole days from today (in `zone`) to a bare date: 0 today, negative once it has passed. */
function daysFrom(today, isoDate) {
  const day = DateTime.fromISO(String(isoDate || '').slice(0, 10), { zone: 'utc' });
  if (!day.isValid) return null;
  return Math.round(day.diff(DateTime.fromISO(today, { zone: 'utc' }), 'days').days);
}

/** `value` without null, undefined and empty lists, so a list of pieces stays short. */
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item != null && !(Array.isArray(item) && !item.length)));
}

// A category the sender's system set ("receipt", "utility_bill"); anything else isn't passed on.
const CATEGORY = /^[a-z][a-z _-]{0,39}$/i;

const money = (cents, currency) => {
  const amount = (Number(cents || 0) / 100).toFixed(2);
  return String(currency || 'usd').toLowerCase() === 'usd' ? `$${amount}` : `${amount} ${String(currency).toUpperCase()}`;
};

// The key fact that says what is owed, if one does ("Amount due: $84.00", or the summarizer's "Total").
const OWED_LABEL = /(amount|balance|total|payment)\s*(due|owed)|amount owed|minimum payment/i;
const AMOUNT_LABEL = /amount|balance|total|owed|payment|premium/i;
const MONEY = /[$€£]\s*\d|\d[\d,]*\.\d{2}\b|\b\d[\d,.]*\s*(usd|dollars)\b/i;
function amountDue(facts) {
  const priced = facts.filter((fact) => MONEY.test(fact.value) && !/date|day/i.test(fact.label));
  const fact = priced.find((f) => OWED_LABEL.test(f.label)) || priced.find((f) => AMOUNT_LABEL.test(f.label));
  return fact ? clip(fact.value, 40) : null;
}

// Account, policy and card numbers in key facts keep their last four digits only: the assistant has no need
// to say them whole (the letter's own text, the person's own mail, is passed on as it is).
const ACCOUNT_LABEL = /account|acct|policy|routing|card|member|ssn|social security|tax id|ein\b/i;
function maskedFact(fact) {
  if (!ACCOUNT_LABEL.test(fact.label)) return fact.value;
  return fact.value.replace(/\d[\d -]{3,}\d/g, (run) => {
    const digits = run.replace(/\D/g, '');
    return digits.length >= 5 ? `••••${digits.slice(-4)}` : run;
  });
}

function enclosureType(mimeType) {
  const type = String(mimeType || '');
  if (type === 'application/pdf') return 'PDF';
  if (type.startsWith('image/')) return 'photo';
  return 'file';
}

// ─── The sender, as the mailbox shows them ─────────────────────────────────

/**
 * The name the lists show (resolveSenderDisplay, routes/mailboxV2.js:207). The lists also fall back to the
 * sender's account name or username from a join; this doesn't read the account, so a piece with no stored
 * name and no Local Profile to read says "Someone" rather than an account name.
 */
function resolveSenderDisplay(mail) {
  const senderDisplay = typeof mail?.sender_display === 'string' ? mail.sender_display.trim() : '';
  if (senderDisplay) return senderDisplay;
  const senderBusiness = typeof mail?.sender_business_name === 'string' ? mail.sender_business_name.trim() : '';
  if (senderBusiness) return senderBusiness;
  return 'Someone';
}

/** Whether the sender is verified, as the lists say it (resolveSenderTrust, routes/mailboxV2.js:223). */
function resolveSenderTrust(mail) {
  const trust = typeof mail?.sender_trust === 'string' ? mail.sender_trust.trim() : '';
  if (['verified_gov', 'verified_utility', 'verified_business', 'pantopus_user', 'unknown'].includes(trust)) return trust;
  // A business name alone is not verification: senders could type any name.
  if (mail?.sender_user_id) return 'pantopus_user';
  return 'unknown';
}

/**
 * A piece as the lists answer it: the sender named as neighbors see them (nameMailSenders ran first), a
 * letter sent as a business naming the business (presentMailSender), and mailPiece.present's kind, note,
 * Counter mark and card. The lists work out trust before presentMailSender, so trust is read first here too.
 */
function shownPiece(mail, userId, zone) {
  const trust = resolveSenderTrust(mail);
  const shown = presentMailSender(mail, userId);
  return mailPiece.present({ ...shown, sender_display: resolveSenderDisplay(shown), sender_trust: trust }, { timeZone: zone });
}

// ─── A piece for the model ─────────────────────────────────────────────────

/** Where a piece is: the tab that shows it (a piece on the Counter is in Incoming too), or null. */
function tabOf(piece) {
  // The tabs' filters (routes/mailboxV2.js:437-447): Incoming and the Counter are delivered or opened and not
  // archived; the Vault is filed; Archived is archived.
  if (['delivered', 'opened'].includes(piece.lifecycle || 'delivered') && !piece.archived) {
    return piece.on_counter ? 'counter' : 'incoming';
  }
  if (piece.lifecycle === 'filed') return 'vault';
  if (piece.archived) return 'archived';
  return null;
}

function pieceForModel(piece, { zone, today, folders, full = false }) {
  const facts = mailPiece.keyFacts(piece.key_facts);
  const card = piece.card;
  const bundle = piece.kind === 'bundle';
  return compact({
    mail_id: piece.id,
    sender_text: clip(piece.sender_display, 80),
    from_pantopus: piece.from_pantopus || null,
    sender_trust: TRUST_WORDS[piece.sender_trust] || TRUST_WORDS.unknown,
    title_text: clip((bundle && piece.bundle_label) || piece.display_title || piece.subject, full ? 200 : 70),
    kind: card ? 'Christmas card' : piece.kind,
    // The list keeps to what tells pieces apart; get_mail_item adds the category and the ISO due date.
    category: full && CATEGORY.test(String(piece.category || '')) ? piece.category : null,
    delivered: dayWithYear(piece.delivered_at, zone),
    due: piece.due_date ? dateLabel(piece.due_date, zone) : null,
    due_date: full && piece.due_date ? String(piece.due_date).slice(0, 10) : null,
    due_in_days: piece.due_date ? daysFrom(today, piece.due_date) : null,
    urgency: URGENCY_WORDS[piece.urgency] || null,
    // A bill from a business invoice, read live (invoiceBills.attachInvoices): paid and void bills are done. Its
    // total is the amount due, so the key facts' amount is only given without one.
    bill: piece.invoice ? { status: piece.invoice.status, total: money(piece.invoice.total_cents, piece.invoice.currency) } : null,
    amount_due_text: piece.invoice ? null : amountDue(facts),
    summary_text: clip(piece.summary?.text, full ? 600 : 100),
    unread: !piece.viewed && !piece.opened_at,
    starred: piece.starred || null,
    box: DRAWER_BOX[piece.drawer || 'personal'] || null,
    tab: tabOf(piece),
    folder_text: piece.lifecycle === 'filed' ? clip(folders.get(piece.vault_folder_id), 60) : null,
    enclosures: full ? null : (mailEnclosures.listFor(piece).length || null),
    card: card ? compact({
      caption: card.caption || null,
      sealed: card.sealed || null,
      opens: card.sealed ? dayWithYear(card.sealed_until, zone) : null,
    }) : null,
    bundle_pieces: bundle ? (piece.bundle_item_count ?? null) : null,
  });
}

/**
 * The names of the Vault folders these pieces are filed in, by folder id, for folders this person may see:
 * resolveFolder's rule (services/mailVault.js:167): their own Me or Biz folder, or a folder of a Home whose
 * mail they may read. A copy of a Home folder carries the same label as the one shown. A failed read names none.
 */
async function folderLabels(pieces, userId, homeIds) {
  const ids = [...new Set(pieces.filter((p) => p.lifecycle === 'filed' && isUuid(p.vault_folder_id)).map((p) => p.vault_folder_id))];
  if (!ids.length) return new Map();
  const { data, error } = await supabaseAdmin.from('VaultFolder').select('id, user_id, home_id, drawer, label').in('id', ids);
  if (error) return new Map();
  const seen = (folder) => (folder.drawer === 'home' ? Boolean(folder.home_id) && homeIds.includes(folder.home_id) : folder.user_id === userId);
  return new Map((data || []).filter(seen).map((folder) => [folder.id, folder.label]));
}

// ─── Received: the lists and search ────────────────────────────────────────

const LIST_SELECT = [
  'id', 'recipient_user_id', 'recipient_home_id', 'drawer', 'type', 'mail_type', 'mail_object_type', 'subject', 'display_title',
  'preview_text', 'sender_user_id', 'sender_entity_id', 'sender_business_name', 'sender_display', 'sender_trust', 'category',
  'urgency', 'due_date', 'key_facts', 'lifecycle', 'archived', 'starred', 'viewed', 'opened_at', 'action_required',
  'delivered_at', 'created_at', 'deleted_at', 'vault_folder_id', 'bundle_id', 'bundle_label', 'bundle_item_count',
  'attachments', 'mail_extracted', 'invoice_id',
].join(', ');
const ITEM_SELECT = `${LIST_SELECT}, content, object_id`;

// What the search matches (SEARCH_FIELDS, routes/mailboxV2.js:507), and its page limit (SEARCH_MAX_PAGES).
const SEARCH_FIELDS = ['subject', 'display_title', 'sender_display', 'sender_business_name', 'preview_text', 'content',
  'mail_extracted->>summary'];
const SEARCH_MAX_PAGES = 10;

/**
 * The search's words (routes/mailboxV2.js:515-525): at most six, of letters, digits and a few signs, so
 * nothing reads as query syntax. Answers { terms } or { error }.
 */
function searchTerms(query) {
  const text = query.normalize('NFKC').replace(/[\u0000-\u001f]/g, ' ').trim();
  if (text.length > 100) return { error: 'Search for 100 characters or fewer.' };
  const terms = [...new Set(text.toLowerCase().split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}$.@'&-]/gu, '').replace(/^[.'&-]+|[.'&-]+$/g, ''))
    .filter((t) => t.length > 0))].slice(0, 6);
  return terms.length ? { terms } : { error: 'Search with letters or numbers.' };
}

// The search's own check after naming senders (routes/mailboxV2.js:547): a letter a person sent matches only
// by the name they show now, never one they no longer show.
const matchesNow = (item, term) => [item.sender_display, item.sender_business_name && !item.sender_user_id ? item.sender_business_name : null,
  item.subject, item.display_title, item.preview_text, item.content, item.mail_extracted?.summary]
  .some((value) => typeof value === 'string' && value.toLowerCase().includes(term));

// An English stem the plain check can't see (matchesStem, routes/mailboxV2.js:586).
function matchesStem(item, term) {
  const stem = term.slice(0, Math.max(4, Math.min(5, term.length)));
  return typeof item.content === 'string' && new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(item.content);
}

/**
 * The query for the pieces asked for. Each part is a route's own filter:
 *  - a box is GET /drawer/:drawer's scope (routes/mailboxV2.js:412-429): Me is their own letters, Home only
 *    Home letters the Home mail rule shows this member (homesMailFilter, M01), Biz their own letters or Home
 *    letters filed there that the rule shows them (visibleMailFilter);
 *  - no box is the search's scope (routes/mailboxV2.js:530-539): everything they may read, never Earn;
 *  - a tab is the drawer route's tab filter (routes/mailboxV2.js:431-447), Incoming showing a bundle as one
 *    piece; words or no tab use the search's rule instead: never shredded, a bundle's pieces on their own and
 *    never its wrapper;
 *  - unread is the drawer route's `filter=unread` (routes/mailboxV2.js:450); words are the search's
 *    (routes/mailboxV2.js:542). Due dates are the Counter's own field.
 * Every read is delivered by now (onlyDelivered) and not deleted.
 */
function receivedQuery({ userId, homeIds, drawer, tab, terms, unreadOnly, dueBy }) {
  let query = onlyDelivered(supabaseAdmin.from('Mail')
    .select(terms.length ? `${LIST_SELECT}, content` : LIST_SELECT, { count: 'exact' })
    .is('deleted_at', null));

  if (drawer === 'personal') query = query.eq('drawer', 'personal').eq('recipient_user_id', userId);
  else if (drawer === 'home') query = query.eq('drawer', 'home').or(homesMailFilter(homeIds, userId));
  else if (drawer === 'business') query = query.eq('drawer', 'business').or(visibleMailFilter(userId, homeIds));
  else query = query.or(visibleMailFilter(userId, homeIds)).or('drawer.is.null,drawer.neq.earn');

  if (terms.length || !tab) {
    query = query.or('lifecycle.is.null,lifecycle.neq.shredded').or('mail_object_type.is.null,mail_object_type.neq.bundle');
  } else if (tab === 'incoming') {
    query = query.is('bundle_id', null);
  }
  if (tab === 'incoming') {
    query = query.in('lifecycle', ['delivered', 'opened']).eq('archived', false);
  } else if (tab === 'counter') {
    query = query.in('lifecycle', ['delivered', 'opened']).eq('archived', false).or('action_required.eq.true,due_date.not.is.null');
  } else if (tab === 'vault') {
    query = query.eq('lifecycle', 'filed');
  } else if (tab === 'archived') {
    query = query.eq('archived', true).or('lifecycle.is.null,lifecycle.neq.shredded');
  }

  if (unreadOnly) query = query.is('opened_at', null).eq('viewed', false);
  if (dueBy) {
    query = query.not('due_date', 'is', null).lte('due_date', dueBy);
    // Due and still waiting: in the box, as the Counter keeps it (filed or archived pieces are done).
    if (!tab) query = query.in('lifecycle', ['delivered', 'opened']).eq('archived', false);
  }
  for (const term of terms) {
    query = query.or([...SEARCH_FIELDS.map((field) => `${field}.ilike.*${term}*`), `content.wfts(english).${term}`].join(','));
  }

  // The Counter soonest due first, undated last; every list then newest delivery first (routes/mailboxV2.js:405-409).
  if (tab === 'counter' || dueBy) query = query.order('due_date', { ascending: true, nullsFirst: false });
  return query.order('delivered_at', { ascending: false }).order('id', { ascending: false });
}

/** The pieces asked for, senders named, with the total that matched. Words page on as the search does. */
async function listReceived(options, userId) {
  const query = receivedQuery(options);
  if (!options.terms.length) {
    const { data, error, count } = await query.range(0, LIST_MAX - 1);
    if (error?.code === 'PGRST103') return { rows: [], total: 0 };
    if (error) throw new Error(error.message);
    return { rows: await nameMailSenders(data || [], userId), total: count || 0 };
  }
  // routes/mailboxV2.js:550-569: a page whose matches were only names a sender no longer shows is skipped,
  // up to SEARCH_MAX_PAGES pages, without showing those names or claiming there were no matches.
  let kept = [];
  let nextOffset = 0;
  let count = 0;
  let excluded = 0;
  let pages = 0;
  do {
    const result = await query.range(nextOffset, nextOffset + LIST_MAX - 1);
    if (result.error?.code === 'PGRST103') break;
    if (result.error) throw new Error(result.error.message);
    const found = result.data || [];
    count = result.count || 0;
    nextOffset += found.length;
    const named = await nameMailSenders(found, userId);
    kept = named.filter((item) => (item.sender_user_id
      ? options.terms.every((term) => matchesNow(item, term) || matchesStem(item, term)) : true));
    excluded += named.length - kept.length;
    if (!found.length) break;
    pages += 1;
  } while (!kept.length && nextOffset < count && pages < SEARCH_MAX_PAGES);
  return { rows: kept, total: Math.max(0, count - excluded) };
}

/**
 * Unopened pieces in one drawer, as the Mail tab's badge counts them (countForDrawer, routes/mailboxV2.js:259-300):
 * in Incoming (delivered or opened, not archived), not viewed, a bundle counted once through its pieces.
 */
async function unreadIn(drawer, userId, homeIds, now) {
  if (drawer === 'home' && homeIds.length === 0) return 0;
  const unopened = (select, options) => {
    let query = onlyDelivered(supabaseAdmin.from('Mail').select(select, options)
      .eq('drawer', drawer)
      .eq('viewed', false)
      .in('lifecycle', ['delivered', 'opened'])
      .eq('archived', false)
      .is('deleted_at', null)
      .or('mail_object_type.is.null,mail_object_type.neq.bundle'), now);
    if (drawer === 'personal') query = query.eq('recipient_user_id', userId);
    else if (drawer === 'home') query = query.or(homesMailFilter(homeIds, userId));
    else query = query.or(visibleMailFilter(userId, homeIds));
    return query;
  };
  const { data, error } = await unopened('bundle_id').order('delivered_at', { ascending: false }).limit(mailDelivery.LISTED_PIECES_MAX);
  if (error) throw new Error(error.message);
  return (data || []).length < mailDelivery.LISTED_PIECES_MAX
    ? mailDelivery.countListedPieces(data || []) : mailDelivery.countPieces(unopened);
}

/**
 * The Mail tab's numbers: unopened pieces per box (its badges), and from the Today screen's mail line
 * (mailDelivery.todaySummary) how many pieces need them today and how many of this morning's are unopened.
 */
async function mailCounts(userId, homeIds) {
  const now = new Date();
  const [me, home, business, today] = await Promise.all([
    unreadIn('personal', userId, homeIds, now),
    unreadIn('home', userId, homeIds, now),
    unreadIn('business', userId, homeIds, now),
    mailDelivery.todaySummary({ userId, now }).catch(() => null),
  ]);
  return compact({
    unread_me: me,
    unread_home: home,
    unread_business: business,
    needs_you_today: today ? today.needs_you_today : null,
    this_morning_unopened: today?.last_at ? today.last_unopened : null,
  });
}

/** How many Homes they live at whose mail waits for them to prove the address (D1). A failed read counts none. */
async function homesWaitingForProof(userId, homeIds) {
  try {
    const homes = await mailHomesOrThrow(userId, { openHomeIds: Promise.resolve(homeIds) });
    return homes.filter((home) => home.mail_access === 'needs_proof').length;
  } catch (_) {
    return 0;
  }
}

async function findReceived(filters, ctx) {
  const userId = ctx.userId;
  const zone = zoneOr(ctx.timeZone);
  const today = todayIn(zone);
  // Fails closed: when the Homes can't be read, they read only their own mail.
  const homeIds = await getAccessibleHomeIds(userId);
  const drawer = filters.box ? BOX_DRAWER[filters.box] : null;
  const dueBy = filters.dueWithinDays == null
    ? null : DateTime.fromISO(today, { zone: 'utc' }).plus({ days: filters.dueWithinDays }).toISODate();
  const [listed, counts, waitingHomes] = await Promise.all([
    drawer === 'home' && !homeIds.length
      ? { rows: [], total: 0 }
      : listReceived({ userId, homeIds, drawer, tab: filters.tab, terms: filters.terms, unreadOnly: filters.unreadOnly, dueBy }, userId),
    mailCounts(userId, homeIds).catch((err) => {
      logger.warn('assistant mail counts failed', { userId, error: err?.message });
      return null;
    }),
    !drawer || drawer === 'home' ? homesWaitingForProof(userId, homeIds) : 0,
  ]);
  const pieces = await attachInvoices(listed.rows.map((mail) => shownPiece(mail, userId, zone)));
  const folders = await folderLabels(pieces, userId, homeIds);
  const mail = pieces.map((piece) => pieceForModel(piece, { zone, today, folders }));
  const more = listed.total - mail.length;
  let empty = null;
  if (!mail.length) {
    empty = drawer === 'home' && !homeIds.length
      ? "They can't read any home's mail yet."
      : 'Nothing in their Mail matches. That is not proof a piece never came: say what you searched.';
  }
  return compact({
    note: `${OTHERS_WORDS} Their own mail only, as their Mail tab shows it. Reading it marked nothing opened.`,
    mail,
    more: more > 0 ? more : null,
    empty,
    counts,
    home_mail_waiting: waitingHomes
      ? `Mail for ${waitingHomes === 1 ? 'a home' : `${waitingHomes} homes`} they live at opens once they prove the address; it waits in the Home box until then.`
      : null,
  });
}

// ─── Sent ──────────────────────────────────────────────────────────────────

// Sent's columns (SENT_SELECT, routes/mailbox.js:2893) without escrow_recipient_contact: the email address a card
// or letter went to never reaches the model.
const SENT_SELECT = 'id, created_at, delivered_at, escrow_status, escrow_expires_at, recipient_user_id, recipient_home_id, sender_display, object_id, mail_extracted, subject, display_title';

/**
 * Who each piece went to, as Sent names them (sentContexts, routes/mailbox.js:2910): whoever claimed it by email,
 * the name stored when it was sent, the person as neighbors see them, or "their household" ("your household" for
 * their own Home). Where Sent shows the masked email address, this says it went by email or link instead.
 */
async function sentNames(rows, userId) {
  const people = await loadChatPeople(rows.filter((mail) => mail.recipient_user_id).map((mail) => mail.recipient_user_id));
  const toHousehold = (mail) => !mail.recipient_user_id && Boolean(mail.recipient_home_id);
  const ownHomes = new Set(rows.some(toHousehold) ? (await getAccessibleHomeIds(userId)).map(String) : []);
  return rows.map((mail) => {
    const card = mail.mail_extracted?.card || {};
    const person = people.get(String(mail.recipient_user_id))?.displayName;
    let byEmail = null;
    if (mail.escrow_status) byEmail = card.by_link ? 'whoever opens the link' : 'someone they emailed';
    return {
      toName: (mail.escrow_status === 'claimed' && person) || card.to_name || card.withdrawn?.to_name || byEmail || person
        || (toHousehold(mail) ? `${ownHomes.has(String(mail.recipient_home_id)) ? 'your' : 'their'} household` : 'them'),
      toHousehold: toHousehold(mail),
    };
  });
}

/** The clock each piece's days are told by: the recipient's, or the sender's own for one by email (as Sent does). */
async function sentZones(rows, userId) {
  const ids = [...new Set([userId, ...rows.map((mail) => mail.recipient_user_id).filter(Boolean)].map(String))];
  return new Map(await Promise.all(ids.map(async (id) => [id, (await mailDelivery.personTimeZone(id)) || mailDelivery.FALLBACK_TIME_ZONE])));
}

/** Where a sent piece is, in Sent's own words (frontend iOS MailSentWords.statusLine; Android mirrors it). */
function sentStatusWords(piece, zone) {
  const letter = piece.kind === 'letter';
  const day = dateLabel(piece.arrives_on, zone) || dayWithYear(piece.arrives_at, zone);
  if (piece.by_link) {
    if (piece.status === 'claimed') return 'Someone opened your link and has your card';
    if (piece.status === 'expired') return 'Nobody opened your link in 90 days';
    if (piece.status === 'email_waiting') return 'Waiting for someone to open your link';
  }
  switch (piece.status) {
    case 'waiting':
      if (piece.arrival === 'christmas_morning') return 'Arrives on Christmas morning';
      return `Arrives with their 7 a.m. mail${day ? ` on ${day}` : ''}${piece.sealed ? ', sealed until Christmas' : ''}`;
    case 'picked_up': return 'Arrives on Christmas morning';
    case 'delivered': return piece.sealed ? 'In their mailbox, sealed until Christmas' : `In their mailbox${day ? ` since ${day}` : ''}`;
    case 'email_waiting': return letter ? 'Waiting for them to claim it' : 'Waiting for them to open the email';
    case 'claimed': return letter ? 'They claimed your letter' : 'They joined Pantopus and have it';
    case 'expired': return letter ? 'The claim link expired' : 'They didn’t open the email in 90 days';
    case 'not_delivered': return 'Couldn’t be delivered';
    default: return null;
  }
}

/** A piece in Sent (holidayCards.sentPiece) for the model. */
function sentForModel(piece, zone) {
  const card = piece.kind === 'card';
  return compact({
    mail_id: piece.id,
    kind: card ? 'Christmas card' : 'letter',
    title_text: card ? null : clip(piece.subject, 90),
    to_text: clip(piece.to_name, 80),
    to_household: piece.to_household || null,
    by_email: (piece.by_email && !piece.by_link) || null,
    by_link: piece.by_link || null,
    sent: dayWithYear(piece.sent_at, zone),
    status_says: sentStatusWords(piece, zone),
    opens: piece.opens_on ? dateLabel(piece.opens_on, zone) : null,
    can_take_back: piece.can_take_back || null,
    take_back_until: piece.can_take_back && piece.take_back_until ? DateTime.fromISO(piece.take_back_until, { zone: 'utc' })
      .setZone(zoneOr(zone)).toFormat("cccc, LLLL d 'at' h:mm a") : null,
    caption: card ? piece.card?.caption || null : null,
  });
}

function sentPieces(rows, names, zones, userId) {
  const now = new Date();
  return rows.map((mail, i) => holidayCards.sentPiece(mail, {
    toName: names[i].toName,
    toHousehold: names[i].toHousehold,
    senderName: null,
    zone: zones.get(String(mail.recipient_user_id || userId)),
    now,
  }));
}

/** Sent (GET /api/mailbox/sent, routes/mailbox.js:2940): their letters and cards, newest first, cards a block stopped included. */
async function findSent(filters, ctx) {
  const userId = ctx.userId;
  const words = filters.terms;
  const { data, error, count } = await holidayCards.sentCards(userId, SENT_SELECT, { count: 'exact' }, { notDelivered: true })
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .limit(words.length ? SENT_SEARCH_MAX : LIST_MAX);
  if (error) throw new Error(error.message);
  const rows = data || [];
  const names = await sentNames(rows, userId);
  let matched = rows.map((mail, i) => ({ mail, name: names[i] }));
  if (words.length) {
    matched = matched.filter(({ mail, name }) => {
      const text = [mail.subject, mail.display_title, name.toName, holidayCards.cardView(mail)?.caption]
        .filter((value) => typeof value === 'string').join(' ').toLowerCase();
      return words.every((word) => text.includes(word));
    });
  }
  const page = matched.slice(0, LIST_MAX);
  const zones = await sentZones(page.map((entry) => entry.mail), userId);
  const sent = sentPieces(page.map((entry) => entry.mail), page.map((entry) => entry.name), zones, userId)
    .map((piece) => sentForModel(piece, ctx.timeZone));
  const more = words.length ? matched.length - page.length : (count || 0) - page.length;
  const ignored = filters.box || filters.tab || filters.unreadOnly || filters.dueWithinDays != null;
  return compact({
    note: `${OTHERS_WORDS} What they sent, as their Sent shows it. Sent never says whether anyone opened, kept or shredded a piece; never guess it.`,
    sent,
    more: more > 0 ? more : null,
    searched: words.length && (count || 0) > SENT_SEARCH_MAX ? `Only their newest ${SENT_SEARCH_MAX} sent pieces were searched.` : null,
    ignored: ignored ? 'Sent has no boxes, tabs, unread marks or due dates, so those filters were left out.' : null,
    empty: sent.length ? null : (words.length ? 'Nothing they sent matches.' : "They haven't sent any letters or cards."),
  });
}

// ─── One piece ─────────────────────────────────────────────────────────────

const NOT_FOUND = { error: "That piece isn't in their mailbox (it may have been removed). Find it with find_mail first." };

/**
 * A bundle's pieces this person may read (bundlePieces, routes/mailboxV2.js:592): delivered, not shredded or
 * deleted, by the same visibility rule as search, newest first.
 */
async function bundlePieces(bundleId, userId, homeIds, zone) {
  const { data, error } = await onlyDelivered(supabaseAdmin.from('Mail')
    .select(LIST_SELECT).eq('bundle_id', bundleId)
    .or(visibleMailFilter(userId, homeIds)).or('lifecycle.is.null,lifecycle.neq.shredded')
    .is('deleted_at', null), new Date())
    .order('delivered_at', { ascending: false }).order('id', { ascending: false })
    .limit(BUNDLE_PIECES_MAX + 1);
  if (error) throw new Error(error.message);
  const named = await nameMailSenders(data || [], userId);
  return named.map((mail) => shownPiece(mail, userId, zone));
}

/**
 * A received piece, as GET /api/mailbox/v2/item/:id and GET /api/mailbox/:id answer it once the caller may read it,
 * without their writes: no opened mark, no event, no note made on first open. The letter's text comes from its
 * stored copy (mailObjectStorage.hydrateMail), and a Christmas card sealed until Christmas morning gives no note.
 */
async function receivedItem(row, ctx) {
  const userId = ctx.userId;
  const zone = zoneOr(ctx.timeZone);
  const today = todayIn(zone);
  let hydrated = row;
  let textUnreadable = false;
  try {
    hydrated = await mailObjects.hydrateMail(row);
  } catch (err) {
    // A storage failure leaves the text out rather than passing off the stored preview as the whole letter.
    textUnreadable = true;
    logger.warn('assistant mail text unreadable', { userId, error: err?.message });
  }
  const [named] = await nameMailSenders([hydrated], userId);
  const objectPayload = hydrated.object_payload || null;
  const homeIds = await getAccessibleHomeIds(userId);
  const piece = await mailPiece.withBundleLabels(await attachInvoices(shownPiece(named, userId, zone)));
  const isCard = holidayCards.isCard(piece);
  const sealed = isCard && holidayCards.isSealed(piece);
  const isBundle = piece.kind === 'bundle';
  const [folders, pieces] = await Promise.all([
    folderLabels([piece], userId, homeIds),
    isBundle ? bundlePieces(piece.id, userId, homeIds, zone) : null,
  ]);

  const text = textUnreadable ? null : [hydrated.content_text, hydrated.content].find((value) => typeof value === 'string' && value.trim());
  const flat = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  const enclosures = sealed ? [] : mailEnclosures.listFor(named, objectPayload?.envelope?.attachments || objectPayload?.attachments);
  const facts = mailPiece.keyFacts(piece.key_facts);
  let addressedTo = null;
  if (row.recipient_user_id === userId) addressedTo = 'you';
  else if (row.recipient_home_id) addressedTo = 'your household';

  const mail = compact({
    ...pieceForModel(piece, { zone, today, folders, full: true }),
    addressed_to: addressedTo,
    in_bundle_text: piece.bundle_id ? clip(piece.bundle_label, 80) : null,
    key_facts_text: facts.map((fact) => clip(`${fact.label}: ${maskedFact(fact)}`, 160)),
    letter_text: !isCard && !isBundle && flat ? clip(flat, LETTER_CHARS) : null,
    letter_cut: !isCard && !isBundle && flat.length > LETTER_CHARS ? `Only the first ${LETTER_CHARS} characters are here.` : null,
    letter_unreadable: textUnreadable ? "The letter's text couldn't be read just now; say so rather than guessing." : null,
    preview_text: textUnreadable ? clip(row.preview_text, 280) : null,
    enclosures: enclosures.slice(0, 10).map((enclosure) => ({ name_text: clip(enclosure.name, 120), type: enclosureType(enclosure.mime_type) })),
    card: isCard ? compact({
      caption: piece.card?.caption || null,
      sealed: sealed || null,
      opens: sealed ? dayWithYear(piece.card?.sealed_until, zone) : null,
      note_text: !sealed && !textUnreadable ? clip(text, 600) : null,
      has_photo: (!sealed && Boolean(piece.card?.photo)) || null,
      has_voice: (!sealed && Boolean(piece.card?.voice)) || null,
    }) : null,
    pieces: pieces ? pieces.slice(0, BUNDLE_PIECES_MAX).map((p) => compact({
      mail_id: p.id,
      sender_text: clip(p.sender_display, 80),
      title_text: clip(p.display_title || p.subject, 90),
      kind: p.kind,
      delivered: dayWithYear(p.delivered_at, zone),
      due: p.due_date ? dateLabel(p.due_date, zone) : null,
      unread: !p.viewed && !p.opened_at,
    })) : null,
    more_pieces: pieces && pieces.length > BUNDLE_PIECES_MAX ? 'This bundle has more pieces; find_mail lists them.' : null,
  });
  return {
    note: `${OTHERS_WORDS} Their own mail. Reading it marked nothing opened. Don't read out account or policy numbers unless they ask for them.`,
    mail,
  };
}

/** A piece in their own Sent (GET /api/mailbox/sent/:id, routes/mailbox.js:2973), with their own note. Null when it isn't theirs. */
async function sentItem(id, ctx) {
  const userId = ctx.userId;
  const { data: mail, error } = await holidayCards.sentCards(userId, `${SENT_SELECT}, content`, undefined, { notDelivered: true })
    .eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!mail) return null;
  // Cards keep their note only in private storage; older letters may keep it inline.
  let stored = { metadata: null, payload: null };
  let unreadable = false;
  if (mail.object_id) {
    try {
      stored = await mailObjects.readPayload(mail.object_id);
    } catch (err) {
      unreadable = true;
      logger.warn('assistant sent mail text unreadable', { userId, error: err?.message });
    }
  }
  const { metadata, payload } = stored;
  const content = [payload?.body?.content, payload?.content, mail.content].find((value) => typeof value === 'string') || '';
  const format = [payload?.body?.payload?.bodyFormat, payload?.objectFormat, metadata?.format]
    .find((value) => ['plain_text', 'markdown', 'html'].includes(value)) || mailObjects.storedFormat(content);
  const isCard = holidayCards.isCard(mail);
  const own = isCard ? (payload?.body?.content || '') : (mailObjects.textContent(content, format) || '');
  const [names, zones] = await Promise.all([sentNames([mail], userId), sentZones([mail], userId)]);
  const [piece] = sentPieces([mail], names, zones, userId);
  const flat = own.replace(/\s+/g, ' ').trim();
  return {
    note: `${OTHERS_WORDS} A piece they sent, as their Sent shows it, with their own words. Sent never says whether anyone opened or kept it.`,
    mail: compact({
      ...sentForModel(piece, ctx.timeZone),
      direction: 'sent',
      note_text: isCard && !unreadable ? clip(flat, 600) : null,
      letter_text: !isCard && !unreadable && flat ? clip(flat, LETTER_CHARS) : null,
      letter_unreadable: unreadable ? "Their words couldn't be read just now; say so rather than guessing." : null,
    }),
  };
}

async function readMailItem(args, ctx) {
  // `mail_item_id` is the older tool's name for it.
  const id = typeof args.mail_id === 'string' ? args.mail_id.trim() : args.mail_item_id;
  if (!isUuid(id)) return { error: "That isn't a mail_id. Find the piece with find_mail first." };
  const userId = ctx.userId;
  const { data: row, error } = await supabaseAdmin.from('Mail').select(ITEM_SELECT).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  // The lists never show a shredded piece, nor Earn while mail_extras is off; canAccessMail decides the rest
  // (their own, or a Home letter the Home mail rule shows them; delivered by now; not deleted).
  const hidden = Boolean(row) && (row.lifecycle === 'shredded' || (row.drawer === 'earn' && !isLaunchFeatureEnabled('mail_extras')));
  if (row && !hidden && await canAccessMail(row, userId)) return receivedItem(row, ctx);
  const sent = await sentItem(id, ctx);
  if (sent) return sent;
  // A Home letter they'll see once they prove the address says so, as the routes answer it (sendMailUnavailable).
  if (row && !hidden && await homeMailNeedsProof(row, userId)) {
    return { error: `That piece is their home's mail, which opens once they prove the address. Their Mail says: "${MAIL_HOME_NEEDS_PROOF.error}"` };
  }
  return NOT_FOUND;
}

// ─── find_mail ─────────────────────────────────────────────────────────────

async function findMail(args, ctx) {
  if (args.box != null && !BOXES.includes(args.box)) return { error: 'Choose box "me", "home" or "business", or null for all.' };
  if (args.tab != null && !TABS.includes(args.tab)) return { error: 'Choose tab "incoming", "counter", "vault" or "archived", or null for all.' };
  if (args.direction != null && !['received', 'sent'].includes(args.direction)) return { error: 'Choose direction "received" or "sent".' };
  const days = args.due_within_days;
  if (days != null && (!Number.isInteger(days) || days < 0 || days > 365)) return { error: 'Choose due_within_days from 0 to 365, or null.' };
  let terms = [];
  if (typeof args.query === 'string' && args.query.trim()) {
    const parsed = searchTerms(args.query);
    if (parsed.error) return { error: parsed.error };
    terms = parsed.terms;
  }
  const filters = {
    terms,
    box: args.box || null,
    tab: args.tab || null,
    unreadOnly: args.unread_only === true,
    dueWithinDays: days ?? null,
  };
  return args.direction === 'sent' ? findSent(filters, ctx) : findReceived(filters, ctx);
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

const MAIL_EXECUTORS = { find_mail: findMail, get_mail_item: readMailItem };
const MAIL_TOOL_NAMES = new Set(Object.keys(MAIL_EXECUTORS));
const mailReadToolDefinitions = mailTools;

async function runMailReadTool(name, args, ctx) {
  const executor = MAIL_EXECUTORS[name];
  if (!executor) return null;
  // The mailbox is a launch-cut feature: with it off, nothing here reads mail (agentService also leaves the tools out).
  if (!isLaunchFeatureEnabled('mailbox')) return { error: "Mail isn't available for this person yet." };
  if (!ctx?.userId) return { error: "That couldn't be read just now." };
  try {
    return await executor(args || {}, ctx);
  } catch (err) {
    logger.warn('assistant read tool failed', { tool: name, userId: ctx.userId, error: err?.message });
    return { error: `That couldn't be read just now (${name}).` };
  }
}

/** get_mail_item, for callers that dispatch it themselves: the same checks and the same plain error on a failure. */
function getMailItem(args, ctx) {
  return runMailReadTool('get_mail_item', args, ctx);
}

module.exports = { mailReadToolDefinitions, runMailReadTool, MAIL_TOOL_NAMES, getMailItem };
