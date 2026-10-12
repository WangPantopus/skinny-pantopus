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
const { toolDefinitions, executeTool } = require('./tools');
const prompts = require('./prompts');
const schemas = require('./schemas');
const { complete, emptyUsage, imageBlock, isImageError, isTimeoutError, systemBlocks } = require('./llm');
const { runAgentTurn, sanitizeHistory, compactForStorage } = require('./agentLoop');
const { getAuthorizedMail } = require('./mailAccess');
const noaa = require('../external/noaa');
const { isLaunchFeatureEnabled } = require('../../utils/featureFlags');

// Launch cuts #3 (Marketplace) and #4 (Open Gigs): while they are hidden, the
// chat assistant neither offers nor drafts listings or open tasks (their
// drafts would lead to hidden composers). The drafting code itself stays.
// Launch cut #10 (Mailbox): it doesn't read or summarize mail either.
function launchScopedChatTools() {
  return toolDefinitions.filter((tool) => {
    if (tool.name === 'create_gig_draft') return isLaunchFeatureEnabled('open_gigs');
    if (tool.name === 'create_listing_draft') return isLaunchFeatureEnabled('marketplace');
    if (['get_mail_item', 'summarize_mail_item'].includes(tool.name)) return isLaunchFeatureEnabled('mailbox');
    return true;
  });
}

function launchScopedChatInstructions() {
  const hidden = [];
  if (!isLaunchFeatureEnabled('open_gigs')) hidden.push('posting tasks (gigs) for neighbors to bid on');
  if (!isLaunchFeatureEnabled('marketplace')) hidden.push('marketplace listings (selling, giving away, renting or wanted items)');
  if (!isLaunchFeatureEnabled('mailbox')) hidden.push('the mailbox (received mail, Mail Day, the vault)');
  if (!hidden.length) return prompts.CHAT_AGENT_SYSTEM;
  return `${prompts.CHAT_AGENT_SYSTEM}

## Not available right now
These parts of Pantopus are not available yet: ${hidden.join('; ')}. Don't offer, suggest or draft them. If the user asks for one, say briefly that it isn't available in the app yet and help another way, for example with a community post.`;
}

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

/** The person's message as Claude's content: photos first, then the text. */
function buildUserContent(text, images) {
  const photos = (images || []).map(imageBlock).filter(Boolean);
  if (photos.length === 0) return text;
  return [...photos, { type: 'text', text }];
}

/**
 * Stream a chat response to an SSE writer.
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
async function streamChat({ userId, conversationId, message, coarseLocation, images, signal }, sseWriter) {
  const startTime = Date.now();

  const client = getAnthropicClient();
  if (!client) {
    sseWriter.write('error', { error: 'AI_UNAVAILABLE', message: 'AI features are not configured.' });
    sseWriter.end();
    return;
  }

  let conversation;
  try {
    conversation = await getOrCreateConversation(userId, conversationId);
  } catch {
    sseWriter.write('error', { error: 'CONVERSATION_ERROR', message: 'Could not load conversation.' });
    sseWriter.end();
    return;
  }

  // Build the user message with optional location context
  let userTextContent = message;
  if (coarseLocation) {
    userTextContent += `\n\n[User location context: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
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

  // The whole turn, tool calls included, shares one deadline.
  const deadline = AbortSignal.timeout(AGENT_TIMEOUT_MS);
  const turnSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;

  // Filled in as rounds finish, so a timeout can still log what was used.
  const usage = emptyUsage();
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
      system: systemBlocks(launchScopedChatInstructions()),
      tools: launchScopedChatTools(),
      messages: [
        ...sanitizeHistory(conversation.messages),
        { role: 'user', content: buildUserContent(userTextContent, images) },
      ],
      signal: turnSignal,
      usage,
      onText: (delta) => sseWriter.write('text_delta', { delta }),
      // Run one tool Claude asked for; a draft goes to the client as soon as it exists.
      runTool: async (use) => {
        const result = await executeTool(use.name, use.input || {}, userId);
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
  };

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
      promptVersion: prompts.VERSIONS.gig, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
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
      promptVersion: prompts.VERSIONS.listing, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
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
      promptVersion: prompts.VERSIONS.listing, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
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
      promptVersion: prompts.VERSIONS.post, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (isTimeoutError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
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

  const mailContent = `Subject: ${item.subject || 'N/A'}
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
      promptVersion: prompts.VERSIONS.mail, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
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
  summarizeMail,
  generatePlaceBrief,
  draftMailOpening,
  listConversations,
  deleteConversation,
};
