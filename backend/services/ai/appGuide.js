/**
 * What the assistant knows about Pantopus itself, and the app screens it can link to.
 *
 * The guide goes into the system prompt (cached for an hour, shared by everyone), so
 * it is built only from what is switched on for everyone: launch flags decide which
 * paragraphs exist. Per-person availability (Plans) is told in the turn's context.
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
  nearby: ['pantopus://nearby', null, 'Open Nearby'],
  post: ['pantopus://posts/{id}', 'id', 'Open the post'],
  plans: ['pantopus://plans', 'plans', 'Open Plans'],
  plan: ['pantopus://plans/{id}', 'plans+id', 'Open the plan'],
  plan_new: ['pantopus://plans/new', 'plans', 'Host a plan'],
  plan_requests: ['pantopus://plans/{id}/requests', 'plans+id', 'See who asked'],
  chat: ['pantopus://chat/{id}', 'id', 'Open the chat'],
  notifications: ['pantopus://notifications', null, 'Open notifications'],
  notification_settings: ['pantopus://settings/notifications', null, 'Open notification settings'],
  support_train: ['pantopus://support-trains/{id}', 'id', 'Open the Support Train'],
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

const showLinkDefinition = {
  name: 'show_link',
  description: 'Show a button under your reply that opens a screen in the app. Write your whole answer first and call this last, only when your answer sends them to that screen to do something ("open notification settings", "see who asked to join"); never instead of answering, and never for something they didn\'t ask about. Ids come from your tools or the screen context. At most two per reply.',
  input_schema: {
    type: 'object',
    properties: {
      screen: { type: 'string', enum: SCREEN_NAMES },
      id: { type: ['string', 'null'], description: 'The id the screen needs (home, post, plan, chat or Support Train id), or null.' },
      home_id: { type: ['string', 'null'], description: 'For home_task: the home the task is in. Otherwise null.' },
      section: { type: ['string', 'null'], enum: [...SECTION_SLUGS, null], description: 'For place_section only.' },
      label: { type: ['string', 'null'], description: 'Button text, a few words starting with a verb ("Open members"). Null for the default.' },
    },
    required: ['screen', 'id', 'home_id', 'section', 'label'],
    additionalProperties: false,
  },
};

/** The show_link tool: a validated link, or an error the model can fix. */
function runShowLink(args, ctx) {
  const entry = SCREENS[args.screen];
  if (!entry) return { error: `Unknown screen. Screens: ${SCREEN_NAMES.join(', ')}.` };
  if (entry[1] && entry[1].includes('plans') && ctx.plansEnabled === false) return { error: "Plans aren't available for this person." };
  const url = linkFor(args.screen, args.id, { home: args.home_id, section: args.section });
  if (!url) return { error: 'That screen needs a valid id from your tools or the screen context.' };
  const label = typeof args.label === 'string' && args.label.trim() ? args.label.trim().slice(0, 40) : entry[2];
  // When the model links before it has answered, this result is what it reads next: steer it
  // back to the question so the reply is the answer, not a line about the button.
  return {
    link: { label, url },
    shown: true,
    next: 'The button now shows under your reply. Answer their question in full now, as if the button were not there, and don\'t mention the button.',
  };
}

// ─── The guide ─────────────────────────────────────────────────────────────

function appGuide({ plans = true } = {}) {
  const marketplace = isLaunchFeatureEnabled('marketplace');
  const openGigs = isLaunchFeatureEnabled('open_gigs');
  const mailbox = isLaunchFeatureEnabled('mailbox');
  const parts = [];

  parts.push(`HOW PANTOPUS WORKS (use this to answer questions about the app; link to screens with show_link)

Tabs: Place, Today, Nearby and Messages. People who have Plans also have a Plans tab between Nearby and Messages; the context says whether this person has Plans.

PLACE
- Place opens on "Your Place": the person's default home. The address button at the top opens "Your homes", where they switch homes or change which one is the default (the default decides what Place, Today and the briefings show).
- A home's status: Verified (residence confirmed), Claimed (waiting for verification) or Private setup (only they see it). Verifying unlocks the household sections. Ways to verify: a postcard with a code mailed to the address, a document such as a lease or utility bill, or a landlord's confirmation. A postcard takes about 3 to 7 days to arrive; they enter its code on the verify screen (home_verify_postcard). A claim's progress is on its waiting room screen (home_claim_status).
- Place shows sections in groups, each with its source and date: Today (weather, air, alerts, good day to, sunrise and sunset, the address calendar), Your home (property facts and the ages of the roof, heating and cooling, water heater, electrical panel, sewer or septic and windows, estimated from the year built unless someone entered the real year), Risk and readiness (flood zone, heat, seismic, wildfire), Health and environment (radon zone and lead risk, drinking water, environmental hazards), Your block, Money signals (some only for owners or renters) and Civic (districts, representatives, elections). Numbers marked as estimates are estimates; say so.
- Home tools (the card on Place, or home_tools) holds Tasks, Members, Documents and Emergency info. Emergency and medical info is visible only to people allowed to see sensitive details; you never read it.
- Members: the people in the home and their roles (owner, admin, member, restricted member, guest and others). To add someone, open Members (home_members) and invite them by email or username; they get an invitation. Guests can get a guest pass that ends on its own.
- Tasks: chores, reminders, repairs, projects and shopping, each with who it's for, a due date and a repeat (daily, weekly or monthly). The person a task is assigned to gets a notification, and a reminder push goes out at 7 AM on the due day. You can draft tasks with draft_home_task.
- "See what neighbors see" on Place shows the home as neighbors see it. Neighbors never see the exact address.

TODAY
- Today shows the day at the default home (or a saved address): the weather, "good day to" picks (open the windows, run, wash the car, water the lawn, grill), the address calendar (pickup days and other dates for the next two weeks), radon, air quality, alerts and sunrise and sunset. People with Plans also see their plans for the day.
- Pickup days: city schedules are marked unconfirmed until the household sets its own days in the pickup editor on Today (or by photographing the hauler's flyer there with "Read a flyer"). Only days the household set trigger the night-before reminder. You can draft pickup days with draft_pickup_schedule when the app supports it.
- Radon: Today asks "Was radon tested?"; a lab report photo or PDF can fill in the result. The EPA suggests fixing a home at or above 4.0 pCi/L. Never give medical advice.
- Briefings: a morning briefing and an evening briefing (pickup reminders come in the evening). Times, quiet hours, weather and air alerts and home reminders are in Settings → Notifications (notification_settings). You can draft changes with draft_notification_settings.

NEARBY
- Nearby is the neighborhood feed: questions (asks), recommendations, events, lost and found, heads-ups, deals, local updates and neighborhood wins, newest first.
- Posting nearby needs a verified address, or a fresh location within about 3 miles. Neighbors see a post's location only as an approximate area. Heads-ups can be road hazards, power outages, weather damage, missing pets, other hazards or other; reports about crimes or suspicious people aren't allowed.
- A question stays open for 7 days; its author can mark it solved. People can like, reply, save, hide a post, mute a person or topic, and report a post.
- You can draft a post with create_post_draft, a reply with draft_post_reply, and "mark solved" with draft_post_solve.

MESSAGES
- Direct messages, group chats, and a group chat for each plan (it opens when the host lets the first person in and closes a day after the plan). The "Pantopus AI" row is you.
- Blocking someone stops new messages from them; people can report a person from their profile. You don't read anyone's chats in this version.

SUPPORT TRAINS
- A Support Train organizes meals, takeout or groceries for someone going through something hard: the organizer sets dates, helpers sign up for a slot, and everyone gets reminders. You can start one with draft_support_train_from_story.

ACCOUNT AND PRIVACY
- Neighbors never see exact addresses. You see only what the person can see, and you never act without their tap.
- You are an AI assistant and can make mistakes; for anything that matters, the screen it came from is the source.`);

  if (plans) parts.push(`PLANS
- A plan is a small meetup on the Plans map: a watch party, a pickup game, a walk and coffee, or a study group. Plans start within 14 days and last 15 minutes to 8 hours. A host may have 3 upcoming plans and post 5 a day.
- Pickup games and study groups meet in public places; watch parties and walks may also be at the host's home. Everyone else sees only the plan's area until they get in; then they see the exact place, the host's note and who's going. At home, only people the host accepts see the address.
- Who gets in: the host approves each person, or verified neighbors and people the host has hosted before get in right away; for pickup games and walks, anyone nearby can be let in automatically.
- Asking to join: people within about 5 miles can ask, with a note and up to 3 others. Asking closes when the plan starts (for pickup games and walks, 30 minutes before the end).
- Reminders go out 2 hours before (or at 7 PM the evening before an early plan); the host gets a summary at 8 AM on the day. Moving a plan more than 30 minutes or changing the place asks everyone who's in "Still coming?".
- You can draft a plan (draft_plan), changes (draft_plan_change), cancelling (draft_plan_cancel), answering requests (show_plan_requests), asking to join (draft_plan_ask) and a message to guests (draft_plan_message).`);

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
  SCREEN_NAMES,
};
