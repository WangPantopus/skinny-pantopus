/**
 * AI Agent Tools — function definitions that the LLM can call.
 *
 * Each tool has:
 *   definition  – Schema sent to Claude (name, description, input_schema)
 *   execute     – Server-side implementation that runs when the LLM calls it
 *
 * Tools are sandboxed: they only access data the user is authorised to see.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const noaa = require('../external/noaa');
const logger = require('../../utils/logger');
const { getAuthorizedMail } = require('./mailAccess');
const { listEffectivelyOpenSlots } = require('../supportTrainSlotAvailability');
const { resolveLocation } = require('../context/locationResolver');
const { escapeIlike } = require('../../utils/escapeIlike');
const { draftPickupSchedule } = require('./pickupDraft');
const { readToolDefinitions, runReadTool, PLACE_POST_TYPES } = require('./readTools');
const { nearbyReadToolDefinitions, runNearbyReadTool } = require('./readToolsNearby');
const { verificationReadToolDefinitions, runVerificationReadTool } = require('./readToolsVerification');
const { actionCardDefinitions, runCardTool } = require('./actionCards');
const { showLinkDefinition, runShowLink } = require('./appGuide');
const { memoryToolDefinitions, runMemoryTool } = require('./memory');
const { followUpToolDefinitions, runFollowUpTool } = require('./followUps');
const { ruleToolDefinitions, runRuleTool } = require('./rules');
const { needsYouDefinition, runNeedsYou } = require('./needsYou');
const { homesOf, localToUtc } = require('./assistantKit');

const {
  validateGigDraft,
  validateListingDraft,
  validatePostDraft,
  validateMailSummary,
} = require('./schemas');

// ─── Tool Definitions (sent to Claude) ─────────────────────────────────────
// A draft is the answer: the person sees it as a card, and the turn ends there
// (agentService). The note is what the assistant says under the card.
const DRAFT_NOTE = 'One short sentence shown to the person under the draft card: the assumption that matters most, or a detail worth adding. Null when there is nothing to say.';

// Not `strict`: strict tool use compiles a grammar per schema on first use and
// caps a request at 16 union-typed (nullable) parameters, which these tools
// exceed together. Claude follows the schemas without it, and every executor
// below treats a missing or null argument as "not given".

const toolDefinitions = [
  {
    name:'get_user_context',
    description: 'Get the current user\'s homes (id, city, state, role, which one Today shows) and saved places (label, city and state only), and recent activity counts. Never returns exact addresses.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name:'get_place_alerts',
    description: 'Get active weather alerts (NOAA) near the user\'s home or a saved place. Provide the saved place label, or "primary" for their home or main place.',
    input_schema: {
      type: 'object',
      properties: {
        place_label: {
          type: 'string',
          description: 'The label of the saved place (e.g. "Home", "Work"). If unknown, use "primary".',
        },
      },
      required: ['place_label'],
      additionalProperties: false,
    },
  },
  {
    name:'get_mail_item',
    description: 'Get the content of a specific mail item for summarization. Requires the mail item ID.',
    input_schema: {
      type: 'object',
      properties: {
        mail_item_id: {
          type: 'string',
          description: 'UUID of the mail item to retrieve.',
        },
      },
      required: ['mail_item_id'],
      additionalProperties: false,
    },
  },
  {
    name:'create_gig_draft',
    description: 'Create a structured gig (task) draft. Call this when you have enough information to draft a task the user needs help with.',
    input_schema: {
      type: 'object',
      properties: {
        title:              { type: 'string', description: 'Clear task title, max 60 chars' },
        description:        { type: 'string', description: '1-3 sentence task description' },
        price:              { type: ['number', 'null'], description: 'Suggested price in dollars' },
        category:           { type: ['string', 'null'], description: 'Task category: Handyman, Cleaning, Moving, Pet Care, Child Care, Tutoring, Photography, Cooking, Delivery, Tech Support, Gardening, Event Help, Other' },
        is_urgent:          { type: ['boolean', 'null'], description: 'Whether the task is time-sensitive' },
        tags:               { type: ['array', 'null'], items: { type: 'string' }, description: 'Up to 5 relevant tags' },
        schedule_type:      { type: ['string', 'null'], enum: ['asap', 'today', 'scheduled', 'flexible', null], description: 'When the task is needed' },
        pay_type:           { type: ['string', 'null'], enum: ['fixed', 'hourly', 'offers', null], description: 'Payment type' },
        estimated_duration: { type: ['number', 'null'], description: 'Estimated hours to complete' },
        special_instructions: { type: ['string', 'null'], description: 'Any special instructions' },
        note:               { type: ['string', 'null'], description: DRAFT_NOTE },
      },
      // Every property is required and optional ones are nullable, so the model always states each one.
      required: ['title', 'description', 'price', 'category', 'is_urgent', 'tags', 'schedule_type', 'pay_type', 'estimated_duration', 'special_instructions', 'note'],
      additionalProperties: false,
    },
  },
  {
    name:'create_listing_draft',
    description: 'Create a structured marketplace listing draft. Call this when the user wants to sell, give away, or request an item.',
    input_schema: {
      type: 'object',
      properties: {
        title:             { type: 'string', description: 'Clear, search-friendly title' },
        description:       { type: 'string', description: '1-3 sentence description' },
        price:             { type: ['number', 'null'], description: 'Price in dollars, null for free/wanted' },
        isFree:            { type: 'boolean', description: 'True for giveaway listings' },
        category:          { type: 'string', description: 'Category: electronics, furniture, clothing, sports, books, toys, tools, automotive, home_garden, collectibles, music, baby_kids, other' },
        condition:         { type: ['string', 'null'], enum: ['new', 'like_new', 'good', 'fair', 'for_parts', null] },
        tags:              { type: 'array', items: { type: 'string' }, description: 'Up to 3 search tags' },
        listingType:       { type: 'string', enum: ['sell_item', 'free_item', 'wanted_request', 'rent_sublet', 'vehicle_sale', 'vehicle_rent', 'service_gig'] },
        deliveryAvailable: { type: 'boolean' },
        meetupPreference:  { type: ['string', 'null'], enum: ['porch_pickup', 'public_meetup', 'flexible', null] },
        note:              { type: ['string', 'null'], description: DRAFT_NOTE },
      },
      required: ['title', 'description', 'price', 'isFree', 'category', 'condition', 'tags', 'listingType', 'deliveryAvailable', 'meetupPreference', 'note'],
      additionalProperties: false,
    },
  },
  {
    name:'create_post_draft',
    description: 'Create a structured community post draft. Call this when the user wants to share something with their neighborhood.',
    input_schema: {
      type: 'object',
      properties: {
        content:    { type: 'string', description: 'Post text content, max 2000 chars' },
        title:      { type: ['string', 'null'], description: 'Optional title for events, alerts, announcements' },
        // The types the nearby feed accepts from residents (posts.js PLACE types).
        postType:   { type: 'string', enum: PLACE_POST_TYPES, description: 'ask_local is a question; alert is a heads-up; local_update is news about the area; neighborhood_win is good news.' },
        purpose:    { type: ['string', 'null'], enum: ['ask', 'offer', 'heads_up', 'recommend', 'event', 'deal', 'story', null] },
        visibility: { type: ['string', 'null'], enum: ['neighborhood', 'public', 'followers', 'connections', null] },
        tags:       { type: ['array', 'null'], items: { type: 'string' }, description: 'Up to 3 tags' },
        eventDate:      { type: ['string', 'null'], description: 'Events: start, local time YYYY-MM-DDTHH:MM. Null otherwise.' },
        eventEndDate:   { type: ['string', 'null'], description: 'Events: end, local time YYYY-MM-DDTHH:MM, or null.' },
        eventVenue:     { type: ['string', 'null'], description: 'Events: where, as people say it ("Esther Short Park"), or null.' },
        dealExpiresAt:  { type: ['string', 'null'], description: 'Deals (required for them): last day, YYYY-MM-DD. Null otherwise.' },
        lostFoundType:  { type: ['string', 'null'], enum: ['lost', 'found', null], description: 'Lost and found posts only.' },
        safetyAlertKind: { type: ['string', 'null'], enum: ['road_hazard', 'power_outage', 'weather_damage', 'missing_pet', 'hazard', 'other', null], description: 'Heads-ups (alert) only, required for them. Never crimes or suspicious people.' },
        note:       { type: ['string', 'null'], description: DRAFT_NOTE },
      },
      required: ['content', 'title', 'postType', 'purpose', 'visibility', 'tags', 'eventDate', 'eventEndDate', 'eventVenue', 'dealExpiresAt', 'lostFoundType', 'safetyAlertKind', 'note'],
      additionalProperties: false,
    },
  },
  {
    name:'summarize_mail_item',
    description: 'Generate a structured summary of a mail item with recommended actions. Call this after retrieving mail content with get_mail_item.',
    input_schema: {
      type: 'object',
      properties: {
        summary:    { type: 'string', description: '1-2 sentence summary' },
        key_facts:  {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['field', 'value'],
            additionalProperties: false,
          },
        },
        recommended_actions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type:   { type: 'string', enum: ['pay', 'remind', 'file', 'create_task', 'acknowledge', 'dispute', 'share_household', 'forward'] },
              title:  { type: 'string' },
              reason: { type: ['string', 'null'] },
            },
            required: ['type', 'title', 'reason'],
            additionalProperties: false,
          },
        },
        urgency: { type: 'string', enum: ['none', 'due_soon', 'overdue', 'time_sensitive'] },
      },
      required: ['summary', 'key_facts', 'recommended_actions', 'urgency'],
      additionalProperties: false,
    },
  },
  {
    name:'draft_support_train_from_story',
    description: 'Draft a Support Train (community help coordination) from a free-text story. Returns a structured draft the user can review.',
    input_schema: {
      type: 'object',
      properties: {
        story: {
          type: 'string',
          description: 'Free-text description of the situation and what kind of support is needed.',
        },
        support_modes_requested: {
          type: ['array', 'null'],
          items: { type: 'string', enum: ['meal', 'takeout', 'groceries', 'gift_funds'] },
          description: 'Optional list of support modes. If null, the AI will infer from the story.',
        },
        note: { type: ['string', 'null'], description: DRAFT_NOTE },
      },
      required: ['story', 'support_modes_requested', 'note'],
      additionalProperties: false,
    },
  },
  {
    // Offered only to apps that can show the card (agentService).
    name:'draft_pickup_schedule',
    description: "Draft the days their garbage and recycling are collected, from what they say or a photo of their hauler's flyer, schedule or calendar. It appears as a card they check and then save to their home; nothing is saved until they do. Fill in only what they told you or the photo shows and leave the rest null: the home's saved days are kept for anything left null.",
    input_schema: {
      type: 'object',
      properties: {
        garbage_weekday: {
          type: ['string', 'null'],
          enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU', null],
          description: 'The weekday garbage is collected; garbage is always weekly. Null when they did not say.',
        },
        recycling_frequency: {
          type: ['string', 'null'],
          enum: ['weekly', 'biweekly', 'none', null],
          description: 'weekly, biweekly (every other week), none (no recycling collection), or null when they did not say.',
        },
        recycling_next_date: {
          type: ['string', 'null'],
          description: 'With weekly or biweekly: the date of one recycling collection, YYYY-MM-DD. Any collection date works; for every other week it fixes which weeks. Null otherwise.',
        },
        note: {
          type: ['string', 'null'],
          description: `${DRAFT_NOTE} Nothing changes until they tap Save on the card: write about the draft, never as if their schedule were already set, saved or changed.`,
        },
      },
      required: ['garbage_weekday', 'recycling_frequency', 'recycling_next_date', 'note'],
      additionalProperties: false,
    },
  },
  {
    name:'list_user_support_trains',
    description: 'List Support Trains the current user organizes or participates in.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: ['string', 'null'],
          enum: ['draft', 'published', 'active', 'paused', 'completed', 'archived', null],
          description: 'Optional filter by Support Train status.',
        },
      },
      required: ['status'],
      additionalProperties: false,
    },
  },
  {
    name:'get_support_train_summary',
    description: 'Get a summary of one Support Train, including open slots, recipient summary, and restriction chips.',
    input_schema: {
      type: 'object',
      properties: {
        support_train_id: {
          type: 'string',
          description: 'UUID of the Support Train.',
        },
      },
      required: ['support_train_id'],
      additionalProperties: false,
    },
  },
  ...readToolDefinitions,
  ...nearbyReadToolDefinitions,
  ...verificationReadToolDefinitions,
  ...actionCardDefinitions,
  // Phase 3: what they ask Pantopus to remember (memory.js).
  ...memoryToolDefinitions,
  // Phase 3: what waits on them (needsYou.js), and check-backs (followUps.js).
  needsYouDefinition,
  ...followUpToolDefinitions,
  // Phase 3: standing rules, what Pantopus does on its own once they turn it on (rules.js).
  ...ruleToolDefinitions,
  showLinkDefinition,
];

// ─── Tool Executors ─────────────────────────────────────────────────────────

// ─── Drafts end the turn ────────────────────────────────────────────────────
// A draft is the answer: the person sees it as a card. When every call in a round
// was a draft that came out valid, the chat turn ends with the drafts' notes, or
// with this line when there is none, instead of a request to describe the card.
const DRAFT_CLOSINGS = {
  create_post_draft: "Here's a draft post. Change anything you like, then share it.",
  create_gig_draft: "Here's a draft task. Change anything you like, then post it.",
  create_listing_draft: "Here's a draft listing. Change anything you like, then post it.",
  draft_support_train_from_story: 'I have what I need to start a Support Train. Open the card to set it up.',
  draft_pickup_schedule: 'Here are your pickup days. Check them, then save them to your home.',
};

/**
 * The line that ends a turn whose tool calls were all valid drafts, or null.
 * @param {Array<{name: string, result: object}|undefined>} calls  One per tool_use in the round.
 */
function closingForDrafts(calls) {
  const isCard = (call) => call.result.draftType === 'action' && typeof call.result.closing === 'string';
  const finished = calls.length > 0 && calls.every((call) => call && (call.name in DRAFT_CLOSINGS || isCard(call))
    && !call.result.error && call.result.valid !== false);
  if (!finished) return null;
  const notes = calls.map((call) => call.result.note).filter((note) => typeof note === 'string' && note.trim());
  if (!notes.length) return isCard(calls[0]) ? calls[0].result.closing : DRAFT_CLOSINGS[calls[0].name];
  // A note can read as if the change were made ("recycling is set to none"); the
  // pickup card changes nothing until it is saved.
  const saveFirst = calls.some((call) => call.name === 'draft_pickup_schedule') ? ' Nothing changes until you tap Save.' : '';
  return notes.join(' ') + saveFirst;
}

const TOOL_TIMEOUT_MS = 5000;
// Reads that compose several providers, and the plan card's place search, need longer.
const TOOL_TIMEOUTS_MS = {
  get_place_facts: 12000,
  get_today: 12000,
  find_plans: 8000,
  get_plan: 8000,
  find_posts: 8000,
  get_post: 8000,
  // Two feed reads and their replies: as long as Place and Today, and a little more.
  catch_up_nearby: 12000,
  find_recommendations: 15000,
  list_home_tasks: 8000,
  get_household: 8000,
  draft_plan: 15000,
  // The venue's place search, then draft_plan's.
  draft_plan_from_event: 20000,
  // Each home's claim, access, postcard and residency reads.
  get_home_verification: 10000,
  draft_plan_change: 15000,
  show_plan_requests: 8000,
  draft_plan_ask: 8000,
  draft_plan_message: 8000,
  draft_home_task: 8000,
  draft_home_task_update: 8000,
  draft_home_year: 15000,
  draft_home_system: 12000,
  draft_home_asset: 8000,
  draft_memory: 8000,
  draft_plan_alert: 8000,
  recall_memory: 8000,
  needs_you: 8000,
  draft_follow_up: 8000,
  draft_follow_up_cancel: 5000,
  list_follow_ups: 5000,
  // The Plans checks for a repost, or the household's members and pickup days.
  draft_rule: 15000,
  draft_rule_change: 15000,
  list_rules: 8000,
};

/** The tool context: the person and what this turn knows. A bare user id still works (older callers, tests). */
function toolContext(userOrCtx) {
  if (userOrCtx && typeof userOrCtx === 'object') {
    const userId = userOrCtx.userId || userOrCtx.user?.id;
    return { ...userOrCtx, userId, user: userOrCtx.user || { id: userId } };
  }
  return { userId: userOrCtx, user: { id: userOrCtx } };
}

/** The declared tool a call means. Claude occasionally gets the letter case of a name wrong; an unambiguous match is taken. */
function canonicalToolName(name) {
  if (toolDefinitions.some((tool) => tool.name === name)) return name;
  const matches = toolDefinitions.filter((tool) => tool.name.toLowerCase() === String(name).toLowerCase());
  return matches.length === 1 ? matches[0].name : name;
}

/**
 * Execute a tool call with a timeout.
 */
async function executeTool(name, args, userOrCtx) {
  const ctx = toolContext(userOrCtx);
  const { userId } = ctx;
  const tool = canonicalToolName(name);
  const budget = TOOL_TIMEOUTS_MS[tool] || TOOL_TIMEOUT_MS;
  let timer;
  // The deadline is enforced here: a stuck read answers "timed out" and the turn goes on.
  const late = new Promise((resolve) => {
    timer = setTimeout(() => {
      logger.warn('Tool execution timeout', { tool, userId });
      resolve({ error: `Tool ${tool} timed out. Say it couldn't be checked just now.` });
    }, budget);
    timer.unref?.();
  });
  try {
    return await Promise.race([_executeToolImpl(tool, args || {}, ctx), late]);
  } catch (err) {
    logger.error('Tool execution error', { tool, userId, error: err.message });
    return { error: `Tool ${tool} failed: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function _executeToolImpl(name, args, ctx) {
  const { userId } = ctx;
  const read = await runReadTool(name, args, ctx);
  if (read) return read;
  const nearby = await runNearbyReadTool(name, args, ctx);
  if (nearby) return nearby;
  const verification = await runVerificationReadTool(name, args, ctx);
  if (verification) return verification;
  const drafted = await runCardTool(name, args, ctx);
  if (drafted) return drafted;
  const remembered = await runMemoryTool(name, args, ctx);
  if (remembered) return remembered;
  if (name === 'needs_you') return runNeedsYou(ctx);
  const followed = await runFollowUpTool(name, args, ctx);
  if (followed) return followed;
  const ruled = await runRuleTool(name, args, ctx);
  if (ruled) return ruled;
  if (name === 'show_link') return runShowLink(args, ctx);
  switch (name) {
    case 'get_user_context':
      return _getUserContext(userId);


    case 'get_place_alerts':
      return _getPlaceAlerts(userId, args.place_label);

    case 'get_mail_item':
      return _getMailItem(userId, args.mail_item_id);

    case 'create_gig_draft': {
      const { note, ...fields } = args;
      const draft = { ...fields };
      // Add default location preferences
      if (!draft.location_preferences) {
        draft.location_preferences = {
          visibility_scope: 'city',
          location_precision: 'approx_area',
          reveal_policy: 'after_assignment',
        };
      }
      if (!draft.pay_type) draft.pay_type = 'fixed';
      if (!draft.schedule_type) draft.schedule_type = 'flexible';
      if (!draft.cancellation_policy) draft.cancellation_policy = 'standard';
      draft.clarifying_questions = draft.clarifying_questions || [];

      const valid = validateGigDraft(draft);
      return { draft, valid, errors: valid ? null : validateGigDraft.errors, draftType: 'gig', note: note || null };
    }

    case 'create_listing_draft': {
      const { note, ...fields } = args;
      const draft = { ...fields };
      if (draft.isFree === undefined) draft.isFree = false;
      if (draft.deliveryAvailable === undefined) draft.deliveryAvailable = false;
      if (!draft.meetupPreference) draft.meetupPreference = 'flexible';
      if (!draft.tags) draft.tags = [];
      draft.clarifying_questions = draft.clarifying_questions || [];

      const valid = validateListingDraft(draft);
      return { draft, valid, errors: valid ? null : validateListingDraft.errors, draftType: 'listing', note: note || null };
    }

    case 'create_post_draft': {
      const { note, ...fields } = args;
      const draft = { ...fields };
      if (!draft.visibility) draft.visibility = 'neighborhood';
      if (!draft.tags) draft.tags = [];
      draft.clarifying_questions = draft.clarifying_questions || [];
      // Fields that don't apply stay out of the card; event times go out as UTC.
      for (const key of ['eventDate', 'eventEndDate', 'eventVenue', 'dealExpiresAt', 'lostFoundType', 'safetyAlertKind']) {
        if (draft[key] == null || draft[key] === '') delete draft[key];
      }
      if (draft.eventDate) draft.eventDate = localToUtc(draft.eventDate, ctx.timeZone) || undefined;
      if (draft.eventEndDate) draft.eventEndDate = localToUtc(draft.eventEndDate, ctx.timeZone) || undefined;
      if (draft.postType === 'alert' && !draft.safetyAlertKind) draft.safetyAlertKind = 'other';

      const valid = validatePostDraft(draft);
      return { draft, valid, errors: valid ? null : validatePostDraft.errors, draftType: 'post', note: note || null };
    }

    case 'summarize_mail_item': {
      const summary = { ...args };
      if (!summary.key_facts) summary.key_facts = [];
      if (!summary.recommended_actions) summary.recommended_actions = [];

      const valid = validateMailSummary(summary);
      return { summary, valid, errors: valid ? null : validateMailSummary.errors, draftType: 'mail_summary' };
    }

    case 'draft_support_train_from_story': {
      // NOTE: We cannot call draftSupportTrain here because it makes a
      // Claude call (up to 30s) which exceeds TOOL_TIMEOUT_MS (5s).
      // Instead, capture the user's intent and return a structured response
      // that the chat agent can present, prompting the user to confirm
      // and proceed via the Support Train creation flow.
      const story = typeof args.story === 'string' ? args.story.trim() : '';
      if (!story) return { error: 'A Support Train needs the story: who it is for and what help would make a difference.' };
      const supportModes = Array.isArray(args.support_modes_requested) && args.support_modes_requested.length
        ? args.support_modes_requested
        : ['meal'];
      return {
        action: 'support_train_draft_ready',
        // The card carries the story into Support Train setup, where the full draft is made from it.
        draft: { story, support_modes_requested: supportModes },
        valid: true,
        message: 'I have the details for a Support Train. The user should proceed to the Support Train creation flow where AI will generate a full structured draft from this story.',
        draftType: 'support_train',
        note: args.note || null,
      };
    }

    case 'draft_pickup_schedule':
      return draftPickupSchedule(args, userId);

    case 'list_user_support_trains': {
      try {
        // Step 1: find support_train_ids where user is a co-organizer
        const { data: orgRows } = await supabaseAdmin
          .from('SupportTrainOrganizer')
          .select('support_train_id')
          .eq('user_id', userId);
        const coOrgIds = (orgRows || []).map(r => r.support_train_id);

        // Step 2: query trains where user is primary organizer
        let query = supabaseAdmin
          .from('SupportTrain')
          .select(`
            id, status, published_at,
            Activity!inner ( title, summary )
          `)
          .eq('organizer_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (args.status) {
          query = query.eq('status', args.status);
        }

        const { data: ownedData } = await query;
        const ownedIds = new Set((ownedData || []).map(st => st.id));

        // Step 3: fetch co-organized trains not already in owned set
        const missingCoOrgIds = coOrgIds.filter(id => !ownedIds.has(id));
        let coOrgData = [];
        if (missingCoOrgIds.length > 0) {
          let coQuery = supabaseAdmin
            .from('SupportTrain')
            .select(`
              id, status, published_at,
              Activity!inner ( title, summary )
            `)
            .in('id', missingCoOrgIds)
            .order('created_at', { ascending: false })
            .limit(10);

          if (args.status) {
            coQuery = coQuery.eq('status', args.status);
          }

          const { data } = await coQuery;
          coOrgData = data || [];
        }

        // Merge, dedupe, and limit
        const all = [...(ownedData || []), ...coOrgData].slice(0, 10);

        return {
          support_trains: all.map(st => ({
            id: st.id,
            title: st.Activity?.title || null,
            status: st.status,
            published_at: st.published_at,
          })),
        };
      } catch (err) {
        logger.error('list_user_support_trains error', { userId, error: err.message });
        return { support_trains: [], error: err.message };
      }
    }

    case 'get_support_train_summary': {
      try {
        const stId = args.support_train_id;

        // Fetch the support train with activity
        const { data: st } = await supabaseAdmin
          .from('SupportTrain')
          .select(`
            id, status, organizer_user_id, recipient_user_id, story,
            Activity!inner ( title, summary )
          `)
          .eq('id', stId)
          .single();

        if (!st) return { error: 'Support Train not found.' };

        // Verify viewer access: organizer, co-organizer, recipient, or has a reservation
        const isOrganizer = st.organizer_user_id === userId;
        const isRecipient = st.recipient_user_id === userId;

        let hasAccess = isOrganizer || isRecipient;
        if (!hasAccess) {
          const { count: orgCount } = await supabaseAdmin
            .from('SupportTrainOrganizer')
            .select('id', { count: 'exact', head: true })
            .eq('support_train_id', stId)
            .eq('user_id', userId);
          hasAccess = (orgCount || 0) > 0;
        }
        if (!hasAccess) {
          const { count: resCount } = await supabaseAdmin
            .from('SupportTrainReservation')
            .select('id', { count: 'exact', head: true })
            .eq('support_train_id', stId)
            .eq('user_id', userId)
            .neq('status', 'canceled');
          hasAccess = (resCount || 0) > 0;
        }

        if (!hasAccess) return { error: 'NOT_AUTHORIZED' };

        const openSlots = await listEffectivelyOpenSlots({
          supportTrainId: stId,
          columns: 'id, support_train_id, slot_date, status, capacity, filled_count',
        });

        // Fetch recipient profile for summary (no address/phone/private notes)
        const { data: profile } = await supabaseAdmin
          .from('SupportTrainRecipientProfile')
          .select('household_size, dietary_styles, allergies, contactless_preferred')
          .eq('support_train_id', stId)
          .single();

        const recipientSummary = profile
          ? `Household of ${profile.household_size || '?'}${profile.contactless_preferred ? ', contactless preferred' : ''}`
          : null;

        return {
          id: st.id,
          title: st.Activity?.title || null,
          status: st.status,
          recipient_summary: recipientSummary,
          open_slots_count: openSlots.length,
          summary_chips: [],  // populated from AI draft payload if available
        };
      } catch (err) {
        logger.error('get_support_train_summary error', { userId, error: err.message });
        return { error: 'Failed to retrieve Support Train summary.' };
      }
    }

    default:
      // Name the real tools so the model can correct the call on its next round.
      return { error: `Unknown tool: ${name}. The tools are: ${toolDefinitions.map((tool) => tool.name).join(', ')}.` };
  }
}

// ─── Tool Implementation Helpers ────────────────────────────────────────────

async function _getUserContext(userId) {
  try {
    // Saved places and homes, coarse only (no exact addresses): a home's name is often its address,
    // so homes are named "Home" with their city and state, and carry their id for the other tools.
    const [{ data: places }, { homes }] = await Promise.all([
      supabaseAdmin
        .from('SavedPlace')
        .select('id, label, place_type, city, state')
        .eq('user_id', userId)
        .limit(10),
      homesOf(userId),
    ]);

    // Fetch recent counts (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [gigsRes, listingsRes, postsRes] = await Promise.all([
      // Gig and Listing name their owner user_id (posted_by / seller_id do not
      // exist, which made both counts read as zero).
      supabaseAdmin.from('Gig').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('Listing').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('Post').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gte('created_at', thirtyDaysAgo),
    ]);

    return {
      homes: homes.map((home, index) => ({
        home_id: home.id,
        label: homes.length > 1 ? `Home ${index + 1}` : 'Home',
        city: home.city || null,
        state: home.state || null,
        role: home.role || null,
        shown_on_today: home.is_default,
      })),
      saved_places: (places || []).map(p => ({
        label: p.label,
        type: p.place_type,
        city: p.city,
        state: p.state,
      })),
      recent_activity: {
        gigs_posted: gigsRes.count || 0,
        listings_posted: listingsRes.count || 0,
        posts_made: postsRes.count || 0,
      },
    };
  } catch (err) {
    logger.error('get_user_context error', { userId, error: err.message });
    return { homes: [], saved_places: [], recent_activity: {} };
  }
}

async function _getPlaceAlerts(userId, placeLabel) {
  try {
    // A saved place the question names
    let place = null;
    if (placeLabel && placeLabel !== 'primary') {
      const { data: places } = await supabaseAdmin
        .from('SavedPlace')
        .select('id, label, latitude, longitude, city, state')
        .eq('user_id', userId)
        .ilike('label', `%${escapeIlike(placeLabel)}%`)
        .limit(1);
      place = places?.[0] || null;
    }
    // Otherwise the person's own place, as Today and the briefing choose it: their home first.
    if (!place) place = await _primaryPlace(userId);
    if (!place) {
      return { error: 'No home or saved place yet. Suggest adding their home or saving a place in Pantopus.' };
    }

    const result = await noaa.fetchAlerts(place.latitude, place.longitude);

    return {
      place: { label: place.label, city: place.city, state: place.state },
      alerts: result.alerts,
      source: result.source,
      fetched_at: result.fetchedAt,
    };
  } catch (err) {
    logger.error('get_place_alerts error', { userId, placeLabel, error: err.message });
    return { alerts: [], error: err.message };
  }
}

/** The person's main place for location answers; a home is labelled "Home" with its city and state. */
async function _primaryPlace(userId) {
  const location = await resolveLocation(userId);
  if (location.latitude == null || location.longitude == null) return null;
  let home = null;
  if (location.homeId) {
    const { data } = await supabaseAdmin.from('Home').select('city, state').eq('id', location.homeId).maybeSingle();
    home = data;
  }
  let label = 'Your area';
  if (location.homeId) label = 'Home';
  else if (location.source === 'saved_place') label = location.label;
  return {
    label,
    latitude: location.latitude,
    longitude: location.longitude,
    city: home?.city || null,
    state: home?.state || null,
  };
}

async function _getMailItem(userId, mailItemId) {
  try {
    const item = await getAuthorizedMail({
      mailItemId,
      userId,
      select: 'id, subject, content, preview_text, sender_display, sender_trust, category, type, urgency, due_date, key_facts, lifecycle',
    });

    if (!item) {
      return { error: 'Mail item not found or access denied.' };
    }
    return {
      mail: {
        subject: item.subject,
        content: item.content || item.preview_text,
        sender: item.sender_display,
        sender_trust: item.sender_trust,
        category: item.category,
        type: item.type,
        urgency: item.urgency,
        due_date: item.due_date,
        existing_key_facts: item.key_facts,
        lifecycle: item.lifecycle,
      },
    };
  } catch (err) {
    logger.error('get_mail_item error', { userId, mailItemId, error: err.message });
    return { error: 'Failed to retrieve mail item.' };
  }
}

module.exports = {
  toolDefinitions,
  executeTool,
  closingForDrafts,
};
