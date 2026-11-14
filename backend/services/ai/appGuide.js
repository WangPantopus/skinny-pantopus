/**
 * What the assistant knows about Pantopus itself, and the app screens it can link to.
 *
 * The guide goes into the system prompt (cached for an hour, shared by everyone), so
 * it is built only from what is switched on for everyone: launch flags decide which
 * paragraphs exist. Per-person availability (Plans) is told in the turn's context; the
 * Plans paragraph and its playdates exist only for people who have them, like their tools.
 *
 * Links come only from the catalog below, which lists screens both apps' deep-link
 * routers open (iOS Core/Routing/DeepLinkRouter.swift, Android MainActivity and
 * PantopusNavHost). The model names a screen; this file writes the URL.
 */
const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');
const { isUuid } = require('./assistantKit');

const SECTION_SLUGS = ['today', 'your-home', 'risk', 'block', 'money', 'civic'];

// screen → [URL template, what it needs, label the app shows when the model gives none]
const SCREENS = {
  today: ['pantopus://today', null, 'Open Today'],
  place: ['pantopus://place', null, 'Open Place'],
  place_home: ['pantopus://place/{id}', 'home', 'Open this home'],
  place_section: ['pantopus://place/{id}/{section}', 'home+section', 'Open this section'],
  home_tools: ['pantopus://homes/{id}/dashboard', 'home', 'Open Home tools'],
  home_tasks: ['pantopus://homes/{id}/dashboard', 'home', 'Open Home tools'],
  home_task: ['pantopus://homes/{home}/tasks/{id}', 'home+task', 'Open the task'],
  home_members: ['pantopus://homes/{id}/members', 'home', 'Open members'],
  home_verify_postcard: ['pantopus://homes/{id}/verify-postcard', 'home', 'Enter your postcard code'],
  home_claim_status: ['pantopus://homes/{id}/waiting-room', 'home', 'See your claim'],
  // The Pulse tab (the feed). `pantopus://nearby` no longer opens the feed: since November 7 it is "Verified homes nearby".
  pulse: ['pantopus://feed', null, 'Open Pulse'],
  verified_homes: ['pantopus://nearby', null, 'See verified homes nearby'],
  connections: ['pantopus://connections', null, 'Open Connections'],
  post: ['pantopus://posts/{id}', 'id', 'Open the post'],
  plans: ['pantopus://plans', 'plans', 'Open Plans'],
  plan: ['pantopus://plans/{id}', 'plans+id', 'Open the plan'],
  plan_new: ['pantopus://plans/new', 'plans', 'Host a plan'],
  plan_requests: ['pantopus://plans/{id}/requests', 'plans+id', 'See who asked'],
  chat: ['pantopus://chat/{id}', 'id', 'Open the chat'],
  // The Mail tab and one piece in it, while the mailbox is on (launch key `mailbox`).
  mail: ['pantopus://mailbox', 'mailbox', 'Open Mail'],
  mail_item: ['pantopus://mailbox/{id}', 'mailbox+id', 'Open this mail'],
  mail_sent_item: ['pantopus://mailbox/sent/{id}', 'mailbox+id', 'Open what you sent'],
  // One Moment, for people who have Moments (both phones open it; only the iPhone opens the bare map link).
  moment: ['pantopus://moments/{id}', 'moments+id', 'Open the Moment'],
  // The Wallet, and Settings → Payments & payouts (cards and the payout account).
  wallet: ['pantopus://wallet', null, 'Open Wallet'],
  payments_settings: ['pantopus://settings/payments', null, 'Open Payments'],
  notifications: ['pantopus://notifications', null, 'Open notifications'],
  notification_settings: ['pantopus://settings/notifications', null, 'Open notification settings'],
  support_train: ['pantopus://support-trains/{id}', 'id', 'Open the Support Train'],
  // This conversation; a nudge's notification opens it at the nudge (?nudge=<notification id>).
  assistant: ['pantopus://assistant', null, 'Open Pantopus AI'],
  // Settings → What Pantopus remembers (phase 3), only for apps that have it (`cards` lists "memory").
  memory_settings: ['pantopus://settings/memory', 'memory', 'See what Pantopus remembers'],
  // Settings → What Pantopus does for you (phase 3 standing rules), only for apps that have it (`cards` lists "rules").
  rules_settings: ['pantopus://settings/rules', 'rules', 'See what Pantopus does for you'],
};
const SCREEN_NAMES = Object.keys(SCREENS);

/**
 * The URL for a screen. `id` may be a placeholder such as "{{response.id}}" for a
 * card's done link. Returns null when the screen or its ids aren't usable.
 */
function linkFor(screen, id = null, extra = {}) {
  const entry = SCREENS[screen];
  if (!entry) return null;
  const [template] = entry;
  const okId = (value) => isUuid(value) || /^\{\{response\.[a-z_.]+\}\}$/i.test(String(value || ''));
  if (template.includes('{id}') && !okId(id)) return null;
  if (template.includes('{home}') && !isUuid(extra.home)) return null;
  if (template.includes('{section}') && !SECTION_SLUGS.includes(extra.section)) return null;
  return template
    .replace('{id}', id || '')
    .replace('{home}', extra.home || '')
    .replace('{section}', extra.section || '');
}

// What each screen's id is, where the catalog's "home" or "id" doesn't already say.
const ID_WORDS = {
  post: 'post id', plan: 'plan id', plan_requests: 'plan id', chat: 'room id', mail_item: 'mail id', mail_sent_item: 'mail id',
  moment: 'moment id', support_train: 'Support Train id',
};

/** Why this person or app can't have a screen's button, in words for the model, or null when they can. */
function screenClosed(entry, ctx) {
  if (entry[1] && entry[1].includes('plans') && ctx.plansEnabled === false) return "Plans aren't available for this person.";
  if (entry[1] && entry[1].includes('mailbox') && !isLaunchFeatureEnabled('mailbox')) return "Mail isn't available in the app yet.";
  if (entry[1] && entry[1].includes('moments') && !ctx.momentsEnabled) return "Moments aren't available for this person.";
  if (entry[1] === 'memory' && !ctx.memory) return 'This version of the app has no memory list. Say they can see it in Settings once they update the app.';
  if (entry[1] === 'rules' && !ctx.rules) return 'This version of the app has no rules list. Say they can see it in Settings once they update the app.';
  return null;
}

// ─── Buttons ───────────────────────────────────────────────────────────────
// A button under a reply is the reply's own last line, [[button: screen, id, "label"]], which the chat takes out
// and sends to the app as a link (since November 14, 2026). Before, the button was a tool call (show_link, below)
// and the answer came in one more request to the model, which cost every answer with a button 1.3 to 2.5 s and
// made it arrive all at once: on Claude Sonnet 5.5, words written before a tool call can come back hidden, so the
// answer could not simply be written first. Carrying the answer inside the call was tried too: the model then left
// the button out of most answers (7 of 8 before, 1 of 8 after, on "what's due in my mail").

const BUTTON_OPEN = '[[button';
const MAX_BUTTONS = 2;

/**
 * Where a screen's link takes a home's id ("id" or "home_id" of what a button line asks for), or null when it takes
 * none. A button line may leave that id out: the person's default home stands in (buttonLink).
 */
function homeSlot(name) {
  const [template, needs] = SCREENS[name] || [];
  if (!template) return null;
  if (template.includes('{home}')) return 'home_id';
  return template.includes('{id}') && needs && needs.startsWith('home') ? 'id' : null;
}

/** "home_task (task id, then home id)": a screen and the ids its button line takes. */
function screenWithIds(name) {
  const [template] = SCREENS[name];
  if (template.includes('{home}')) return `${name} (${name === 'home_task' ? 'task id' : 'id'}, then home id)`;
  if (template.includes('{section}')) return `${name} (home id, then the section: ${SECTION_SLUGS.join(', ')})`;
  if (template.includes('{id}')) return `${name} (${ID_WORDS[name] || (homeSlot(name) ? 'home id' : 'id')})`;
  return name;
}

/**
 * The rule that teaches the button line, with the screens this person's app can open.
 * @param {{plansEnabled?: boolean, momentsEnabled?: boolean, memory?: boolean, rules?: boolean}} ctx  As runShowLink reads it.
 */
function buttonRule(ctx = {}) {
  const screens = SCREEN_NAMES.filter((name) => !screenClosed(SCREENS[name], ctx)).map(screenWithIds);
  return `- Buttons: to put a button under your reply that opens a screen in the app, end the reply with a last line of its own: [[button: screen]], or [[button: screen, id]] when the screen needs an id (for example [[button: wallet]] or [[button: post, <the post's id>]]). To choose the button's words, add them last in quotes: [[button: notification_settings, "Open notification settings"]]. They see the button, never the line, so write your whole answer above it and don't mention the button. Use one when your answer sends them to that screen to do something ("open notification settings", "see who asked to join"); never instead of answering, or for something they didn't ask about. At most two, each on its own line. Screens: ${screens.join(', ')}. Ids come from your tools or the screen context; a home id can be left out, and the button then opens their default home.`;
}

/** What a button line asks for, as runShowLink takes it: [[button: screen, id, second id or section, "label"]]. */
function parseButtonLine(line) {
  const inner = /^\[\[button:?\s*([^\]]*)\]\]$/i.exec(String(line || '').trim())?.[1];
  if (!inner) return null;
  const parts = [...inner.matchAll(/\s*"([^"]*)"\s*|([^,]+)/g)]
    .map((match) => ({ quoted: match[1] !== undefined, text: (match[1] ?? match[2]).trim().replace(/^["'“”]+|["'“”]+$/g, '').trim() }))
    .filter((part) => part.text);
  if (!parts.length || parts[0].quoted) return null;
  const asked = { screen: parts[0].text.toLowerCase(), id: null, home_id: null, section: null, label: null };
  for (const part of parts.slice(1)) {
    if (part.quoted) asked.label = asked.label || part.text;
    else if (isUuid(part.text)) {
      if (!asked.id) asked.id = part.text;
      else asked.home_id = asked.home_id || part.text;
    } else if (SECTION_SLUGS.includes(part.text.toLowerCase())) asked.section = part.text.toLowerCase();
    else asked.label = asked.label || part.text;
  }
  return asked;
}

/**
 * Passes a reply on as it streams, without its button lines: `write` gets everything else, and `flush` (at the
 * end) answers the button lines the reply ended with, at most two. A line that may still become a button line is
 * held until it is one or isn't; whitespace is held until words follow it, so none is left where a button line was.
 * A button line with words after it is not a button: only the reply's own last lines count, so a line quoted from
 * someone else's post or letter in the middle of an answer never becomes one.
 */
function replyWithoutButtons(write) {
  let held = '';
  let found = [];
  // Just after a button line: the whitespace that follows it is dropped (the gap before it stays).
  let afterButton = false;
  const pass = (text) => {
    if (!text) return;
    if (/\S/.test(text)) found = [];
    write(text);
  };
  return {
    push(delta) {
      let piece = delta || '';
      if (afterButton) {
        piece = piece.replace(/^\s+/, '');
        if (piece) afterButton = false;
      }
      held += piece;
      for (;;) {
        const at = held.indexOf('[[');
        if (at === -1) {
          // Trailing whitespace waits for what follows; so does a lone "[", which may open a button line.
          const keep = /\s*\[?$/.exec(held)[0];
          pass(held.slice(0, held.length - keep.length));
          held = keep;
          return;
        }
        const rest = held.slice(at);
        const opening = rest.slice(0, BUTTON_OPEN.length).toLowerCase();
        if (!BUTTON_OPEN.startsWith(opening)) {
          // Square brackets that aren't a button line.
          pass(held.slice(0, at + 2));
          held = held.slice(at + 2);
          continue;
        }
        const before = held.slice(0, at);
        const gap = /\s*$/.exec(before)[0];
        pass(before.slice(0, before.length - gap.length));
        const close = rest.indexOf(']]');
        if (close === -1) {
          held = gap + rest;
          return;
        }
        found.push(rest.slice(0, close + 2));
        const after = rest.slice(close + 2).replace(/^\s+/, '');
        afterButton = !after;
        held = gap + after;
      }
    },
    flush() {
      // An unfinished button line is never shown, and the reply doesn't end on whitespace.
      const at = held.toLowerCase().indexOf(BUTTON_OPEN);
      pass((at === -1 ? held : held.slice(0, at)).replace(/\s+$/, ''));
      held = '';
      return found.slice(0, MAX_BUTTONS);
    },
  };
}

/** A stored reply's words and the button lines it ended with: { text, lines }. */
function splitButtonLines(text) {
  let shown = '';
  const reply = replyWithoutButtons((piece) => { shown += piece; });
  reply.push(String(text || ''));
  const lines = reply.flush();
  return { text: shown, lines };
}

/** True when a button line is for a home's screen and names no home: it needs the person's default home. */
function needsDefaultHome(line) {
  const asked = parseButtonLine(line);
  const slot = asked && homeSlot(asked.screen);
  return Boolean(slot && !isUuid(asked[slot]));
}

/**
 * The link a button line asks for, by the same rules as the show_link tool: { link, line } or { error }. `line` is
 * the button line with every id it needed written in (the default home's, `ctx.defaultHomeId`, where it named none),
 * which is what the stored reply keeps, so the history makes the same button later.
 * @param {string} line  "[[button: screen, id, "label"]]"
 */
function buttonLink(line, ctx) {
  const asked = parseButtonLine(line);
  if (!asked) return { error: 'Not a button line.' };
  const slot = homeSlot(asked.screen);
  if (slot && !isUuid(asked[slot]) && isUuid(ctx.defaultHomeId)) asked[slot] = ctx.defaultHomeId;
  const made = runShowLink(asked, ctx);
  if (!made.link) return made;
  const parts = [asked.screen, asked.id, asked.home_id, asked.section, asked.label ? `"${asked.label.replace(/["\]]/g, '')}"` : null].filter(Boolean);
  return { ...made, line: `[[button: ${parts.join(', ')}]]` };
}

// The show_link tool, which made the button before the button line did (above). It is no longer offered, but a
// conversation from before still holds its calls, and the model sometimes repeats one: it still runs.
const showLinkDefinition = {
  name: 'show_link',
  description: 'Show a button under your reply that opens a screen in the app, when your answer sends them to that screen to do something ("open notification settings", "see who asked to join"). Call it before you write your answer, like a lookup, then write your whole answer: the button shows under it, so don\'t mention the button. Never use it instead of answering, or for something they didn\'t ask about. Ids come from your tools or the screen context. At most two per reply.',
  input_schema: {
    type: 'object',
    properties: {
      screen: { type: 'string', enum: SCREEN_NAMES },
      id: { type: ['string', 'null'], description: 'The id the screen needs (home, post, plan, chat, mail, Moment or Support Train id), or null.' },
      home_id: { type: ['string', 'null'], description: 'For home_task: the home the task is in. Otherwise null.' },
      section: { type: ['string', 'null'], enum: [...SECTION_SLUGS, null], description: 'For place_section only.' },
      label: { type: ['string', 'null'], description: 'Button text, a few words starting with a verb ("Open members"). Null for the default.' },
    },
    required: ['screen', 'id', 'home_id', 'section', 'label'],
    additionalProperties: false,
  },
};

/** A button's link (a button line's, or the show_link tool's): a validated link, or an error the model can fix. */
function runShowLink(args, ctx) {
  const entry = SCREENS[args.screen];
  if (!entry) return { error: `Unknown screen. Screens: ${SCREEN_NAMES.join(', ')}.` };
  const closed = screenClosed(entry, ctx);
  if (closed) return { error: closed };
  const url = linkFor(args.screen, args.id, { home: args.home_id, section: args.section });
  if (!url) return { error: 'That screen needs a valid id from your tools or the screen context.' };
  const label = typeof args.label === 'string' && args.label.trim() ? args.label.trim().slice(0, 40) : entry[2];
  // The chat adds what to do next, from what the person has seen of the reply so far.
  return { link: { label, url }, shown: true };
}

// ─── The guide ─────────────────────────────────────────────────────────────

// `suggestions`: the app can show the Suggestions switch and nudge cards. Builds without action
// cards (2.0.1) have no such switch, so they aren't told about one.
// `actionCards`, `links` and `pickupSchedule`: the cards the app shows (the chat's `cards`). Card
// tools and link screens are named only to apps that show them: the web and the 2.0.1 and 2.0.2
// builds have neither, and hear where in the app the person does it instead.
function appGuide({
  plans = true, playdates = false, sports = false, suggestions = false, actionCards = true, links = true, pickupSchedule = true, remembers = false, standingRules = false,
  identity = true, chats = true, moments = false,
} = {}) {
  const marketplace = isLaunchFeatureEnabled('marketplace');
  const openGigs = isLaunchFeatureEnabled('open_gigs');
  const mailbox = isLaunchFeatureEnabled('mailbox');
  const parts = [];
  // A screen's name for its button line, after the words for it.
  const screen = (name) => (links ? ` (${name})` : '');

  parts.push(`HOW PANTOPUS WORKS (use this to answer questions about the app; ${links ? 'link to screens with a button line' : 'say where in the app to go'})

Where things are, on the phones: the tabs are Place, Today and Pulse${mailbox ? ', Mail' : ''}${moments ? ', Moments' : ''}${plans ? ' and Plans' : ''}${plans ? '' : '; people who have Plans also have a Plans tab (the context says whether this person does)'}. Messages is the chat button at the top right of each tab's first screen, with the unread count. The side menu (the three lines at the top left) has My Homes, My Businesses, Connections, Mailbox, Profile & Privacy, Search, My Pulse, My Tasks, Wallet & Payments, Settings and Help & Support. The web has Place, Today, Pulse${mailbox ? ', Mail' : ''} and Messages in its sidebar, and no Plans or Moments.

PLACE
- Place opens on "Your Place": the person's default home. The address button at the top opens "Your homes", where they switch homes or change which one is the default (the default decides what Place, Today and the briefings show).
- A home's status: Verified (residence confirmed), Claimed (waiting for verification) or Private setup (only they see it). Verifying unlocks the household sections. Ways to verify: a postcard with a code mailed to the address, a document such as a lease or utility bill, or a landlord's confirmation. A postcard takes about 3 to 7 days to arrive; they enter its code on the verify screen${screen('home_verify_postcard')}. A claim's progress is on its waiting room screen${screen('home_claim_status')}.
- Place shows sections in groups, each with its source and date: Today (weather, air, alerts, good day to, sunrise and sunset, the address calendar), Your home (property facts and the ages of the roof, heating and cooling, water heater, electrical panel, sewer or septic and windows, estimated from the year built unless someone entered the real year), Risk and readiness (flood zone, heat, seismic, wildfire), Health and environment (radon zone and lead risk, drinking water, environmental hazards), Your block, Money signals (some only for owners or renters) and Civic (districts, representatives, elections). Numbers marked as estimates are estimates; say so.
- Home tools (the card on Place${links ? ', or home_tools' : ''}) holds Tasks, Members, Documents and Emergency info. Emergency and medical info is visible only to people allowed to see sensitive details; you never read it.
- Members: the people in the home and their roles (owner, admin, member, restricted member, guest and others). To add someone, open Members${links ? ' (home_members)' : ' in Home tools'} and invite them by email or username; they get an invitation. Guests can get a guest pass that ends on its own.
- Tasks: chores, reminders, repairs, projects and shopping, each with who it's for, a due date and a repeat (daily, weekly or monthly). The person a task is assigned to gets a notification, and a reminder push goes out at 7 AM on the due day. ${actionCards ? 'You can draft tasks with draft_home_task.' : 'They add one in Home tools → Tasks.'}
- "See what neighbors see" on Place shows the home as neighbors see it. Neighbors never see the exact address.
- Verified neighbors on Place shows how many verified homes are around them; "Verified homes nearby" there${links ? ' (verified_homes)' : ''} has the map of them and "Invite your neighbors".

TODAY
- Today shows the day at the default home (or a saved address): the weather, "good day to" picks (open the windows, run, wash the car, water the lawn, grill), the address calendar (pickup days and other dates for the next two weeks), radon, air quality, alerts and sunrise and sunset. People with Plans also see their plans for the day.
- Pickup days: city schedules are marked unconfirmed until the household sets its own days in the pickup editor on Today (or by photographing the hauler's flyer there with "Read a flyer"). Only days the household set trigger the night-before reminder.${pickupSchedule ? ' You can draft pickup days with draft_pickup_schedule when the app supports it.' : ''}
- Radon: Today asks "Was radon tested?"; a lab report photo or PDF can fill in the result. The EPA suggests fixing a home at or above 4.0 pCi/L. Never give medical advice.
- Briefings: a morning briefing and an evening briefing (pickup reminders come in the evening). Times, quiet hours, weather and air alerts and home reminders are in Settings → Notifications${screen('notification_settings')}. ${actionCards ? 'You can draft changes with draft_notification_settings.' : 'They change them there.'}${suggestions ? `
- Suggestions from Pantopus, a switch in Settings → Notifications, is off until the person turns it on; then you write the morning briefing, with buttons, and may send at most two nudges a day (never during quiet hours), each landing in this conversation, where "Fewer like this" mutes that kind for 30 days.` : ''}

PULSE
- Pulse (the Pulse tab${links ? ', pulse' : ''}) is the neighborhood feed, with a List | Map switch and two views: Nearby (posts around them) and Connections (posts from people they are connected to). Post kinds: questions (asks), recommendations, events, lost and found, heads-ups, deals, local updates, neighborhood wins and visitor guides, newest first. "Nearby" is this view, not a tab.
- Posting to Nearby needs a verified address, or a location fix from the last few minutes within about 3 miles, or a photo or video taken there. Businesses can't post. Neighbors see a post's location only as an approximate area. Heads-ups can be road hazards, power outages, weather damage, missing pets, other hazards or other; reports about crimes or suspicious people aren't allowed.
- A question stays open for 7 days; its author can mark it solved. People can like, reply, save, hide a post, mute a person or topic, and report a post.
- ${actionCards
    ? 'You can draft a post with create_post_draft, a reply with draft_post_reply, and "mark solved" with draft_post_solve.'
    : 'You can draft a post with create_post_draft. They reply to a post, or mark their own question solved, on the post itself.'}

MESSAGES
- Messages (the chat button at the top right) holds direct messages, group chats, a group chat for each plan (it opens when the host lets the first person in and becomes read-only a day after the plan) and Support Train chats. The "Pantopus AI" row is you. Swiping a conversation mutes it; Report and Block are in a direct chat's Conversation details.
- A note to an address on their block isn't in Messages: Place, Verified neighbors, "Message a neighbor" sends a pre-written note to verified residents there, and replies come to "Your inbox" on that screen.
- Blocking someone stops new messages from them; people can report a person from their profile. ${chats ? 'You read a chat only when the person asks you about it, and only chats they are in; you never send messages.' : "You don't read anyone's chats."}

SUPPORT TRAINS
- A Support Train organizes meals, takeout or groceries for someone going through something hard: the organizer sets dates, helpers sign up for a slot, and everyone gets reminders. You can start one with draft_support_train_from_story.

ACCOUNT AND PRIVACY
- Neighbors never see exact addresses. You see only what the person can see, and you never act without their tap${standingRules ? ', except the standing rules they turned on (below)' : ''}.${remembers ? `
- What Pantopus remembers: only what the person asked you to remember, after they tapped Remember. Settings → What Pantopus remembers${screen('memory_settings')} lists it; they edit or delete an item there, or Forget everything, and once a year Pantopus asks them to review it. Only they see it: their household never does, and it is used only for them. Deleting a conversation doesn't delete it.` : ''}${standingRules ? `
- What Pantopus does for you: standing rules the person turned on from a card, the one thing Pantopus does without a tap each time.${plans ? ' A weekly plan: a plan they host, posted again each week on the same weekday and time with the same details and entry rules, for up to 12 weeks, only at their home or within 3 miles of it; it pauses after two weeks with nobody going.' : ''} A pickup reminder: another household member reminded the night before each pickup day the household set (never from a city schedule nobody confirmed), set by someone who can assign tasks there. Pantopus tells them each time. Settings → What Pantopus does for you${screen('rules_settings')} lists each rule with its switch, its last runs, Extend and Delete.` : ''}
- You are an AI assistant and can make mistakes; for anything that matters, the screen it came from is the source.`);

  // Playdates are described only to people with plans_playdates, whose tools offer them.
  if (plans) parts.push(`PLANS
- A plan is a small meetup on the Plans map: a watch party, ${playdates ? 'a playdate, ' : ''}a pickup game, a walk and coffee, or a study group. Plans start within 14 days and last 15 minutes to 8 hours. A host may have 3 upcoming plans and post 5 a day.
${sports ? '- Your teams: Settings → Notifications → Games and teams opens the Your teams sheet to search, follow, hide, follow leagues or turn sports off. Link notification_settings and tell them to tap Games and teams. The Plans composer also has Edit teams. Use find_teams and draft_sports_teams for choices they want to confirm in chat.\n- Sports schedules: use find_games for the listed game’s exact start and end. A sports preference of off stops suggestions, but direct game questions can still be answered.\n' : ''}- Pickup games and study groups meet in public places; watch parties and walks may also be at the host's home. Everyone else sees only the plan's area until they get in; then they see the exact place, the host's note and who's going. At home, only people the host accepts see the address.
- Who gets in: the host approves each person, or verified neighbors and people the host has hosted before get in right away; for pickup games and walks, anyone nearby can be let in automatically.
- Asking to join: people within about 5 miles can ask, with a note and up to 3 others. Asking closes when the plan starts (for pickup games and walks, 30 minutes before the end).${playdates ? `
- Playdates (kids play while their parents meet) are open to anyone on Pantopus, with or without a verified address. They meet in public places such as a playground, park or library; the host approves each family; parents stay with their kids the whole time; and only kids' ages are shared, never names. Until a family gets in, it sees only the neighborhood and the part of the day ("Saturday morning"). Families within about 3 miles can ask, with how many kids are coming and their ages.` : ''}
- Reminders go out 2 hours before (or at 7 PM the evening before an early plan); the host gets a summary at 8 AM on the day. Moving a plan more than 30 minutes or changing the place asks everyone who's in "Still coming?".
- ${actionCards
    ? 'You can draft a plan (draft_plan), changes (draft_plan_change), cancelling (draft_plan_cancel), answering requests (show_plan_requests), asking to join (draft_plan_ask) and a message to guests (draft_plan_message).'
    : "They host one with Host a plan in the Plans tab. On a plan's page the host changes or cancels it and answers people asking to join, others ask to join, and people who are in message everyone."}`);

  // Mail is described only while the mailbox is on; letters and Christmas cards follow their own keys.
  if (mailbox) {
    const letters = isLaunchFeatureEnabled('mail_extras');
    const cards = isLaunchFeatureEnabled('holiday_cards');
    parts.push(`MAIL
- Mail (the Mail tab${links ? ', mail' : ''}) is mail sent through Pantopus to a person, their home or their business. It comes in one round each morning; the top of the Mailbox says whether today's mail has come.
- Boxes: Me (their own mail), Home (their household's) and Biz (for a business they own or get mail for), then Sent. Tabs: Incoming (in the box), Counter (waiting on them: due, or put there) and Vault (what they filed, with Archived at the bottom). The search icon searches all their mail.
- A home's mail opens only to residents whose address is proven (a postcard code, a document, a landlord's confirmation, an ID check, or the household's invitation or approval), never to guests. A letter addressed to one member stays that member's. Until the address is proven, the home's mail waits in a closed Home box.
- "Pantopus read this for you" is a short note at the top of a piece with its key facts. Businesses and Pantopus write their own; otherwise AI writes it when the piece is first opened.
- The ⋯ menu in Mail has Mail tasks, Home records, Stamps and Hold my mail, which keeps their own mail while they're away and brings it as one bundle the morning they're back.${letters ? `
- Writing a letter: the pencil button in Mail (who it's to, the address, the letter, then seal and send).` : ''}${cards ? `
- Christmas cards: "Send a Christmas card" at the top of Me and in the side menu. They pick who it's for and a card, write on the back, choose when it arrives (the next morning, sealed until Christmas, or Christmas morning), look it over, then seal and send. A card can be taken back until the 7 AM pickup, and the season closes December 31.` : ''}
- On the phones, Mail opens after the phone's face or fingerprint unlock, or its passcode; so does the Wallet.
- ${identity ? `You can look through their Mail and read a piece (find_mail, get_mail_item${links ? '; mail_item opens one' : ''}). ` : ''}You can't send, pay, file or delete mail: they do that on the piece.`);
  }

  // Moments are described only to people who have the tab (the `moments` flag), like their tools.
  if (moments) {
    parts.push(`MOMENTS
- A Moment is a photo, a video of up to 30 seconds or a short text card, posted from the Moments tab with "+". It is pinned where they are and lasts 1, 6, 24 or 48 hours; then it is gone for everyone, its author included. Posting needs a one-time confirmation that they are 18 or older.
- Who sees it: "Everyone nearby" or "My connections". Its place shows as a venue, a street name or a town, never an address. "Show the area instead" shows only the town, and so does a Moment posted at home. "Post with no location" keeps it off the map, for connections only.
- It shows on the Moments map as the poster's face in a ring, and as a ring around their profile picture elsewhere in the app. People can react with one emoji or reply; a reply arrives as a direct message. Only the poster sees "Seen by".
- You can look up their own Moments, who saw them, and Moments they can see (find_moments, get_moment${links ? '; moment opens one' : ''}). You never see the photo or video, and you can't post, react or reply for them.`);
  }

  parts.push(`WALLET AND PAYMENTS
- The Wallet (side menu, Wallet & Payments${links ? '; wallet' : ''}) holds money they earn on Pantopus: pay for tasks they did, tips, and invoice payments. Cards pay directly: the Wallet can't be topped up or used to pay.
- After someone pays, Pantopus holds the money for a 48-hour review ("In review"), then releases it to the Wallet. Money under a bank dispute waits for the bank's decision.
- Withdrawing sends the balance to their bank through Stripe. It needs payouts set up ("Set up payouts"), has a $1 minimum and takes a few business days.
- "Owed" means a payment that already reached the Wallet was later refunded or lost to a dispute; their next earnings pay it first, and withdrawals pause until then.
- Saved cards, Apple Pay and the payout account are in Settings, Payments & payouts${links ? ' (payments_settings)' : ''}.
- ${identity ? 'You can read their balance, holds and payments (get_wallet, find_payments). ' : ''}You can't withdraw, pay or refund: they do that in the Wallet. You never see card or bank numbers.`);

  const off = [];
  if (!marketplace) off.push('buying and selling (marketplace listings)');
  if (!openGigs) off.push('posting tasks for neighbors to bid on, and hiring');
  if (!mailbox) off.push('the mailbox');
  if (off.length) parts.push(`NOT IN THE APP YET: ${off.join('; ')}. Say so briefly if asked, and help another way.`);
  return parts.join('\n\n');
}

module.exports = {
  appGuide,
  linkFor,
  showLinkDefinition,
  runShowLink,
  buttonRule,
  buttonLink,
  needsDefaultHome,
  parseButtonLine,
  replyWithoutButtons,
  splitButtonLines,
  SCREEN_NAMES,
};
