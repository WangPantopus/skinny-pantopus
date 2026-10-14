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
const { getAuthorizedMail } = require('./mailAccess');
const noaa = require('../external/noaa');
const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');

// Launch cuts #3 (Marketplace) and #4 (Open Gigs): while they are hidden, the
// chat assistant neither offers nor drafts listings or open tasks (their
// drafts would lead to hidden composers). The drafting code itself stays.
// Launch cut #10 (Mailbox): it doesn't read or summarize mail either.
// Gift funds (cut #9) aren't offered as a Support Train kind of help.
// The pickup-days card goes only to apps that say they can show it (`cards`).
function launchScopedChatTools({ pickupSchedule = false } = {}) {
  const giftFunds = isLaunchFeatureEnabled('gift_funds');
  return toolDefinitions
    .filter((tool) => {
      if (tool.name === 'draft_pickup_schedule') return pickupSchedule;
      if (tool.name === 'create_gig_draft') return isLaunchFeatureEnabled('open_gigs');
      if (tool.name === 'create_listing_draft') return isLaunchFeatureEnabled('marketplace');
      if (['get_mail_item', 'summarize_mail_item'].includes(tool.name)) return isLaunchFeatureEnabled('mailbox');
      return true;
    })
    .map((tool) => (tool.name === 'draft_support_train_from_story' && !giftFunds ? withoutGiftFunds(tool) : tool));
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

function launchScopedChatInstructions({ pickupSchedule = false } = {}) {
  return prompts.chatAgentSystem({
    openGigs: isLaunchFeatureEnabled('open_gigs'),
    marketplace: isLaunchFeatureEnabled('marketplace'),
    mailbox: isLaunchFeatureEnabled('mailbox'),
    pickupSchedule,
  });
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
const MAX_TOOL_ROUNDS = 5;         // Maximum tool-call → response rounds
const AGENT_TIMEOUT_MS = 20000;    // 20s total timeout for streaming chat
const DRAFT_TIMEOUT_MS = 30000;    // 30s for single-turn drafts

// ─── Request Logging ────────────────────────────────────────────────────────

async function logRequest({
  userId, conversationId, endpoint, model, promptVersion,
  status, latencyMs, inputTokens, outputTokens,
  toolCallsCount, schemaValid, cacheHit, errorMessage,
}) {
  try {
    await supabaseAdmin.from('AIRequestLog').insert({
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
    });
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

// ─── 1. Streaming Chat Agent ────────────────────────────────────────────────

/**
 * The person's message as Claude's content: photos first, then the text, then
 * the app's lines (when it was sent, which the model can't know, and the coarse
 * location the client reports).
 */
function buildUserContent({ message, photos, unreadable, timeZone, coarseLocation, contextText }) {
  let text = message;
  if (unreadable) {
    text += `\n\n[${unreadable} of the ${photos.length + unreadable} photos couldn't be opened, so they aren't included.]`;
  }
  text += `\n\n[Sent: ${describeNow(timeZone)}]`;
  if (coarseLocation) {
    text += `\n[User location context: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
  }
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
 * @param {string[]} [params.images] — Image URLs to include as vision input
 * @param {AbortSignal} [params.signal] — Aborts when the client disconnects, which stops the model call
 * @param {object} sseWriter — { write(event, data), end() }
 */
async function streamChat({ userId, conversationId, message, coarseLocation, images, cards, signal }, sseWriter) {
  const startTime = Date.now();

  const client = getAnthropicClient();
  if (!client) {
    sseWriter.write('error', { error: 'AI_UNAVAILABLE', message: 'AI features are not configured.' });
    sseWriter.end();
    return;
  }

  // Pantopus's context and the photos are read while the conversation loads.
  const contextRead = buildChatContext(userId).catch((err) => {
    logger.warn('Chat context failed', { userId, error: err.message });
    return { text: null, timeZone: undefined };
  });
  const photosRead = images?.length ? photoBlocks(images, userId) : Promise.resolve([]);

  let conversation;
  try {
    conversation = await getOrCreateConversation(userId, conversationId);
  } catch {
    sseWriter.write('error', { error: 'CONVERSATION_ERROR', message: 'Could not load conversation.' });
    sseWriter.end();
    return;
  }

  const logChat = (fields) => logRequest({
    userId,
    conversationId: conversation.id,
    endpoint: 'chat',
    model: CHAT_MODEL,
    promptVersion: prompts.VERSIONS.chat,
    latencyMs: Date.now() - startTime,
    ...fields,
  });

  const [context, photoResults] = await Promise.all([contextRead, photosRead]);
  const photos = photoResults.filter(Boolean);
  if (images?.length && photos.length === 0) {
    // Answering without the photo would only confuse: say it couldn't be opened.
    sseWriter.write('error', { error: 'AI_ERROR', message: "I couldn't open that photo. Try a JPEG or PNG, or a different photo." });
    sseWriter.end();
    await logChat({ status: 'error', errorMessage: 'unreadable_photos' });
    return;
  }

  // Pantopus's context follows the person's message, as a system message (operator
  // authority, appended so the cached history stays put), and only when it changed.
  const systemMessages = supportsSystemMessages(CHAT_MODEL);
  const history = sanitizeHistory(conversation.messages).filter((m) => systemMessages || m.role !== 'system');
  const newContext = context.text && context.text !== lastContextText(history) ? context.text : null;
  const messages = [
    ...history,
    {
      role: 'user',
      content: buildUserContent({
        message,
        photos,
        unreadable: (images?.length || 0) - photos.length,
        timeZone: context.timeZone,
        coarseLocation,
        contextText: systemMessages ? null : newContext,
      }),
    },
    ...(systemMessages && newContext ? [{ role: 'system', content: newContext }] : []),
  ];

  // The tools this deployment offers, and the cards this app can show; a call to any
  // other name is answered as unknown.
  const pickupSchedule = Array.isArray(cards) && cards.includes('pickup_schedule');
  const tools = launchScopedChatTools({ pickupSchedule });
  const toolNames = tools.map((tool) => tool.name);
  const ran = new Map();

  // The whole turn, tool calls included, shares one deadline.
  const deadline = AbortSignal.timeout(AGENT_TIMEOUT_MS);
  const turnSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;

  // Filled in as rounds finish, so a timeout can still log what was used.
  const usage = emptyUsage();
  let firstTextMs = null;
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
      system: systemBlocks(launchScopedChatInstructions({ pickupSchedule }), { ttl: '1h' }),
      tools,
      messages,
      signal: turnSignal,
      usage,
      onText: (delta) => {
        if (firstTextMs === null) firstTextMs = Date.now() - startTime;
        sseWriter.write('text_delta', { delta });
      },
      onToolStart: (name) => sseWriter.write('status', { tool: name, message: TOOL_STATUS[name] || 'Working on it…' }),
      // Run one tool Claude asked for; a draft goes to the client as soon as it exists.
      runTool: async (use) => {
        const name = toolNames.find((known) => known === use.name)
          || toolNames.find((known) => known.toLowerCase() === String(use.name).toLowerCase());
        const result = name
          ? await executeTool(name, use.input || {}, userId)
          : { error: `Unknown tool: ${use.name}. The tools are: ${toolNames.join(', ')}.` };
        ran.set(use.id, { name, result });
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
      // Drafts that came out valid are the answer: the turn ends at their cards.
      finishAfterTools: (uses) => closingForDrafts(uses.map((use) => ran.get(use.id))),
    });
  } catch (err) {
    const tokens = { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };

    if (signal?.aborted) {
      // The client left. Nobody is reading, and the abort already stopped the model call.
      logger.debug('AI chat SSE client disconnected', { userId });
      sseWriter.end();
      await logChat({ status: 'cancelled', ...tokens });
      return;
    }

    if (deadline.aborted) {
      // Timed out — close the stream without a done event, log as timeout, skip conversation update.
      logger.warn('Chat agent timeout', { userId, elapsed: Date.now() - startTime });
      sseWriter.write('error', { error: 'TIMEOUT', message: 'Response took too long. Please try again.' });
      sseWriter.end();
      await logChat({ status: 'timeout', ...tokens });
      return;
    }

    logger.error('streamChat error', { userId, error: err.message, stack: err.stack });
    sseWriter.write('error', {
      error: 'AI_ERROR',
      message: isImageError(err)
        ? "I couldn't read that photo. Please try a different one."
        : 'Something went wrong with the AI. Please try again.',
    });
    sseWriter.end();
    await logChat({ status: 'error', errorMessage: err.message, ...tokens });
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
    await logChat({ status: turn.outcome === 'refused' ? 'refusal' : 'error', errorMessage: reason, ...logged });
    return;
  }

  // Update conversation state
  const newMessageCount = (conversation.message_count || 0) + 2; // user + assistant
  // Auto-title on first message
  const title = conversation.message_count === 0
    ? message.slice(0, 60) + (message.length > 60 ? '…' : '')
    : undefined;

  await updateConversation(conversation.id, {
    // A turn that ran out of tool rounds has no answer to remember.
    messages: turn.outcome === 'complete' ? compactForStorage(turn.messages) : undefined,
    messageCount: newMessageCount,
    title,
  });

  // Send done event
  sseWriter.write('done', {
    conversationId: conversation.id,
    usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    toolCalls: turn.toolCalls,
  });
  sseWriter.end();

  // Log. A reply that stopped at its token ceiling was delivered, but cut short: say so.
  await logChat({
    status: 'ok',
    ...(turn.stopReason === 'max_tokens' ? { errorMessage: 'max_tokens' } : {}),
    ...logged,
  });
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
      system: prompts.POST_DRAFT_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
      schema: schemas.claudeSchemas.postDraft,
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

// ─── Pickup Days from a Flyer (for the pickup editor) ────────────────────────

/** A note from the model for people to read: trimmed, without a stray closing bracket ("…in the photo.}"). */
function noteText(note) {
  const text = typeof note === 'string' ? note.trim() : '';
  return (/[{[]/.test(text) ? text : text.replace(/[}\]\s]+$/, '')) || null;
}

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

  // Fetch only mail the caller is authorized to view.
  const item = await getAuthorizedMail({
    mailItemId,
    userId,
    select: 'subject, content, preview_text, sender_display, category, type, urgency, due_date, key_facts',
  });

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

async function listConversations(userId) {
  const { data, error } = await supabaseAdmin
    .from('AIConversation')
    .select('id, title, message_count, last_message_at, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('listConversations error', { userId, error: error.message });
    return [];
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
  /\n*\[(?:Sent|User location context): [^\]\n]*\]/g,
  /\n*\[\d+ of the \d+ photos couldn't be opened[^\]\n]*\]/g,
];
// The note that stands in for a stored photo (agentLoop.compactForStorage).
const PHOTO_NOTE = /^\[(?:Photo attached|(\d+) photos attached)\./;

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

/** The stored transcript as the apps show it: the person's messages, the replies, and the drafts as cards. */
function displayMessages(stored) {
  const items = [];
  const history = sanitizeHistory(stored);
  const results = storedResults(history);
  for (const message of history) {
    if (message.role === 'system') continue;
    const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content;
    if (message.role === 'user') {
      if (!blocks.some((block) => block.type !== 'tool_result')) continue;
      let photos = 0;
      const texts = [];
      for (const block of blocks) {
        if (block.type !== 'text') continue;
        const note = PHOTO_NOTE.exec(block.text);
        if (note) photos += note[1] ? Number(note[1]) : 1;
        else texts.push(block.text);
      }
      items.push({ role: 'user', text: personText(texts.join('\n')), photos });
      continue;
    }
    let text = '';
    for (const block of blocks) {
      if (block.type === 'text') text += (text ? '\n\n' : '') + block.text;
      if (block.type !== 'tool_use' || !DRAFT_TYPES[block.name]) continue;
      if (text.trim()) items.push({ role: 'assistant', text: text.trim() });
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
      items.push({ role: 'assistant', draft: { type: DRAFT_TYPES[block.name], draft } });
    }
    if (text.trim()) items.push({ role: 'assistant', text: text.trim() });
  }
  return items;
}

/**
 * One of the person's conversations, for display. null when it isn't theirs or
 * doesn't exist; an empty list when the database has no transcripts yet.
 */
async function getConversationMessages(userId, conversationId) {
  const { data, error } = await supabaseAdmin
    .from('AIConversation')
    .select('id, title, messages')
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
  return { conversationId: data.id, title: data.title, messages: displayMessages(data.messages) };
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
  readPickupSchedule,
  readRadonReport,
  summarizeMail,
  generatePlaceBrief,
  draftMailOpening,
  listConversations,
  getConversationMessages,
  deleteConversation,
};
