/**
 * AI Agent Service — core orchestrator for all AI features.
 *
 * Uses the Claude Messages API (Sonnet 5.5) with:
 *   - Streaming for the chat agent
 *   - Tool use for data retrieval and draft creation
 *   - Structured outputs for single-turn drafts
 *   - A stored transcript (AIConversation.messages) for multi-turn state: the
 *     Messages API is stateless, so each turn is sent the conversation so far
 *
 * Handles:
 *   1. streamChat()        — Multi-turn chat agent with SSE streaming
 *   2. draftListing()      — Single-turn listing draft
 *   3. draftPost()         — Single-turn post draft
 *      suggestPost()       — The composer's AI assist: the whole post from photos, place and notes
 *   4. summarizeMail()     — Mail summarization with action extraction
 *   5. generatePlaceBrief() — Place brief from external data
 */
const { getAnthropicClient, resolveEffort, CHAT_MODEL, DRAFT_MODEL } = require('../../config/anthropic');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { toolDefinitions, executeTool, closingForDrafts } = require('./tools');
const prompts = require('./prompts');
const schemas = require('./schemas');
const {
  AIRefusalError, complete, emptyUsage, imageBlock, isDocumentError, isImageError, isTimeoutError, systemBlocks,
  supportsSystemMessages, describeNow, todayLine,
} = require('./llm');
const { runAgentTurn, sanitizeHistory, compactForStorage } = require('./agentLoop');
const { buildChatContext, lastContextText, userTimeZone, CONTEXT_HEADER } = require('./chatContext');
const { photoBlocks } = require('./photos');
const { refreshPickupDraft, editorFields } = require('./pickupDraft');
const radonReport = require('./radonReport');
const postSuggestion = require('./postSuggestion');
const { getAuthorizedMail } = require('./mailAccess');
const { nameMailSender } = require('../../utils/mailSenderView');
const noaa = require('../external/noaa');
const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');
const { isFeatureEnabled } = require('../featureFlagService');
const { readToolDefinitions, playdateReadToolDefinitions, PLAN_TOOLS } = require('./readTools');
const { actionCardDefinitions, playdateCardDefinitions, PLAN_CARD_TOOLS, draftPlanDefinition } = require('./actionCards');
const { appGuide } = require('./appGuide');
const { screenContextText, screenName } = require('./screenContext');
const { checkChatBudget } = require('./assistantBudget');
const memory = require('./memory');
const followUps = require('./followUps');
const rules = require('./rules');
const agentRecord = require('./agentRecord');
const cardState = require('./cardState');

const READ_TOOL_NAMES = new Set(readToolDefinitions.map((tool) => tool.name));
const CARD_TOOL_NAMES = new Set(actionCardDefinitions.map((tool) => tool.name));
// The plan tools with playdates among their kinds, for people with plans_playdates.
const PLAYDATE_TOOLS = new Map([...playdateReadToolDefinitions, ...playdateCardDefinitions].map((tool) => [tool.name, tool]));

// Launch cuts #3 (Marketplace) and #4 (Open Gigs): while they are hidden, the
// chat assistant neither offers nor drafts listings or open tasks (their
// drafts would lead to hidden composers). The drafting code itself stays.
// Launch cut #10 (Mailbox): it doesn't read or summarize mail either.
// Gift funds (cut #9) aren't offered as a Support Train kind of help.
// Cards go only to apps that say they can show them (`cards`): the pickup days,
// action cards ("action") and link buttons ("link"). Plans tools need the
// person's `plans` flag, and playdates among their kinds `plans_playdates`.
// The read tools answer in words, so every app gets them.
function launchScopedChatTools({
  pickupSchedule = false, actionCards = false, links = false, plans = false, playdates = false, remembers = false, checksBack = false,
  standingRules = false, sports = false,
} = {}) {
  const giftFunds = isLaunchFeatureEnabled('gift_funds');
  return toolDefinitions
    .filter((tool) => {
      if (['find_games', 'find_teams', 'draft_sports_teams'].includes(tool.name)) return plans && sports && (tool.name !== 'draft_sports_teams' || actionCards);
      if (tool.name === 'draft_pickup_schedule') return pickupSchedule;
      // Phase 3 memory (`cards` lists "memory"): its cards also need "action", and plan alerts Plans.
      if (memory.MEMORY_TOOL_NAMES.has(tool.name)) {
        if (!memory.MEMORY_CARD_TOOLS.has(tool.name)) return remembers;
        return remembers && actionCards && (plans || tool.name !== 'draft_plan_alert');
      }
      // Follow-ups (`cards` lists "follow_up"): its cards also need "action".
      if (followUps.FOLLOW_UP_TOOL_NAMES.has(tool.name)) return checksBack && (actionCards || !followUps.FOLLOW_UP_CARD_TOOLS.has(tool.name));
      // Standing rules (`cards` lists "rules"): its cards also need "action".
      if (rules.RULE_TOOL_NAMES.has(tool.name)) return standingRules && (actionCards || !rules.RULE_CARD_TOOLS.has(tool.name));
      if (CARD_TOOL_NAMES.has(tool.name)) return actionCards && (plans || !PLAN_CARD_TOOLS.has(tool.name));
      if (READ_TOOL_NAMES.has(tool.name)) return plans || !PLAN_TOOLS.has(tool.name);
      if (tool.name === 'show_link') return links;
      if (tool.name === 'create_gig_draft') return isLaunchFeatureEnabled('open_gigs');
      if (tool.name === 'create_listing_draft') return isLaunchFeatureEnabled('marketplace');
      if (['get_mail_item', 'summarize_mail_item'].includes(tool.name)) return isLaunchFeatureEnabled('mailbox');
      return true;
    })
    .map((tool) => (tool.name === 'draft_support_train_from_story' && !giftFunds ? withoutGiftFunds(tool) : tool))
    .map((tool) => (playdates && PLAYDATE_TOOLS.get(tool.name)) || tool)
    .map((tool) => tool.name === 'draft_plan' ? draftPlanDefinition({ playdates, sports: plans && sports }) : tool);
}

function withoutGiftFunds(tool) {
  const modes = tool.input_schema.properties.support_modes_requested;
  return {
    ...tool,
    input_schema: {
      ...tool.input_schema,
      properties: {
        ...tool.input_schema.properties,
        support_modes_requested: { ...modes, items: { ...modes.items, enum: modes.items.enum.filter((mode) => mode !== 'gift_funds') } },
      },
    },
  };
}

function launchScopedChatInstructions({
  pickupSchedule = false, actionCards = false, links = false, plans = false, playdates = false, remembers = false, checksBack = false,
  standingRules = false, sports = false,
} = {}) {
  return prompts.chatAgentSystem({
    openGigs: isLaunchFeatureEnabled('open_gigs'),
    marketplace: isLaunchFeatureEnabled('marketplace'),
    mailbox: isLaunchFeatureEnabled('mailbox'),
    pickupSchedule,
    actionCards,
    links,
    plans,
    sports: plans && sports,
    remembers: remembers && actionCards,
    checksBack: checksBack && actionCards,
    standingRules: standingRules && actionCards,
    guide: appGuide({
      plans, playdates, sports: plans && sports, suggestions: actionCards, actionCards, links, pickupSchedule, remembers: remembers && actionCards, standingRules: standingRules && actionCards,
    }),
  });
}

/**
 * The apps show replies as plain text, so bold markers (**like this**) would show as
 * asterisks. Claude is told not to use them; this removes any that slip through, holding
 * a trailing "*" until the next piece arrives in case a pair is split across two.
 */
function plainTextStream(write) {
  let held = '';
  return {
    push(delta) {
      let text = held + delta;
      held = '';
      if (text.endsWith('*')) {
        held = '*';
        text = text.slice(0, -1);
      }
      text = text.replace(/\*\*/g, '');
      if (text) write(text);
    },
    flush() {
      if (held) write(held);
      held = '';
    },
  };
}

// What the person sees while a tool runs (SSE `status`; older apps ignore the event).
const TOOL_STATUS = {
  create_post_draft: 'Drafting your post…',
  create_gig_draft: 'Drafting your task…',
  create_listing_draft: 'Drafting your listing…',
  draft_support_train_from_story: 'Drafting your Support Train…',
  draft_pickup_schedule: 'Drafting your pickup days…',
  get_place_alerts: 'Checking alerts near your place…',
  get_user_context: 'Looking at your places…',
  list_user_support_trains: 'Looking up your Support Trains…',
  get_support_train_summary: 'Looking up that Support Train…',
  get_mail_item: 'Reading your mail…',
  summarize_mail_item: 'Summarizing your mail…',
  find_plans: 'Looking at plans…',
  get_plan: 'Looking at the plan…',
  find_posts: 'Reading posts nearby…',
  get_post: 'Reading the post…',
  catch_up_nearby: 'Catching up on Nearby…',
  find_recommendations: 'Looking at what neighbors recommend…',
  get_place_facts: 'Checking your home…',
  get_today: 'Checking today…',
  list_home_tasks: 'Looking at your tasks…',
  get_household: 'Looking at your household…',
  get_notification_settings: 'Checking your settings…',
  get_home_verification: 'Checking your claim and postcard…',
  draft_plan: 'Drafting your plan…',
  draft_plan_from_event: 'Drafting your plan…',
  draft_plan_change: 'Drafting the change…',
  draft_plan_cancel: 'Getting the plan ready to cancel…',
  show_plan_requests: 'Looking at who asked…',
  draft_plan_ask: 'Drafting your ask…',
  draft_plan_message: 'Drafting your message…',
  draft_post_reply: 'Drafting your reply…',
  draft_post_solve: 'Getting it ready to mark solved…',
  draft_home_task: 'Drafting the task…',
  draft_home_task_update: 'Getting the task ready…',
  draft_home_year: 'Planning your year…',
  draft_home_system: 'Getting your home\'s record ready…',
  draft_home_asset: 'Getting your home\'s record ready…',
  draft_notification_settings: 'Drafting your settings…',
  show_link: 'Finding the screen…',
  draft_memory: 'Getting it ready to remember…',
  draft_plan_alert: 'Setting up the alert…',
  recall_memory: 'Checking what you asked me to remember…',
  needs_you: 'Checking what needs you…',
  draft_follow_up: 'Getting the check-back ready…',
  draft_follow_up_cancel: 'Getting it ready to cancel…',
  list_follow_ups: 'Looking at your check-backs…',
  draft_rule: 'Getting the rule ready…',
  draft_rule_change: 'Getting the change ready…',
  list_rules: 'Looking at what I do for you…',
};

// A draft Claude declined to write: not an outage, so not "try again later".
const DECLINED = {
  error: 'AI_DECLINED',
  message: "Pantopus AI can't help with this one. You can still write it yourself.",
  fallback: true,
};

// Effort sets how long Claude thinks before it answers. `low` keeps time to
// first token down (the default, `high`, is far slower) and suits chat and
// extraction; raise a tier here only with a measured quality gain.
const CHAT_EFFORT = resolveEffort(process.env.ANTHROPIC_CHAT_EFFORT, 'low');
const DRAFT_EFFORT = resolveEffort(process.env.ANTHROPIC_DRAFT_EFFORT, 'low');
// max_tokens covers the model's thinking as well as the reply; it is only a
// ceiling (billing follows what is generated), so leave generous room.
const CHAT_MAX_TOKENS = 4096;
const DRAFT_MAX_TOKENS = 4096;
const MAX_TOOL_ROUNDS = 8;         // Maximum tool-call → response rounds (look up, then draft)
const AGENT_TIMEOUT_MS = 45000;    // 45s for a whole turn: a few reads and a card
const DRAFT_TIMEOUT_MS = 30000;    // 30s for single-turn drafts
// The composer's AI assist answers inside the Android app's 30 s read timeout, so a slow
// suggestion comes back as "took too long" rather than a dropped connection.
const SUGGESTION_TIMEOUT_MS = 25000;

// ─── Request Logging ────────────────────────────────────────────────────────

async function logRequest({
  userId, conversationId, endpoint, model, promptVersion,
  status, latencyMs, inputTokens, outputTokens,
  toolCallsCount, schemaValid, cacheHit, errorMessage, agentRequestId,
}) {
  const row = {
    user_id: userId || null,
    conversation_id: conversationId || null,
    endpoint,
    model,
    prompt_version: promptVersion,
    status,
    latency_ms: latencyMs,
    input_tokens: inputTokens || null,
    output_tokens: outputTokens || null,
    tool_calls_count: toolCallsCount || 0,
    schema_valid: schemaValid !== false,
    cache_hit: cacheHit || false,
    error_message: errorMessage || null,
    // A chat turn's request (agentRecord.js), so its cost is the sum of its rows.
    ...(agentRequestId ? { agent_request_id: agentRequestId } : {}),
  };
  try {
    let { error } = await supabaseAdmin.from('AIRequestLog').insert(row);
    if (error && row.agent_request_id) {
      // A database without the column (migration assistant_agent_tables) still gets the row.
      delete row.agent_request_id;
      ({ error } = await supabaseAdmin.from('AIRequestLog').insert(row));
    }
    if (error) throw new Error(error.message);
  } catch (err) {
    logger.error('Failed to log AI request', { error: err.message });
  }
}

// ─── Conversation State ─────────────────────────────────────────────────────

async function getOrCreateConversation(userId, conversationId) {
  if (conversationId) {
    const { data } = await supabaseAdmin
      .from('AIConversation')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) return data;
  }

  // Create new conversation
  const { data, error } = await supabaseAdmin
    .from('AIConversation')
    .insert({ user_id: userId, title: 'New conversation' })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create AI conversation', { userId, error: error.message });
    throw new Error('Failed to create conversation');
  }
  return data;
}

/**
 * Save a finished turn. `messages` is the compact transcript the next turn is
 * sent (omit it to leave the stored one alone).
 */
async function updateConversation(conversationId, { messages, messageCount, title }) {
  const update = {
    message_count: messageCount,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (title) update.title = title;
  if (messages) update.messages = messages;

  const save = (fields) => supabaseAdmin.from('AIConversation').update(fields).eq('id', conversationId);

  let { error } = await save(update);
  if (error && update.messages) {
    // Whatever the cause, keep the counters moving and let the assistant answer
    // without memory of this turn. The usual cause is a database where the
    // `messages` column (migration ai_conversation_messages) isn't applied yet.
    const missingColumn = ['PGRST204', '42703'].includes(error.code)
      || (/column/i.test(error.message || '') && /messages/i.test(error.message || ''));
    logger.warn(
      missingColumn
        ? 'AIConversation.messages is missing; is the migration applied?'
        : 'AIConversation.messages could not be saved',
      { conversationId, code: error.code, error: error.message },
    );
    delete update.messages;
    ({ error } = await save(update));
  }
  if (error) {
    logger.warn('Failed to update AI conversation', { conversationId, error: error.message });
  }
}

/**
 * A turn saves the whole transcript it read when it started. A nudge Pantopus sent
 * meanwhile (nudges/engine.js) was saved to the conversation after that read, so it
 * is kept, after the turn's own messages.
 */
async function withNudgesSentMeanwhile(conversation, saved) {
  try {
    const { data, error } = await supabaseAdmin.from('AIConversation').select('messages').eq('id', conversation.id).maybeSingle();
    if (error || !data) return saved;
    // Required here: the engine loads the notification and push services, which a chat turn otherwise doesn't need.
    const { nudgesSentDuring } = require('./nudges/engine');
    const added = nudgesSentDuring(conversation.messages, data.messages);
    return added.length ? compactForStorage([...saved, ...added]) : saved;
  } catch (err) {
    logger.warn('Nudges sent during the turn could not be checked', { conversationId: conversation.id, error: err.message });
    return saved;
  }
}

// ─── 1. Streaming Chat Agent ────────────────────────────────────────────────

// A PDF's upload reference keeps its file's extension (routes/upload.js), so the chat can
// tell a document from a photo before reading it.
const isPdfReference = (source) => typeof source === 'string' && /\.pdf$/i.test(source);

/**
 * The person's message as Claude's content: photos and documents first, then the
 * text, then the app's lines (when it was sent, which the model can't know, the
 * screen it was sent from, and the coarse location the client reports).
 */
function buildUserContent({ message, photos, unreadable, timeZone, askedFrom, coarseLocation, contextText }) {
  let text = message;
  if (unreadable) {
    const noun = photos.some((block) => block.type === 'document') ? 'files' : 'photos';
    text += `\n\n[${unreadable} of the ${photos.length + unreadable} ${noun} couldn't be opened, so they aren't included.]`;
  }
  text += `\n\n[Sent: ${describeNow(timeZone)}]`;
  if (coarseLocation) {
    text += `\n[User location context: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
  }
  // Every message from a screen ends saying so, also when that screen's context isn't sent again.
  if (askedFrom) text += `\n[Asked from: ${askedFrom}]`;
  // A model without system messages gets Pantopus's context at the top of the message instead.
  if (contextText) text = `${contextText}\n\n${text}`;
  return photos.length ? [...photos, { type: 'text', text }] : text;
}

/**
 * Stream a chat response to an SSE writer.
 *
 * Events: conversation, status (a tool started; older apps ignore it), text_delta,
 * draft, then done or error.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.conversationId]
 * @param {string} params.message
 * @param {object} [params.coarseLocation]
 * @param {string[]} [params.images] — Photos and PDFs to include: the person's uploads (ai-photo: references) or image URLs
 * @param {AbortSignal} [params.signal] — Aborts when the client disconnects, which stops the model call
 * @param {object} sseWriter — { write(event, data), end() }
 */
async function streamChat({
  userId, conversationId, message, coarseLocation, images, cards, context: screen, sessionScope, user, signal,
}, sseWriter) {
  const startTime = Date.now();

  const client = getAnthropicClient();
  if (!client) {
    sseWriter.write('error', { error: 'AI_UNAVAILABLE', message: 'AI features are not configured.' });
    sseWriter.end();
    return;
  }

  // The off switch and the daily budgets, which hold across servers.
  const blocked = await checkChatBudget(userId);
  if (blocked) {
    sseWriter.write('error', blocked);
    sseWriter.end();
    await logRequest({
      userId, conversationId: conversationId || null, endpoint: 'chat_blocked', model: CHAT_MODEL,
      promptVersion: prompts.VERSIONS.chat, status: 'blocked', latencyMs: Date.now() - startTime, errorMessage: blocked.error,
    });
    return;
  }

  // What this app can show and what this person has.
  const shown = new Set(Array.isArray(cards) ? cards : []);
  const viewer = { id: userId, role: user?.role || null };
  const plansRead = isFeatureEnabled('plans', viewer).catch(() => false);
  const sportsRead = isFeatureEnabled('plans_sports', viewer).catch(() => false);
  // The tools list playdates only for people with the flag; planViewer reads it again for the plan rules.
  const playdatesRead = isFeatureEnabled('plans_playdates', viewer).catch(() => false);

  // Pantopus's context, the screen they asked from and the photos are read while the conversation loads.
  const contextRead = buildChatContext(userId).catch((err) => {
    logger.warn('Chat context failed', { userId, error: err.message });
    return { text: null, timeZone: undefined };
  });
  const screenRead = Promise.all([contextRead, plansRead]).then(([home, plans]) => (screen
    ? screenContextText(screen, { userId, user: viewer, timeZone: home.timeZone, plansEnabled: plans })
    : null));
  const photosRead = images?.length ? photoBlocks(images, userId) : Promise.resolve([]);
  // What they asked Pantopus to remember that goes with this message (phase 3 §5.3), for every build.
  const memoryRead = contextRead.then((home) => memory.turnContext(userId, {
    screen, message, recall: shown.has('memory'), timeZone: home.timeZone,
  })).catch((err) => {
    logger.warn('Memory context failed', { userId, error: err.message });
    return null;
  });

  let conversation;
  try {
    conversation = await getOrCreateConversation(userId, conversationId);
  } catch {
    sseWriter.write('error', { error: 'CONVERSATION_ERROR', message: 'Could not load conversation.' });
    sseWriter.end();
    return;
  }

  // The turn's request and steps (phase 3 contract §4.1): its cards' done states hang off it.
  // Writing it never holds the turn up, and a failed write only leaves it unrecorded.
  const record = agentRecord.chatTurn({ userId, conversationId: conversation.id });
  const closeRecord = (status, error = null) => record.close({ status, error, homeId: screen?.home_id || null });

  const logChat = async (fields) => logRequest({
    userId,
    conversationId: conversation.id,
    endpoint: 'chat',
    model: CHAT_MODEL,
    promptVersion: prompts.VERSIONS.chat,
    latencyMs: Date.now() - startTime,
    agentRequestId: await record.ready(),
    ...fields,
  });

  const [homeContext, photoResults, plansEnabled, playdatesEnabled, screenText, memoryText, sportsEnabled] = await Promise.all([
    contextRead, photosRead, plansRead, playdatesRead, screenRead, memoryRead, sportsRead,
  ]);
  const photos = photoResults.filter(Boolean);
  // One context message: the home facts (remembered for a minute), whether they have
  // Plans, and the screen they asked from. Added again only when it changes.
  const plansLine = `- Plans: ${plansEnabled ? 'they have Plans (the Plans tab).' : "not available to them yet; don't offer plans."}`;
  const sportsPrefs = plansEnabled && sportsEnabled
    ? (await require('../feedService').getMuteAndHideFilters(userId).catch(() => ({ sports: { watch: 'off' } }))).sports : null;
  const sportsLine = sportsPrefs ? `- Sports suggestions: ${sportsPrefs.watch === 'off'
    ? 'off. Answer direct game questions, but never volunteer games or watch parties.'
    : 'available. Use find_games for listed times; never guess a fixture.'}` : null;
  const context = {
    timeZone: homeContext.timeZone,
    text: homeContext.text || screenText || memoryText || sportsLine
      ? [homeContext.text || `${CONTEXT_HEADER}:`, plansLine, sportsLine, screenText, memoryText].filter(Boolean).join('\n')
      : null,
  };
  const toolContext = {
    userId, user: viewer, sessionScope: sessionScope || null, timeZone: context.timeZone || undefined, plansEnabled,
    // Apps with action cards have the Suggestions switch (phase 2); older builds aren't told about it.
    suggestions: shown.has('action'),
    // Apps that show link buttons (show_link); a read tool asks for them only there.
    links: shown.has('link'),
    // Apps with the memory list (phase 3) can open it from a link.
    memory: shown.has('memory'),
    // Apps with the rules list (phase 3, standing rules) can open it from a link.
    rules: shown.has('rules'),
  };
  if (images?.length && photos.length === 0) {
    // Answering without the photo or PDF would only confuse: say it couldn't be opened.
    sseWriter.write('error', {
      error: 'AI_ERROR',
      message: images.some(isPdfReference)
        ? "I couldn't open that file. Try a PDF that isn't password-protected, or a photo of the page."
        : "I couldn't open that photo. Try a JPEG or PNG, or a different photo.",
    });
    sseWriter.end();
    await Promise.all([logChat({ status: 'error', errorMessage: 'unreadable_photos' }), closeRecord('couldnt', 'unreadable_photos')]);
    return;
  }

  // Pantopus's context follows the person's message, as a system message (operator
  // authority, appended so the cached history stays put), and only when it changed.
  const systemMessages = supportsSystemMessages(CHAT_MODEL);
  const history = sanitizeHistory(conversation.messages).filter((m) => systemMessages || m.role !== 'system');
  const newContext = context.text && context.text !== lastContextText(history) ? context.text : null;
  // When they sent it, kept with the transcript for the apps' history (never sent to the model).
  const sentAt = new Date(startTime).toISOString();
  const messages = [
    ...history,
    {
      role: 'user',
      content: buildUserContent({
        message,
        photos,
        unreadable: (images?.length || 0) - photos.length,
        timeZone: context.timeZone,
        askedFrom: screenText ? screenName(screen) : null,
        coarseLocation,
        contextText: systemMessages ? null : newContext,
      }),
      at: sentAt,
    },
    ...(systemMessages && newContext ? [{ role: 'system', content: newContext, at: sentAt }] : []),
  ];

  // The tools this deployment offers, and the cards this app can show; a call to any
  // other name is answered as unknown.
  const capabilities = {
    pickupSchedule: shown.has('pickup_schedule'),
    actionCards: shown.has('action'),
    links: shown.has('link'),
    plans: plansEnabled,
    sports: plansEnabled && sportsEnabled,
    playdates: plansEnabled && playdatesEnabled,
    remembers: shown.has('memory'),
    checksBack: shown.has('follow_up'),
    standingRules: shown.has('rules'),
  };
  const tools = launchScopedChatTools(capabilities);
  const toolNames = tools.map((tool) => tool.name);
  const ran = new Map();

  // The whole turn, tool calls included, shares one deadline.
  const deadline = AbortSignal.timeout(AGENT_TIMEOUT_MS);
  const turnSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;

  // Filled in as rounds finish, so a timeout can still log what was used.
  const usage = emptyUsage();
  const replyText = plainTextStream((delta) => sseWriter.write('text_delta', { delta }));
  let firstTextMs = null;
  // Link buttons (show_link) go out after the reply's text, just before `done`.
  const links = [];
  let turn;
  try {
    // Send conversation ID immediately
    sseWriter.write('conversation', {
      conversationId: conversation.id,
      isNew: !conversationId,
    });

    turn = await runAgentTurn({
      client,
      model: CHAT_MODEL,
      effort: CHAT_EFFORT,
      maxTokens: CHAT_MAX_TOKENS,
      maxRounds: MAX_TOOL_ROUNDS,
      // The tools and this prompt are the same for everyone, so one cache entry serves every
      // conversation; an hour keeps it warm between the pilot's sparse messages.
      system: systemBlocks(launchScopedChatInstructions(capabilities), { ttl: '1h' }),
      tools,
      messages,
      signal: turnSignal,
      usage,
      onText: (delta) => {
        if (firstTextMs === null) firstTextMs = Date.now() - startTime;
        replyText.push(delta);
      },
      onToolStart: (name) => sseWriter.write('status', { tool: name, message: TOOL_STATUS[name] || 'Working on it…' }),
      // Run one tool Claude asked for; a draft goes to the client as soon as it exists.
      runTool: async (use) => {
        const name = toolNames.find((known) => known === use.name)
          || toolNames.find((known) => known.toLowerCase() === String(use.name).toLowerCase());
        const toolStarted = Date.now();
        const result = name
          ? await executeTool(name, use.input || {}, toolContext)
          : { error: `Unknown tool: ${use.name}. The tools are: ${toolNames.join(', ')}.` };
        ran.set(use.id, { name, result });
        record.tool(name || use.name, {
          label: TOOL_STATUS[name] || 'Working on it…', result, latencyMs: Date.now() - toolStarted, known: Boolean(name),
        });
        if (result.draftType === 'action') record.card(result.draft);
        if (result.link) {
          links.push(result.link);
          // On Claude Sonnet 5.5, text written just before a tool call can come back as a
          // hidden progress note, so the model is told what the person has actually seen.
          result.next = firstTextMs === null
            ? "They see only the button so far. Write your whole answer now; it shows above the button. Don't mention the button."
            : "The button shows under your reply. Finish your reply if anything is missing, without repeating what you wrote or mentioning the button.";
        }
        if (result.draftType) {
          sseWriter.write('draft', {
            type: result.draftType,
            draft: result.draft || result.summary,
            valid: result.valid,
          });
        }
        return {
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
          ...(result.error ? { is_error: true } : {}),
        };
      },
      // Drafts that came out valid are the answer: the turn ends at their cards. So does a
      // reply that showed its answer and then its link buttons: another round would only
      // describe the button or say the answer again.
      finishAfterTools: (uses, { said }) => {
        const calls = uses.map((use) => ran.get(use.id));
        const linked = calls.length > 0 && calls.every((call) => call?.name === 'show_link' && call.result.link);
        if (linked) return said && !said.endsWith(':') ? true : null;
        return closingForDrafts(calls);
      },
    });
  } catch (err) {
    const tokens = { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };

    if (signal?.aborted) {
      // The client left. Nobody is reading, and the abort already stopped the model call.
      logger.debug('AI chat SSE client disconnected', { userId });
      sseWriter.end();
      await Promise.all([logChat({ status: 'cancelled', ...tokens }), closeRecord('couldnt', 'cancelled')]);
      return;
    }

    if (deadline.aborted) {
      // Timed out — close the stream without a done event, log as timeout, skip conversation update.
      logger.warn('Chat agent timeout', { userId, elapsed: Date.now() - startTime });
      sseWriter.write('error', { error: 'TIMEOUT', message: 'Response took too long. Please try again.' });
      sseWriter.end();
      await Promise.all([logChat({ status: 'timeout', ...tokens }), closeRecord('couldnt', 'timeout')]);
      return;
    }

    logger.error('streamChat error', { userId, error: err.message, stack: err.stack });
    let message = 'Something went wrong with the AI. Please try again.';
    if (images?.some(isPdfReference) && isDocumentError(err)) message = "I couldn't read that PDF. Try one that isn't password-protected, or a photo of the page.";
    else if (isImageError(err)) message = "I couldn't read that photo. Please try a different one.";
    sseWriter.write('error', { error: 'AI_ERROR', message });
    sseWriter.end();
    await Promise.all([logChat({ status: 'error', errorMessage: err.message, ...tokens }), closeRecord('couldnt', 'error')]);
    return;
  }

  const logged = {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    toolCallsCount: turn.toolCalls,
    cacheHit: usage.cacheReadTokens > 0,
  };
  // Time to the first words (or to the draft's closing line) is the latency people feel.
  logger.info('AI chat turn', {
    userId,
    outcome: turn.outcome,
    firstTextMs,
    totalMs: Date.now() - startTime,
    toolCalls: turn.toolCalls,
    cacheReadTokens: usage.cacheReadTokens,
    contextAdded: Boolean(newContext),
  });

  if (turn.outcome === 'refused' || turn.outcome === 'truncated' || turn.outcome === 'empty') {
    // Claude declined, ran out of room mid tool call, or wrote nothing a person can
    // read. Nothing is saved, so the exchange doesn't sit in the conversation and
    // colour the turns after it.
    const reason = {
      refused: `refusal${turn.category ? `:${turn.category}` : ''}`,
      truncated: 'max_tokens',
      empty: `empty_reply${turn.stopReason ? `:${turn.stopReason}` : ''}`,
    }[turn.outcome];
    logger.warn('Chat turn not completed', { userId, reason });
    sseWriter.write('error', {
      error: 'AI_ERROR',
      message: turn.outcome === 'refused'
        ? "I can't help with that one. Try rephrasing, or ask about something else."
        : 'Something went wrong with the AI. Please try again.',
    });
    sseWriter.end();
    await Promise.all([
      logChat({ status: turn.outcome === 'refused' ? 'refusal' : 'error', errorMessage: reason, ...logged }),
      closeRecord('couldnt', reason.split(':')[0]),
    ]);
    return;
  }

  // Update conversation state
  const newMessageCount = (conversation.message_count || 0) + 2; // user + assistant
  // Auto-title on first message
  const title = conversation.message_count === 0
    ? message.slice(0, 60) + (message.length > 60 ? '…' : '')
    : undefined;

  // A turn that ran out of tool rounds has no answer to remember. The reply is dated when it
  // finished, as the apps date it while it streams; the messages before it keep their times.
  const answeredAt = new Date().toISOString();
  const saved = turn.outcome === 'complete'
    ? compactForStorage(turn.messages.map((m, i) => (i < messages.length ? m : { ...m, at: answeredAt })))
    : undefined;
  await updateConversation(conversation.id, {
    messages: saved && await withNudgesSentMeanwhile(conversation, saved),
    messageCount: newMessageCount,
    title,
  });

  // Send done event
  replyText.flush();
  for (const link of links) sseWriter.write('link', link);
  sseWriter.write('done', {
    conversationId: conversation.id,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    toolCalls: turn.toolCalls,
  });
  sseWriter.end();

  // Log. A reply that stopped at its token ceiling was delivered, but cut short: say so.
  await Promise.all([
    logChat({
      status: 'ok',
      ...(turn.stopReason === 'max_tokens' ? { errorMessage: 'max_tokens' } : {}),
      ...logged,
    }),
    turn.outcome === 'complete' ? closeRecord('done') : closeRecord('couldnt', turn.outcome),
  ]);
}

// ─── 2. Single-turn Gig Draft ───────────────────────────────────────────────

async function draftGig({ text, coarseLocation, context, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  let userContent = text;
  if (coarseLocation) {
    userContent += `\n\n[Location: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
  }
  // "Saturday morning" needs today's date to become a schedule.
  userContent += `\n${todayLine(await userTimeZone(userId))}`;
  if (context) {
    if (context.budgetHint) userContent += `\n[Budget hint: ${context.budgetHint}]`;
    if (context.timeHint) userContent += `\n[Time hint: ${context.timeHint}]`;
    if (context.category) userContent += `\n[Category: ${context.category}]`;
  }

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.GIG_DRAFT_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      schema: schemas.claudeSchemas.gigDraft,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });

    const outputText = response.text;
    let draft;
    try {
      draft = JSON.parse(outputText);
    } catch {
      await logRequest({
        userId, endpoint: 'draft/gig', model: DRAFT_MODEL,
        promptVersion: prompts.VERSIONS.gig, status: 'schema_error',
        latencyMs: Date.now() - startTime, schemaValid: false,
        errorMessage: 'JSON parse failed',
      });
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    const valid = schemas.validateGigDraft(draft);

    await logRequest({
      userId, endpoint: 'draft/gig', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.gig, status: valid ? 'ok' : 'schema_error',
      latencyMs: Date.now() - startTime, schemaValid: valid,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    if (!valid) {
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    return { draft, clarifying_questions: draft.clarifying_questions || [] };
  } catch (err) {
    logger.error('draftGig error', { userId, error: err.message });
    await logRequest({
      userId, endpoint: 'draft/gig', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.gig, status: err instanceof AIRefusalError ? 'refusal' : 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (err instanceof AIRefusalError) return { ...DECLINED };
    if (isTimeoutError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── 3. Single-turn Listing Draft ───────────────────────────────────────────

async function draftListing({ text, coarseLocation, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  let userContent = text;
  if (coarseLocation) {
    userContent += `\n\n[Location: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
  }

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.LISTING_DRAFT_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      schema: schemas.claudeSchemas.listingDraft,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });

    const outputText = response.text;
    let draft;
    try {
      draft = JSON.parse(outputText);
    } catch {
      await logRequest({
        userId, endpoint: 'draft/listing', model: DRAFT_MODEL,
        promptVersion: prompts.VERSIONS.listing, status: 'schema_error',
        latencyMs: Date.now() - startTime, schemaValid: false,
        errorMessage: 'JSON parse failed',
      });
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    const valid = schemas.validateListingDraft(draft);

    await logRequest({
      userId, endpoint: 'draft/listing', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.listing, status: valid ? 'ok' : 'schema_error',
      latencyMs: Date.now() - startTime, schemaValid: valid,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    if (!valid) {
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    return { draft, clarifying_questions: draft.clarifying_questions || [] };
  } catch (err) {
    logger.error('draftListing error', { userId, error: err.message });
    await logRequest({
      userId, endpoint: 'draft/listing', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.listing, status: err instanceof AIRefusalError ? 'refusal' : 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (err instanceof AIRefusalError) return { ...DECLINED };
    if (isTimeoutError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── 3b. Single-turn Listing Draft from Images (Snap & Sell) ────────────────

async function draftListingFromImages({ images, text, latitude, longitude, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  const s3Service = require('../s3Service');

  // Build content array with images + optional text. Claude reads JPEG, PNG,
  // GIF and WebP; a photo in another format (HEIC) is left out.
  const contentParts = images
    .map((img) => imageBlock(img.startsWith('http') || img.startsWith('data:') ? img : s3Service.getPublicUrl(img)))
    .filter(Boolean);
  if (contentParts.length === 0) {
    return { error: 'DRAFT_INVALID', message: 'Could not read those photos. Please try different ones or create manually.', fallback: true };
  }

  let userPrompt = 'Describe this item for a marketplace listing.';
  if (text) {
    userPrompt = `${text}\n\nDescribe this item for a marketplace listing.`;
  }
  contentParts.push({ type: 'text', text: userPrompt });

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.LISTING_DRAFT_SYSTEM,
      messages: [{ role: 'user', content: contentParts }],
      schema: schemas.claudeSchemas.listingDraft,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });

    const outputText = response.text;
    let draft;
    try {
      draft = JSON.parse(outputText);
    } catch {
      await logRequest({
        userId, endpoint: 'draft/listing-vision', model: DRAFT_MODEL,
        promptVersion: prompts.VERSIONS.listing, status: 'schema_error',
        latencyMs: Date.now() - startTime, schemaValid: false,
        errorMessage: 'JSON parse failed',
      });
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    const valid = schemas.validateListingDraft(draft);

    await logRequest({
      userId, endpoint: 'draft/listing-vision', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.listing, status: valid ? 'ok' : 'schema_error',
      latencyMs: Date.now() - startTime, schemaValid: valid,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    if (!valid) {
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    // Non-blocking price suggestion if category is available
    let priceSuggestion = null;
    if (draft.category) {
      try {
        const priceIntelligenceService = require('../marketplace/priceIntelligenceService');
        priceSuggestion = await priceIntelligenceService.getPriceSuggestion({
          category: draft.category,
          latitude,
          longitude,
          title: draft.title,
          condition: draft.condition,
        });
      } catch (err) {
        logger.warn('Price suggestion failed for vision draft', { userId, error: err.message });
      }
    }

    const result = { draft, confidence: 0.85 };
    if (priceSuggestion) result.priceSuggestion = priceSuggestion;
    return result;
  } catch (err) {
    logger.error('draftListingFromImages error', { userId, error: err.message });
    await logRequest({
      userId, endpoint: 'draft/listing-vision', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.listing, status: err instanceof AIRefusalError ? 'refusal' : 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (err instanceof AIRefusalError) return { ...DECLINED };
    if (isTimeoutError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    if (isImageError(err)) {
      return { error: 'DRAFT_INVALID', message: 'Could not read those photos. Please try different ones or create manually.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── 3. Single-turn Post Draft ──────────────────────────────────────────────

async function draftPost({ text, surface, coarseLocation, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  let userContent = text;
  if (surface) userContent += `\n\n[Posting to: ${surface} feed]`;
  if (coarseLocation) {
    userContent += `\n[Location: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
  }
  // An event "this Saturday" gets its real date only if the model knows today's.
  userContent += `\n${todayLine(await userTimeZone(userId))}`;

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      // The nearby feed refuses some types other audiences take: draft only what it accepts.
      system: surface === 'place' ? prompts.POST_DRAFT_PLACE_SYSTEM : prompts.POST_DRAFT_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      schema: surface === 'place' ? schemas.claudeSchemas.postDraftPlace : schemas.claudeSchemas.postDraft,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });

    const outputText = response.text;
    let draft;
    try {
      draft = JSON.parse(outputText);
    } catch {
      await logRequest({
        userId, endpoint: 'draft/post', model: DRAFT_MODEL,
        promptVersion: prompts.VERSIONS.post, status: 'schema_error',
        latencyMs: Date.now() - startTime, schemaValid: false,
        errorMessage: 'JSON parse failed',
      });
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    const valid = schemas.validatePostDraft(draft);

    await logRequest({
      userId, endpoint: 'draft/post', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.post, status: valid ? 'ok' : 'schema_error',
      latencyMs: Date.now() - startTime, schemaValid: valid,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    if (!valid) {
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    return { draft, clarifying_questions: draft.clarifying_questions || [] };
  } catch (err) {
    logger.error('draftPost error', { userId, error: err.message });
    await logRequest({
      userId, endpoint: 'draft/post', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.post, status: err instanceof AIRefusalError ? 'refusal' : 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (err instanceof AIRefusalError) return { ...DECLINED };
    if (isTimeoutError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

/** A note from the model for people to read: trimmed, without a stray closing bracket ("…in the photo.}"). */
function noteText(note) {
  const text = typeof note === 'string' ? note.trim() : '';
  return (/[{[]/.test(text) ? text : text.replace(/[}\]\s]+$/, '')) || null;
}

// ─── Post Suggestion (the composer's AI assist) ─────────────────────────────

/**
 * The whole post, suggested from the person's photos, the place they picked and what
 * they've written so far, for the composer to fill in (services/ai/postSuggestion.js).
 * The photos are read in memory and never stored, and nothing is posted: the person
 * checks the fields, changes what they like and posts with the composer's own Post.
 */
async function suggestPost({ files = [], fields, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. You can still write the post yourself.', fallback: true };
  }

  const { blocks, unreadable } = await postSuggestion.photoBlocks(files);
  if (!blocks.length && !postSuggestion.hasWords(fields)) {
    return { error: 'IMAGE_UNREADABLE', message: "Couldn't open that photo. Try a JPEG or PNG, or write a few words." };
  }
  const timeZone = await userTimeZone(userId);
  const content = [
    ...blocks,
    { type: 'text', text: postSuggestion.requestText({ ...fields, photoCount: blocks.length, now: describeNow(timeZone) }) },
  ];
  const log = (logFields) => logRequest({
    userId, endpoint: 'draft/post-suggestion', model: DRAFT_MODEL,
    promptVersion: prompts.VERSIONS.postSuggestion, latencyMs: Date.now() - startTime, ...logFields,
  });

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.POST_SUGGESTION_SYSTEM,
      messages: [{ role: 'user', content }],
      schema: schemas.claudeSchemas.postSuggestion,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: SUGGESTION_TIMEOUT_MS,
    });
    let reading = null;
    try {
      reading = JSON.parse(response.text);
    } catch {
      // Treated as invalid below.
    }
    const suggestion = reading && typeof reading === 'object' && typeof reading.body === 'string'
      ? postSuggestion.composerFields(reading, { postType: fields.postType, timeZone })
      : null;
    const valid = Boolean(suggestion) && schemas.validatePostSuggestion(suggestion);
    await log({
      status: valid ? 'ok' : 'schema_error', schemaValid: valid,
      inputTokens: response.inputTokens, outputTokens: response.outputTokens,
    });
    if (!valid) {
      return { error: 'DRAFT_INVALID', message: "Couldn't write a suggestion. Try again, or write the post yourself.", fallback: true };
    }
    const note = postSuggestion.noteFor(noteText(reading.note), unreadable);
    if (!suggestion.body) {
      return {
        error: 'NO_SUGGESTION',
        message: note || "There wasn't enough to write a post from. Try another photo or add a few words.",
        fallback: true,
      };
    }
    return { suggestion, note };
  } catch (err) {
    logger.error('suggestPost error', { userId, error: err.message });
    await log({ status: err instanceof AIRefusalError ? 'refusal' : 'error', errorMessage: err.message });
    if (err instanceof AIRefusalError) return { ...DECLINED };
    if (isImageError(err)) return { error: 'IMAGE_UNREADABLE', message: "Couldn't read that photo. Try a different one." };
    if (isTimeoutError(err)) return { error: 'AI_TIMEOUT', message: 'Writing the suggestion took too long. Please try again.', fallback: true };
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. You can still write the post yourself.', fallback: true };
  }
}

// ─── Pickup Days from a Flyer (for the pickup editor) ────────────────────────

/**
 * Read a household's pickup days from photos of their hauler's flyer, or from what they
 * wrote, for the pickup editor to fill in. Nothing is saved here: the person checks the
 * editor's fields and saves them with its own Save.
 */
async function readPickupSchedule({ images = [], text, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please set your pickup days yourself.', fallback: true };
  }

  const photos = images.length ? (await photoBlocks(images, userId)).filter(Boolean) : [];
  if (images.length && !photos.length) {
    return { error: 'IMAGE_UNREADABLE', message: "I couldn't open that photo. Try a JPEG or PNG, or a different photo." };
  }
  const ask = (text || 'Read the pickup schedule from this flyer.').trim();
  const content = [...photos, { type: 'text', text: `${ask}\n\n${todayLine(await userTimeZone(userId))}` }];
  const log = (fields) => logRequest({
    userId, endpoint: 'draft/pickup-schedule', model: DRAFT_MODEL,
    promptVersion: prompts.VERSIONS.pickupSchedule, latencyMs: Date.now() - startTime, ...fields,
  });

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.PICKUP_SCHEDULE_SYSTEM,
      messages: [{ role: 'user', content }],
      schema: schemas.claudeSchemas.pickupSchedule,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });
    let reading = null;
    try {
      reading = JSON.parse(response.text);
    } catch {
      // Treated as invalid below.
    }
    const valid = Boolean(reading) && schemas.validatePickupSchedule(reading);
    await log({
      status: valid ? 'ok' : 'schema_error', schemaValid: valid,
      inputTokens: response.inputTokens, outputTokens: response.outputTokens,
    });
    if (!valid) {
      return { error: 'DRAFT_INVALID', message: "Couldn't read a pickup schedule. Try again, or set your pickup days yourself.", fallback: true };
    }
    const fields = editorFields(reading);
    const note = noteText(reading.note);
    if (!fields.garbage_weekday && !fields.recycling_frequency) {
      return { error: 'NO_SCHEDULE', message: note || "That doesn't look like a pickup schedule.", fallback: true };
    }
    return { schedule: fields, note };
  } catch (err) {
    logger.error('readPickupSchedule error', { userId, error: err.message });
    await log({ status: err instanceof AIRefusalError ? 'refusal' : 'error', errorMessage: err.message });
    if (err instanceof AIRefusalError) return { ...DECLINED };
    if (isImageError(err)) return { error: 'IMAGE_UNREADABLE', message: "I couldn't read that photo. Try a clearer one." };
    if (isTimeoutError(err)) return { error: 'AI_TIMEOUT', message: 'Reading the flyer took too long. Please try again.', fallback: true };
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please set your pickup days yourself.', fallback: true };
  }
}

// ─── Radon Result from a Lab Report (for the Today radon sheet) ──────────────

/**
 * Read a home's radon result from a photo or PDF of the lab's report, for the
 * Today radon sheet to fill in. Nothing is saved here and the file isn't kept:
 * the person checks the result and test date and saves with the sheet's Save.
 */
async function readRadonReport({ file, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please type your result yourself.', fallback: true };
  }

  const report = await radonReport.reportBlock(file);
  if (!report) {
    return { error: 'FILE_UNREADABLE', message: "I couldn't open that file. Try a photo (JPEG or PNG) or a PDF of the report." };
  }
  const timeZone = await userTimeZone(userId);
  const content = [report, { type: 'text', text: `Read the radon test result from this report.\n\n${todayLine(timeZone)}` }];
  const log = (fields) => logRequest({
    userId, endpoint: 'draft/radon-result', model: DRAFT_MODEL,
    promptVersion: prompts.VERSIONS.radonResult, latencyMs: Date.now() - startTime, ...fields,
  });

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.RADON_RESULT_SYSTEM,
      messages: [{ role: 'user', content }],
      schema: schemas.claudeSchemas.radonResult,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });
    let reading = null;
    try {
      reading = JSON.parse(response.text);
    } catch {
      // Treated as invalid below.
    }
    const valid = Boolean(reading) && schemas.validateRadonResult(reading);
    await log({
      status: valid ? 'ok' : 'schema_error', schemaValid: valid,
      inputTokens: response.inputTokens, outputTokens: response.outputTokens,
    });
    if (!valid) {
      return { error: 'DRAFT_INVALID', message: "Couldn't read a radon result. Try again, or type your result yourself.", fallback: true };
    }
    const fields = radonReport.sheetFields(reading, radonReport.todayIn(timeZone));
    const note = noteText(reading.note);
    if (fields.value_pci === null) {
      return { error: 'NO_RESULT', message: note || "That doesn't look like a radon test result.", fallback: true };
    }
    return { result: fields, note };
  } catch (err) {
    logger.error('readRadonReport error', { userId, error: err.message });
    await log({ status: err instanceof AIRefusalError ? 'refusal' : 'error', errorMessage: err.message });
    if (err instanceof AIRefusalError) return { ...DECLINED };
    if (isImageError(err) || isDocumentError(err)) {
      return { error: 'FILE_UNREADABLE', message: "I couldn't read that file. Try a clearer photo, or a PDF that isn't password-protected." };
    }
    if (isTimeoutError(err)) return { error: 'AI_TIMEOUT', message: 'Reading the report took too long. Please try again.', fallback: true };
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please type your result yourself.', fallback: true };
  }
}

// ─── 4. Mail Summarization ──────────────────────────────────────────────────

async function summarizeMail({ mailItemId, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  // Fetch only mail the caller is authorized to view, a person who sent it named as neighbors see them.
  const item = await nameMailSender(await getAuthorizedMail({
    mailItemId,
    userId,
    select: 'subject, content, preview_text, sender_display, sender_user_id, sender_entity_id, sender_business_name, category, type, urgency, due_date, key_facts',
  }), userId);

  if (!item) {
    return { error: 'MAIL_NOT_FOUND', message: 'Mail item not found.' };
  }

  // "Overdue" and "due soon" are judged against today's date, which the model can't know.
  const mailContent = `${todayLine(await userTimeZone(userId))}
Subject: ${item.subject || 'N/A'}
From: ${item.sender_display || 'Unknown'}
Category: ${item.category || 'N/A'}
Type: ${item.type || 'N/A'}
Urgency: ${item.urgency || 'none'}
Due Date: ${item.due_date || 'N/A'}
Content: ${item.content || item.preview_text || 'No content available'}
Existing Key Facts: ${JSON.stringify(item.key_facts || [])}`;

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.MAIL_SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: mailContent }],
      schema: schemas.claudeSchemas.mailSummary,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });

    const outputText = response.text;
    let summary;
    try {
      summary = JSON.parse(outputText);
    } catch {
      await logRequest({
        userId, endpoint: 'summarize/mail', model: DRAFT_MODEL,
        promptVersion: prompts.VERSIONS.mail, status: 'schema_error',
        latencyMs: Date.now() - startTime, schemaValid: false,
      });
      return { error: 'SUMMARY_INVALID', fallback: true };
    }

    const valid = schemas.validateMailSummary(summary);

    await logRequest({
      userId, endpoint: 'summarize/mail', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.mail, status: valid ? 'ok' : 'schema_error',
      latencyMs: Date.now() - startTime, schemaValid: valid,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    return valid ? summary : { error: 'SUMMARY_INVALID', fallback: true };
  } catch (err) {
    logger.error('summarizeMail error', { userId, mailItemId, error: err.message });
    await logRequest({
      userId, endpoint: 'summarize/mail', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.mail, status: err instanceof AIRefusalError ? 'refusal' : 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (err instanceof AIRefusalError) return { error: 'AI_DECLINED', fallback: true };
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }
}

// ─── 5. Place Brief ─────────────────────────────────────────────────────────

async function generatePlaceBrief({ placeId, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { error: 'AI_UNAVAILABLE' };
  }

  // 1) Try SavedPlace first
  let place = null;
  const { data: savedPlace } = await supabaseAdmin
    .from('SavedPlace')
    .select('id, label, latitude, longitude, city, state')
    .eq('id', placeId)
    .eq('user_id', userId)
    .maybeSingle();

  if (savedPlace) {
    place = savedPlace;
  } else {
    // 2) Fallback: treat placeId as Home id (hub passes homeId)
    const { data: home, error: homeErr } = await supabaseAdmin
      .from('Home')
      .select('id, name, address, city, state, map_center_lat, map_center_lng, owner_id, created_by_user_id')
      .eq('id', placeId)
      .maybeSingle();
    if (homeErr) {
      logger.warn('Place brief: Home fetch error', { placeId, userId, error: homeErr.message });
      return { error: 'PLACE_NOT_FOUND', message: 'Saved place not found.' };
    }
    if (!home) {
      return { error: 'PLACE_NOT_FOUND', message: 'Saved place not found.' };
    }
    // User must have access: legacy owner/creator, active occupancy, or verified HomeOwner
    const isLegacyOwner = home.owner_id === userId || home.created_by_user_id === userId;
    if (isLegacyOwner) {
      // allow
    } else {
      const [{ data: occRow }, { data: ownerRow }] = await Promise.all([
        supabaseAdmin
          .from('HomeOccupancy')
          .select('id')
          .eq('home_id', placeId)
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle(),
        supabaseAdmin
          .from('HomeOwner')
          .select('id')
          .eq('home_id', placeId)
          .eq('subject_id', userId)
          .eq('owner_status', 'verified')
          .maybeSingle(),
      ]);
      if (!occRow && !ownerRow) {
        logger.warn('Place brief: no access', { placeId, userId });
        return { error: 'PLACE_NOT_FOUND', message: 'Saved place not found.' };
      }
    }
    const lat = home.map_center_lat != null ? Number(home.map_center_lat) : null;
    const lng = home.map_center_lng != null ? Number(home.map_center_lng) : null;
    place = {
      id: home.id,
      label: home.name || home.address || 'Home',
      latitude: lat,
      longitude: lng,
      city: home.city || null,
      state: home.state || null,
    };
  }

  if (!place) {
    return { error: 'PLACE_NOT_FOUND', message: 'Saved place not found.' };
  }

  // Home with no coordinates: return a simple all-clear (no weather data)
  const hasCoords = place.latitude != null && place.longitude != null;
  if (!hasCoords) {
    const brief = {
      place: { label: place.label, city: place.city, state: place.state },
      summary: `No location coordinates for ${place.label}. Add address location to get weather alerts.`,
      headlines: [],
      overall_status: 'all_clear',
      sources: [],
    };
    await logRequest({
      userId, endpoint: 'place-brief', model: 'none',
      promptVersion: prompts.VERSIONS.placeBrief, status: 'ok',
      latencyMs: Date.now() - startTime,
    });
    return brief;
  }

  // Fetch external data
  const alertsResult = await noaa.fetchAlerts(place.latitude, place.longitude);
  const cacheHit = alertsResult.source === 'cache';

  // If no data at all, return an all-clear brief without calling LLM
  if (alertsResult.alerts.length === 0) {
    const brief = {
      place: { label: place.label, city: place.city, state: place.state },
      summary: `All clear near ${place.label}. No active weather alerts.`,
      headlines: [],
      overall_status: 'all_clear',
      sources: [{ provider: 'NOAA', updated_at: alertsResult.fetchedAt }],
    };

    await logRequest({
      userId, endpoint: 'place-brief', model: 'none',
      promptVersion: prompts.VERSIONS.placeBrief, status: 'ok',
      latencyMs: Date.now() - startTime, cacheHit,
    });

    return brief;
  }

  // Synthesize with LLM
  const externalDataPrompt = `Place: ${place.label} (${place.city}, ${place.state})

Weather Alerts (NOAA):
${alertsResult.alerts.map(a => `- ${a.event} (${a.severity}): ${a.headline}. ${a.instruction || ''}`).join('\n')}`;

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.PLACE_BRIEF_SYSTEM,
      messages: [{ role: 'user', content: externalDataPrompt }],
      schema: schemas.claudeSchemas.placeBrief,
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });

    const outputText = response.text;
    let briefData;
    try {
      briefData = JSON.parse(outputText);
    } catch {
      await logRequest({
        userId, endpoint: 'place-brief', model: DRAFT_MODEL,
        promptVersion: prompts.VERSIONS.placeBrief, status: 'schema_error',
        latencyMs: Date.now() - startTime, schemaValid: false, cacheHit,
      });
      return { error: 'BRIEF_INVALID' };
    }

    const brief = {
      place: { label: place.label, city: place.city, state: place.state },
      ...briefData,
      sources: [
        { provider: 'NOAA', updated_at: alertsResult.fetchedAt },
      ],
    };

    await logRequest({
      userId, endpoint: 'place-brief', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.placeBrief, status: 'ok',
      latencyMs: Date.now() - startTime, cacheHit,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    return brief;
  } catch (err) {
    logger.error('generatePlaceBrief error', { userId, placeId, error: err.message });
    await logRequest({
      userId, endpoint: 'place-brief', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.placeBrief, status: 'error',
      latencyMs: Date.now() - startTime, cacheHit, errorMessage: err.message,
    });
    return { error: 'AI_UNAVAILABLE' };
  }
}

// ─── Conversation Management ────────────────────────────────────────────────

async function listConversations(userId, { oldestFirst = false } = {}) {
  const { data, error } = await supabaseAdmin
    .from('AIConversation')
    .select('id, title, message_count, last_message_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: oldestFirst })
    .order('id', { ascending: oldestFirst })
    .limit(50);

  if (error) {
    logger.error('listConversations error', { userId, error: error.message });
    throw error;
  }
  return data || [];
}

// ─── Conversation History (what the apps show after a relaunch) ─────────────

const DRAFT_TYPES = {
  create_post_draft: 'post',
  create_gig_draft: 'gig',
  create_listing_draft: 'listing',
  draft_support_train_from_story: 'support_train',
  draft_pickup_schedule: 'pickup_schedule',
};
// Lines the app adds to a person's message, which aren't theirs to see again.
const APP_LINES = [
  /\n*\[(?:Sent|Asked from|User location context): [^\]\n]*\]/g,
  /\n*\[\d+ of the \d+ (?:photos|files) couldn't be opened[^\]\n]*\]/g,
  // The line before a nudge Pantopus sent (nudges/engine.js); it is nobody's message.
  /\n*\[Suggestion from Pantopus, sent as a notification: [^\]\n]*\]/g,
];
// The notes that stand in for a stored photo or document (agentLoop.compactForStorage).
const PHOTO_NOTE = /^\[(?:Photo attached|(\d+) photos attached)\./;
const DOCUMENT_NOTE = /^\[(?:Document attached|(\d+) documents attached)\./;
// What the apps send for photos or documents sent without words: not the person's, so the apps
// show "Sent a photo" instead.
const ONLY_ATTACHED_QUESTIONS = new Set(['What can you tell me about this image?', 'What can you tell me about this document?']);

function personText(text) {
  // A model without system messages got Pantopus's context at the top of the message.
  let shown = text.startsWith(CONTEXT_HEADER) && text.includes('\n\n') ? text.slice(text.indexOf('\n\n') + 2) : text;
  for (const line of APP_LINES) shown = shown.replace(line, '');
  return shown.trim();
}

/** What a stored tool call returned (its tool_result), parsed; null when it can't be read. */
function storedResults(messages) {
  const results = new Map();
  for (const message of messages) {
    if (message.role !== 'user' || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (block.type !== 'tool_result') continue;
      const text = typeof block.content === 'string' ? block.content : block.content?.find?.((part) => part.type === 'text')?.text;
      try {
        results.set(block.tool_use_id, JSON.parse(text));
      } catch {
        // Not a draft's result; nothing to show from it.
      }
    }
  }
  return results;
}

/**
 * The stored transcript as the apps show it: the person's messages, the replies, and the drafts as cards.
 * Action cards and link buttons go only to apps that list them in `cards` ("action", "link"), as in the
 * chat stream; an app without them sees those turns' words only, as it did before they existed.
 * Each item says when it was said (`at`): its message's time, or for a turn saved before times were
 * kept, the time of the item before it or else `startedAt`, the conversation's start.
 */
function displayMessages(stored, { cards = [], startedAt } = {}) {
  const shown = new Set(cards);
  const items = [];
  const history = sanitizeHistory(stored);
  const results = storedResults(history);
  let at = startedAt;
  // Link buttons (show_link) go on the last reply text of their turn, whichever round made them.
  let turnStart = 0;
  let turnLinks = [];
  const flushLinks = () => {
    if (!turnLinks.length) return;
    const own = items.slice(turnStart).reverse().find((item) => item.role === 'assistant' && typeof item.text === 'string');
    if (own) own.links = [...(own.links || []), ...turnLinks];
    else items.push({ role: 'assistant', text: '', links: turnLinks, at });
    turnLinks = [];
  };
  for (const message of history) {
    if (message.role === 'system') continue;
    const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content;
    if (message.role === 'user') {
      if (!blocks.some((block) => block.type !== 'tool_result')) continue;
      flushLinks();
      at = message.at || at;
      turnStart = items.length;
      let photos = 0;
      let documents = 0;
      const texts = [];
      for (const block of blocks) {
        if (block.type !== 'text') continue;
        const photo = PHOTO_NOTE.exec(block.text);
        const document = DOCUMENT_NOTE.exec(block.text);
        if (photo) photos += photo[1] ? Number(photo[1]) : 1;
        else if (document) documents += document[1] ? Number(document[1]) : 1;
        else texts.push(block.text);
      }
      const said = personText(texts.join('\n'));
      // Only app lines (a nudge's): nothing the person said.
      if (!said && !photos && !documents) continue;
      const onlyAttached = (photos || documents) && ONLY_ATTACHED_QUESTIONS.has(said);
      items.push({ role: 'user', text: onlyAttached ? '' : said, photos, ...(documents ? { documents } : {}), at });
      continue;
    }
    at = message.at || at;
    // A nudge or brief Pantopus sent: its first item carries the notification id, which the
    // notification's link (pantopus://assistant?nudge=<id>) scrolls to.
    const nudge = blocks.map((block) => block.type === 'tool_use' && results.get(block.id)?.nudge).find((value) => value?.id);
    const firstItem = items.length;
    let text = '';
    for (const block of blocks) {
      if (block.type === 'text') text += (text ? '\n\n' : '') + block.text.replace(/\*\*/g, '');
      if (block.type !== 'tool_use') continue;
      const result = results.get(block.id);
      // A link button (show_link) goes with this reply's text.
      if (block.name === 'show_link' && result?.link?.url && shown.has('link')) turnLinks.push(result.link);
      // An action card is what its tool returned: the exact request the app sends.
      if (result?.draftType === 'action' && result.draft?.card) {
        if (!shown.has('action')) continue;
        if (text.trim()) items.push({ role: 'assistant', text: text.trim(), at });
        text = '';
        items.push({ role: 'assistant', draft: { type: 'action', draft: result.draft }, at });
        continue;
      }
      if (!DRAFT_TYPES[block.name]) continue;
      if (text.trim()) items.push({ role: 'assistant', text: text.trim(), at });
      text = '';
      const { note: _note, ...fields } = block.input || {};
      let draft = fields;
      if (block.name === 'draft_support_train_from_story') {
        draft = { story: fields.story, support_modes_requested: fields.support_modes_requested || ['meal'] };
      } else if (block.name === 'draft_pickup_schedule') {
        // The card is what the tool returned (it knows the home), with the next pickup brought up to date.
        draft = refreshPickupDraft(results.get(block.id)?.draft);
        if (!draft) continue;
      }
      items.push({ role: 'assistant', draft: { type: DRAFT_TYPES[block.name], draft }, at });
    }
    if (text.trim()) items.push({ role: 'assistant', text: text.trim(), at });
    if (nudge && items[firstItem]) items[firstItem].nudge = { id: nudge.id, kind: nudge.kind };
  }
  flushLinks();
  return items;
}

/**
 * One of the person's conversations, for display. null when it isn't theirs or
 * doesn't exist; an empty list when the database has no transcripts yet.
 * @param {object} [options]
 * @param {string[]} [options.cards] — The cards the app can show, as the chat request lists them
 */
async function getConversationMessages(userId, conversationId, { cards = [] } = {}) {
  const { data, error } = await supabaseAdmin
    .from('AIConversation')
    .select('id, title, messages, created_at')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Most likely the messages column (migration ai_conversation_messages) isn't applied yet.
    logger.warn('getConversationMessages error', { userId, conversationId, code: error.code, error: error.message });
    const { data: row } = await supabaseAdmin.from('AIConversation').select('id, title')
      .eq('id', conversationId).eq('user_id', userId).maybeSingle();
    return row ? { conversationId: row.id, title: row.title, messages: [] } : null;
  }
  if (!data) return null;
  const startedAt = new Date(data.created_at).toISOString();
  const messages = displayMessages(data.messages, { cards, startedAt });
  // Each action card's done state, for apps that list "state" (phase 3 contract §4.3).
  if (cards.includes('state')) await cardState.attachStates(userId, messages);
  return { conversationId: data.id, title: data.title, messages };
}

async function deleteConversation(userId, conversationId) {
  const { error } = await supabaseAdmin
    .from('AIConversation')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    logger.error('deleteConversation error', { userId, conversationId, error: error.message });
    return false;
  }
  return true;
}

// ─── Mail Opening Suggestion ─────────────────────────────────────────────────

async function draftMailOpening({ intent, ink, recipientName, body, userId }) {
  const startTime = Date.now();
  const client = getAnthropicClient();
  if (!client) {
    return { suggestion: null, error: 'AI_UNAVAILABLE' };
  }

  let userContent = `Intent: ${intent}\nInk: ${ink}\nRecipient: ${recipientName}`;
  if (body) {
    userContent += `\n\nLetter body preview:\n${body.slice(0, 2000)}`;
  }

  try {
    const response = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.MAIL_OPENING_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      effort: DRAFT_EFFORT,
      maxTokens: DRAFT_MAX_TOKENS,
      timeoutMs: DRAFT_TIMEOUT_MS,
    });

    const suggestion = response.text.trim();

    await logRequest({
      userId, endpoint: 'draft/mail-opening', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.mailOpening, status: suggestion ? 'ok' : 'empty',
      latencyMs: Date.now() - startTime,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });

    if (!suggestion) {
      return { suggestion: null, error: 'AI_UNAVAILABLE' };
    }

    return { suggestion };
  } catch (err) {
    logger.error('draftMailOpening error', { userId, error: err.message });
    await logRequest({
      userId, endpoint: 'draft/mail-opening', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.mailOpening, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    return { suggestion: null, error: 'AI_UNAVAILABLE' };
  }
}

module.exports = {
  streamChat,
  draftGig,
  draftListing,
  draftListingFromImages,
  draftPost,
  suggestPost,
  readPickupSchedule,
  readRadonReport,
  summarizeMail,
  generatePlaceBrief,
  draftMailOpening,
  listConversations,
  getConversationMessages,
  deleteConversation,
  // For background model calls (background.js), which log to the same table.
  logRequest,
};
