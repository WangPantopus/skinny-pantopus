/**
 * AI Agent Tools — function definitions that the LLM can call.
 *
 * Each tool has:
 *   definition  – Schema sent to OpenAI (function calling format)
 *   execute     – Server-side implementation that runs when the LLM calls it
 *
 * Tools are sandboxed: they only access data the user is authorised to see.
 */
const supabaseAdmin = require('../../config/supabaseAdmin');
const noaa = require('../external/noaa');
const logger = require('../../utils/logger');
const { getAuthorizedMail } = require('./mailAccess');
const { listEffectivelyOpenSlots } = require('../supportTrainSlotAvailability');

const {
  validateGigDraft,
  validateListingDraft,
  validatePostDraft,
  validateMailSummary,
} = require('./schemas');

// ─── Tool Definitions (sent to OpenAI) ─────────────────────────────────────

const toolDefinitions = [
  {
    type: 'function',
    name: 'get_user_context',
    description: 'Get the current user\'s saved places, recent activity counts, and coarse location context. Never returns exact addresses.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'get_place_alerts',
    description: 'Get active weather alerts (NOAA) near a saved place. Provide the place label or saved place ID.',
    parameters: {
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
    strict: true,
  },
  {
    type: 'function',
    name: 'get_mail_item',
    description: 'Get the content of a specific mail item for summarization. Requires the mail item ID.',
    parameters: {
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
    strict: true,
  },
  {
    type: 'function',
    name: 'create_gig_draft',
    description: 'Create a structured gig (task) draft. Call this when you have enough information to draft a task the user needs help with.',
    parameters: {
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
      },
      // strict mode requires every property to be in required; optional fields use null.
      required: ['title', 'description', 'price', 'category', 'is_urgent', 'tags', 'schedule_type', 'pay_type', 'estimated_duration', 'special_instructions'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_listing_draft',
    description: 'Create a structured marketplace listing draft. Call this when the user wants to sell, give away, or request an item.',
    parameters: {
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
      },
      required: ['title', 'description', 'price', 'isFree', 'category', 'condition', 'tags', 'listingType', 'deliveryAvailable', 'meetupPreference'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'create_post_draft',
    description: 'Create a structured community post draft. Call this when the user wants to share something with their neighborhood.',
    parameters: {
      type: 'object',
      properties: {
        content:    { type: 'string', description: 'Post text content, max 2000 chars' },
        title:      { type: ['string', 'null'], description: 'Optional title for events, alerts, announcements' },
        postType:   { type: 'string', enum: ['general', 'event', 'alert', 'deal', 'ask_local', 'recommendation', 'lost_found', 'service_offer', 'announcement', 'personal_update', 'resources_howto', 'progress_wins'] },
        purpose:    { type: ['string', 'null'], enum: ['ask', 'offer', 'heads_up', 'recommend', 'event', 'deal', 'story', null] },
        visibility: { type: ['string', 'null'], enum: ['neighborhood', 'public', 'followers', 'connections', null] },
        tags:       { type: ['array', 'null'], items: { type: 'string' }, description: 'Up to 3 tags' },
      },
      required: ['content', 'title', 'postType', 'purpose', 'visibility', 'tags'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'summarize_mail_item',
    description: 'Generate a structured summary of a mail item with recommended actions. Call this after retrieving mail content with get_mail_item.',
    parameters: {
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
    strict: true,
  },
  {
    type: 'function',
    name: 'draft_support_train_from_story',
    description: 'Draft a Support Train (community help coordination) from a free-text story. Returns a structured draft the user can review.',
    parameters: {
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
      },
      required: ['story', 'support_modes_requested'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    type: 'function',
    name: 'list_user_support_trains',
    description: 'List Support Trains the current user organizes or participates in.',
    parameters: {
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
    strict: true,
  },
  {
    type: 'function',
    name: 'get_support_train_summary',
    description: 'Get a summary of one Support Train, including open slots, recipient summary, and restriction chips.',
    parameters: {
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
    strict: true,
  },
];

// ─── Tool Executors ─────────────────────────────────────────────────────────

const TOOL_TIMEOUT_MS = 5000;

/**
 * Execute a tool call with a timeout.
 */
async function executeTool(name, args, userId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOOL_TIMEOUT_MS);

  try {
    const result = await _executeToolImpl(name, args, userId, controller.signal);
    clearTimeout(timeout);
    return result;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      logger.warn('Tool execution timeout', { tool: name, userId });
      return { error: `Tool ${name} timed out` };
    }
    logger.error('Tool execution error', { tool: name, userId, error: err.message });
    return { error: `Tool ${name} failed: ${err.message}` };
  }
}

async function _executeToolImpl(name, args, userId, _signal) {
  switch (name) {
    case 'get_user_context':
      return _getUserContext(userId);

    case 'get_place_alerts':
      return _getPlaceAlerts(userId, args.place_label);

    case 'get_mail_item':
      return _getMailItem(userId, args.mail_item_id);

    case 'create_gig_draft': {
      const draft = { ...args };
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
      return { draft, valid, errors: valid ? null : validateGigDraft.errors, draftType: 'gig' };
    }

    case 'create_listing_draft': {
      const draft = { ...args };
      if (draft.isFree === undefined) draft.isFree = false;
      if (draft.deliveryAvailable === undefined) draft.deliveryAvailable = false;
      if (!draft.meetupPreference) draft.meetupPreference = 'flexible';
      if (!draft.tags) draft.tags = [];
      draft.clarifying_questions = draft.clarifying_questions || [];

      const valid = validateListingDraft(draft);
      return { draft, valid, errors: valid ? null : validateListingDraft.errors, draftType: 'listing' };
    }

    case 'create_post_draft': {
      const draft = { ...args };
      if (!draft.visibility) draft.visibility = 'neighborhood';
      if (!draft.tags) draft.tags = [];
      draft.clarifying_questions = draft.clarifying_questions || [];

      const valid = validatePostDraft(draft);
      return { draft, valid, errors: valid ? null : validatePostDraft.errors, draftType: 'post' };
    }

    case 'summarize_mail_item': {
      const summary = { ...args };
      if (!summary.key_facts) summary.key_facts = [];
      if (!summary.recommended_actions) summary.recommended_actions = [];

      const valid = validateMailSummary(summary);
      return { summary, valid, errors: valid ? null : validateMailSummary.errors, draftType: 'mail_summary' };
    }

    case 'draft_support_train_from_story': {
      // NOTE: We cannot call draftSupportTrain here because it makes an
      // OpenAI API call (~5-30s) which exceeds TOOL_TIMEOUT_MS (5s).
      // Instead, capture the user's intent and return a structured response
      // that the chat agent can present, prompting the user to confirm
      // and proceed via the Support Train creation flow.
      return {
        action: 'support_train_draft_ready',
        story: args.story,
        support_modes_requested: args.support_modes_requested || ['meal'],
        message: 'I have the details for a Support Train. The user should proceed to the Support Train creation flow where AI will generate a full structured draft from this story.',
        draftType: 'support_train',
      };
    }

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
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── Tool Implementation Helpers ────────────────────────────────────────────

async function _getUserContext(userId) {
  try {
    // Fetch saved places (coarse info only — no exact addresses)
    const { data: places } = await supabaseAdmin
      .from('SavedPlace')
      .select('id, label, place_type, city, state')
      .eq('user_id', userId)
      .limit(10);

    // Fetch recent counts (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [gigsRes, listingsRes, postsRes] = await Promise.all([
      supabaseAdmin.from('Gig').select('id', { count: 'exact', head: true })
        .eq('posted_by', userId).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('Listing').select('id', { count: 'exact', head: true })
        .eq('seller_id', userId).gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('Post').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gte('created_at', thirtyDaysAgo),
    ]);

    return {
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
    return { saved_places: [], recent_activity: {} };
  }
}

async function _getPlaceAlerts(userId, placeLabel) {
  try {
    // Find the saved place
    const query = supabaseAdmin
      .from('SavedPlace')
      .select('id, label, latitude, longitude, city, state')
      .eq('user_id', userId);

    if (placeLabel === 'primary') {
      query.limit(1);
    } else {
      query.ilike('label', `%${placeLabel}%`).limit(1);
    }

    const { data: places } = await query;
    if (!places || places.length === 0) {
      return { error: 'No saved place found matching that label. Ask the user for a place name.' };
    }

    const place = places[0];
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
};
