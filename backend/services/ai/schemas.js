/**
 * AI Draft Schemas — JSON Schema definitions for structured AI outputs.
 *
 * These schemas enforce that AI responses conform to the shapes expected by
 * the existing Joi validation in gig / listing / post routes.  They are used
 * with:
 *   1.  OpenAI Responses API `text.format.type = 'json_schema'` for forced
 *       structured output.
 *   2.  Server-side validation before returning to the client.
 */
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, coerceTypes: false });
addFormats(ajv);

// ─── Gig Draft Schema ──────────────────────────────────────────────────────

const gigDraftJsonSchema = {
  type: 'object',
  properties: {
    title:                { type: 'string', minLength: 3, maxLength: 255 },
    description:          { type: 'string', minLength: 5 },
    price:                { type: ['number', 'null'], minimum: 0 },
    category:             { type: ['string', 'null'], maxLength: 100 },
    is_urgent:            { type: ['boolean', 'null'] },
    tags:                 { type: 'array', items: { type: 'string' }, maxItems: 5 },
    schedule_type:        { type: ['string', 'null'], enum: ['asap', 'today', 'scheduled', 'flexible', null] },
    pay_type:             { type: ['string', 'null'], enum: ['fixed', 'hourly', 'offers', null] },
    estimated_duration:   { type: ['number', 'null'], minimum: 0 },
    cancellation_policy:  { type: ['string', 'null'], enum: ['flexible', 'standard', 'strict', null] },
    special_instructions: { type: ['string', 'null'] },
    access_notes:         { type: ['string', 'null'] },
    required_tools:       { type: ['string', 'null'] },
    location_preferences: {
      type: ['object', 'null'],
      properties: {
        visibility_scope:   { type: 'string', enum: ['neighborhood', 'city', 'radius', 'global'] },
        location_precision: { type: 'string', enum: ['exact_place', 'approx_area', 'neighborhood_only', 'none'] },
        reveal_policy:      { type: 'string', enum: ['public', 'after_interest', 'after_assignment', 'never_public'] },
      },
      required: ['visibility_scope', 'location_precision', 'reveal_policy'],
      additionalProperties: false,
    },
    clarifying_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:       { type: 'string' },
          question: { type: 'string' },
        },
        required: ['id', 'question'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'description'],
  additionalProperties: false,
};

// ─── Listing Draft Schema ──────────────────────────────────────────────────

const listingDraftJsonSchema = {
  type: 'object',
  properties: {
    title:              { type: 'string', minLength: 3, maxLength: 255 },
    description:        { type: 'string', maxLength: 5000 },
    price:              { type: ['number', 'null'], minimum: 0 },
    isFree:             { type: 'boolean' },
    category:           { type: 'string', enum: ['electronics', 'furniture', 'clothing', 'sports', 'books', 'toys', 'tools', 'automotive', 'home_garden', 'collectibles', 'music', 'baby_kids', 'other'] },
    condition:          { type: ['string', 'null'], enum: ['new', 'like_new', 'good', 'fair', 'for_parts', null] },
    tags:               { type: 'array', items: { type: 'string' }, maxItems: 3 },
    listingType:        { type: 'string', enum: ['sell_item', 'free_item', 'wanted_request', 'rent_sublet', 'vehicle_sale', 'vehicle_rent', 'service_gig'] },
    deliveryAvailable:  { type: 'boolean' },
    meetupPreference:   { type: ['string', 'null'], enum: ['porch_pickup', 'public_meetup', 'flexible', null] },
    budgetMax:          { type: ['number', 'null'] },
    visibilityScope:    { type: 'string', enum: ['neighborhood', 'city', 'radius', 'global'] },
    locationPrecision:  { type: 'string', enum: ['exact_place', 'approx_area', 'neighborhood_only', 'none'] },
    clarifying_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:       { type: 'string' },
          question: { type: 'string' },
        },
        required: ['id', 'question'],
        additionalProperties: false,
      },
    },
  },
  required: ['title'],
  additionalProperties: false,
};

// ─── Post Draft Schema ─────────────────────────────────────────────────────

const postDraftJsonSchema = {
  type: 'object',
  properties: {
    content:          { type: 'string', minLength: 1, maxLength: 5000 },
    title:            { type: ['string', 'null'], maxLength: 255 },
    postType:         { type: 'string', enum: ['general', 'event', 'alert', 'deal', 'ask_local', 'recommendation', 'lost_found', 'service_offer', 'announcement', 'personal_update', 'resources_howto', 'progress_wins'] },
    purpose:          { type: 'string', enum: ['ask', 'offer', 'heads_up', 'recommend', 'event', 'deal', 'story'] },
    visibility:       { type: 'string', enum: ['public', 'neighborhood', 'followers', 'private', 'city', 'radius', 'connections'] },
    tags:             { type: 'array', items: { type: 'string' }, maxItems: 3 },
    eventDate:        { type: ['string', 'null'] },
    eventEndDate:     { type: ['string', 'null'] },
    eventVenue:       { type: ['string', 'null'] },
    safetyAlertKind:  { type: ['string', 'null'] },
    lostFoundType:    { type: ['string', 'null'], enum: ['lost', 'found', null] },
    dealExpiresAt:    { type: ['string', 'null'] },
    clarifying_questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id:       { type: 'string' },
          question: { type: 'string' },
        },
        required: ['id', 'question'],
        additionalProperties: false,
      },
    },
  },
  required: ['content'],
  additionalProperties: false,
};

// ─── Mail Summary Schema ───────────────────────────────────────────────────

const mailSummaryJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    key_facts: {
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
          type:     { type: 'string', enum: ['pay', 'remind', 'file', 'create_task', 'acknowledge', 'dispute', 'share_household', 'forward'] },
          title:    { type: 'string' },
          reason:   { type: ['string', 'null'] },
          metadata: { type: ['string', 'null'] },
        },
        required: ['type', 'title', 'reason', 'metadata'],
        additionalProperties: false,
      },
    },
    urgency: { type: 'string', enum: ['none', 'due_soon', 'overdue', 'time_sensitive'] },
  },
  required: ['summary', 'urgency'],
  additionalProperties: false,
};

// ─── Place Brief Schema ────────────────────────────────────────────────────

const placeBriefJsonSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    headlines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type:     { type: 'string', enum: ['weather', 'traffic', 'civic', 'utility'] },
          title:    { type: 'string', maxLength: 120 },
          severity: { type: 'string', enum: ['low', 'moderate', 'high', 'critical'] },
          detail:   { type: ['string', 'null'] },
          action:   { type: ['string', 'null'] },
        },
        required: ['type', 'title', 'severity', 'detail', 'action'],
        additionalProperties: false,
      },
      maxItems: 5,
    },
    overall_status: { type: 'string', enum: ['all_clear', 'advisory', 'warning', 'critical'] },
  },
  required: ['summary', 'headlines', 'overall_status'],
  additionalProperties: false,
};

// ─── Support Train Draft Schema ───────────────────────────────────────────

const supportTrainDraftJsonSchema = {
  type: 'object',
  properties: {
    story:                    { type: 'string', maxLength: 500 },
    recipient_summary:        { type: 'string' },
    support_modes_requested:  {
      type: 'array',
      items: { type: 'string', enum: ['meal', 'takeout', 'groceries', 'gift_funds'] },
    },
    suggested_duration_days:  { type: ['integer', 'null'] },
    suggested_schedule:       { type: 'string', enum: ['every_dinner', 'mwf_dinners', 'every_lunch', 'weekly_groceries', 'custom'] },
    dietary_restrictions:     { type: 'array', items: { type: 'string' } },
    dietary_preferences:      { type: 'array', items: { type: 'string' } },
    household_size:           { type: ['integer', 'null'] },
    preferred_dropoff_window: {
      type: ['object', 'null'],
      properties: {
        start_time: { type: ['string', 'null'] },
        end_time:   { type: ['string', 'null'] },
      },
      required: ['start_time', 'end_time'],
      additionalProperties: false,
    },
    contactless_preferred:    { type: 'boolean' },
    special_instructions:     { type: ['string', 'null'] },
    summary_chips:            { type: 'array', items: { type: 'string' }, maxItems: 10 },
    missing_required_fields:  {
      type: 'array',
      items: { type: 'string', enum: ['recipient', 'address', 'dropoff_window', 'restrictions', 'co_organizer', 'support_modes'] },
    },
  },
  required: ['story', 'recipient_summary', 'support_modes_requested', 'suggested_schedule', 'dietary_restrictions', 'dietary_preferences', 'contactless_preferred', 'summary_chips', 'missing_required_fields'],
  additionalProperties: false,
};

// ─── Strict variants for OpenAI Responses API ────────────────────────────
// strict: true requires every property key in `required`.

const gigDraftJsonSchemaStrict = {
  ...gigDraftJsonSchema,
  required: Object.keys(gigDraftJsonSchema.properties),
};

const listingDraftJsonSchemaStrict = {
  ...listingDraftJsonSchema,
  required: Object.keys(listingDraftJsonSchema.properties),
};

const postDraftJsonSchemaStrict = {
  ...postDraftJsonSchema,
  required: Object.keys(postDraftJsonSchema.properties),
};

const mailSummaryJsonSchemaStrict = {
  ...mailSummaryJsonSchema,
  required: Object.keys(mailSummaryJsonSchema.properties),
};

const placeBriefJsonSchemaStrict = {
  ...placeBriefJsonSchema,
  required: Object.keys(placeBriefJsonSchema.properties),
};

const supportTrainDraftJsonSchemaStrict = {
  ...supportTrainDraftJsonSchema,
  required: Object.keys(supportTrainDraftJsonSchema.properties),
};

// ─── Compile validators ────────────────────────────────────────────────────

const validateGigDraft     = ajv.compile(gigDraftJsonSchema);
const validateListingDraft = ajv.compile(listingDraftJsonSchema);
const validatePostDraft    = ajv.compile(postDraftJsonSchema);
const validateMailSummary  = ajv.compile(mailSummaryJsonSchema);
const validatePlaceBrief            = ajv.compile(placeBriefJsonSchema);
const validateSupportTrainDraft    = ajv.compile(supportTrainDraftJsonSchema);

module.exports = {
  // JSON Schemas (for OpenAI structured output)
  gigDraftJsonSchema,
  gigDraftJsonSchemaStrict,
  listingDraftJsonSchema,
  listingDraftJsonSchemaStrict,
  postDraftJsonSchema,
  postDraftJsonSchemaStrict,
  mailSummaryJsonSchema,
  mailSummaryJsonSchemaStrict,
  placeBriefJsonSchema,
  placeBriefJsonSchemaStrict,
  supportTrainDraftJsonSchema,
  supportTrainDraftJsonSchemaStrict,

  // Compiled validators (for server-side validation)
  validateGigDraft,
  validateListingDraft,
  validatePostDraft,
  validateMailSummary,
  validatePlaceBrief,
  validateSupportTrainDraft,
};
