/**
 * AI Agent Service — core orchestrator for all AI features.
 *
 * Uses the OpenAI Responses API with:
 *   - Streaming for the chat agent
 *   - Function calling (tools) for data retrieval and draft creation
 *   - Structured output for single-turn drafts
 *   - previous_response_id for multi-turn conversation state
 *
 * Handles:
 *   1. streamChat()        — Multi-turn chat agent with SSE streaming
 *   2. draftListing()      — Single-turn listing draft
 *   3. draftPost()         — Single-turn post draft
 *   4. summarizeMail()     — Mail summarization with action extraction
 *   5. generatePlaceBrief() — Place brief from external data
 */
const { getOpenAIClient } = require('../../config/openai');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const { toolDefinitions, executeTool } = require('./tools');
const prompts = require('./prompts');
const schemas = require('./schemas');
const { getAuthorizedMail } = require('./mailAccess');
const noaa = require('../external/noaa');

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o';
const DRAFT_MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini';
const MAX_TOOL_ROUNDS = 5;         // Maximum tool-call → response rounds
const AGENT_TIMEOUT_MS = 20000;    // 20s total timeout for streaming chat
const DRAFT_TIMEOUT_MS = 30000;    // 30s for single-turn drafts

function isAbortLikeError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return err.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout');
}

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

async function updateConversation(conversationId, responseId, messageCount, title) {
  const update = {
    response_id: responseId,
    message_count: messageCount,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (title) update.title = title;

  await supabaseAdmin
    .from('AIConversation')
    .update(update)
    .eq('id', conversationId);
}

// ─── 1. Streaming Chat Agent ────────────────────────────────────────────────

/**
 * Stream a chat response to an SSE writer.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.conversationId]
 * @param {string} params.message
 * @param {object} [params.coarseLocation]
 * @param {string[]} [params.images] — Image URLs to include as vision input
 * @param {object} sseWriter — { write(event, data), end() }
 */
async function streamChat({ userId, conversationId, message, coarseLocation, images }, sseWriter) {
  const startTime = Date.now();
  let totalToolCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  const openai = getOpenAIClient();
  if (!openai) {
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

  try {
    // Build the initial Responses API input — multi-modal if images are present
    let userMessageContent;
    if (images && images.length > 0) {
      const contentParts = images.map((imageUrl) => ({
        type: 'input_image',
        image_url: imageUrl,
      }));
      contentParts.push({ type: 'input_text', text: userTextContent });
      userMessageContent = contentParts;
    } else {
      userMessageContent = userTextContent;
    }

    const input = [{ role: 'user', content: userMessageContent }];

    const baseParams = {
      model: CHAT_MODEL,
      instructions: prompts.CHAT_AGENT_SYSTEM,
      input,
      tools: toolDefinitions,
      stream: true,
      ...(conversation.response_id ? { previous_response_id: conversation.response_id } : {}),
    };

    // Send conversation ID immediately
    sseWriter.write('conversation', {
      conversationId: conversation.id,
      isNew: !conversationId,
    });

    let currentResponseId = null;
    let fullText = '';
    let drafts = [];
    let round = 0;
    let timedOut = false;

    // Agent loop: stream → handle tool calls → stream again
    while (round < MAX_TOOL_ROUNDS) {
      round++;
      const pendingToolCallsById = new Map();
      let needsAnotherRound = false;

      const extractCallId = (event = {}) => {
        const direct = event.call_id || event.callId;
        if (direct) return direct;

        const item = event.item || event.output_item;
        const fromItem = item?.call_id || item?.callId;
        if (fromItem) return fromItem;

        // Some SDK events include item_id. Only trust it if it already looks like a call ID.
        if (typeof event.item_id === 'string' && event.item_id.startsWith('call_')) {
          return event.item_id;
        }
        return null;
      };

      const upsertToolCall = ({ callId, name, argumentsJson }) => {
        if (!callId) return;
        const prev = pendingToolCallsById.get(callId) || {};
        pendingToolCallsById.set(callId, {
          callId,
          name: name || prev.name,
          arguments: argumentsJson !== undefined ? argumentsJson : prev.arguments,
        });
      };

      const params = round === 1 ? baseParams : {
        model: CHAT_MODEL,
        instructions: prompts.CHAT_AGENT_SYSTEM,
        input: baseParams.input,
        tools: toolDefinitions,
        stream: true,
        ...(currentResponseId ? { previous_response_id: currentResponseId } : {}),
      };

      const stream = await openai.responses.create(params);

      for await (const event of stream) {
        // Track response ID
        if (event.type === 'response.created' || event.type === 'response.completed') {
          if (event.response?.id) {
            currentResponseId = event.response.id;
          }
          // Track usage from the completed event
          if (event.type === 'response.completed' && event.response?.usage) {
            inputTokens += event.response.usage.input_tokens || 0;
            outputTokens += event.response.usage.output_tokens || 0;
          }
        }

        // Stream text deltas to client
        if (event.type === 'response.output_text.delta') {
          fullText += event.delta || '';
          sseWriter.write('text_delta', { delta: event.delta });
        }

        // Collect function calls (arguments.done)
        if (event.type === 'response.function_call_arguments.done') {
          const callId = extractCallId(event);
          upsertToolCall({
            callId,
            name: event.name || event.item?.name,
            argumentsJson: event.arguments ?? event.item?.arguments,
          });
          if (!callId) {
            logger.warn('AI tool call missing call_id', { userId, eventType: event.type, name: event.name || event.item?.name });
          }
        }

        // Collect function calls (output_item.done)
        if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
          const callId = extractCallId(event);
          upsertToolCall({
            callId,
            name: event.item?.name,
            argumentsJson: event.item?.arguments,
          });
          if (!callId) {
            logger.warn('AI function_call output item missing call_id', { userId, name: event.item?.name, itemId: event.item?.id || null });
          }
        }

        // Collect any function calls from the final response snapshot too.
        if (event.type === 'response.completed' && Array.isArray(event.response?.output)) {
          for (const item of event.response.output) {
            if (item?.type !== 'function_call') continue;
            upsertToolCall({
              callId: item.call_id || (typeof item.id === 'string' && item.id.startsWith('call_') ? item.id : null),
              name: item.name,
              argumentsJson: item.arguments,
            });
          }
        }

        // Check for timeout
        if (Date.now() - startTime > AGENT_TIMEOUT_MS) {
          logger.warn('Chat agent timeout', { userId, round, elapsed: Date.now() - startTime });
          sseWriter.write('error', { error: 'TIMEOUT', message: 'Response took too long. Please try again.' });
          timedOut = true;
          break;
        }
      }

      // On timeout, stop immediately — don't execute tools or loop again.
      if (timedOut) break;

      // Process tool calls if any
      const pendingToolCalls = Array.from(pendingToolCallsById.values()).filter((tc) => tc.callId && tc.name);
      if (pendingToolCalls.length > 0) {
        totalToolCalls += pendingToolCalls.length;
        needsAnotherRound = true;

        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          pendingToolCalls.map(async (tc) => {
            let args;
            try {
              args = JSON.parse(tc.arguments);
            } catch {
              args = {};
            }
            const result = await executeTool(tc.name, args, userId);

            // If it's a draft, emit it to the client immediately
            if (result.draftType) {
              drafts.push(result);
              sseWriter.write('draft', {
                type: result.draftType,
                draft: result.draft || result.summary,
                valid: result.valid,
              });
            }

            return {
              type: 'function_call_output',
              call_id: tc.callId,
              output: JSON.stringify(result),
            };
          })
        );

        // Append tool outputs for the next round
        baseParams.input = [...baseParams.input, ...toolResults];
      }

      if (!needsAnotherRound) break;
      // If timed out after tool execution, set the flag and bail out.
      if (Date.now() - startTime > AGENT_TIMEOUT_MS) {
        logger.warn('Chat agent timeout (post-tool)', { userId, round, elapsed: Date.now() - startTime });
        if (!timedOut) {
          sseWriter.write('error', { error: 'TIMEOUT', message: 'Response took too long. Please try again.' });
          timedOut = true;
        }
        break;
      }
    }

    if (timedOut) {
      // Timed out — close the stream without a done event, log as timeout, skip conversation update.
      sseWriter.end();
      await logRequest({
        userId,
        conversationId: conversation.id,
        endpoint: 'chat',
        model: CHAT_MODEL,
        promptVersion: prompts.VERSIONS.chat,
        status: 'timeout',
        latencyMs: Date.now() - startTime,
        inputTokens,
        outputTokens,
        toolCallsCount: totalToolCalls,
      });
    } else {
      // Update conversation state
      const newMessageCount = (conversation.message_count || 0) + 2; // user + assistant
      // Auto-title on first message
      const title = conversation.message_count === 0
        ? message.slice(0, 60) + (message.length > 60 ? '…' : '')
        : undefined;

      await updateConversation(conversation.id, currentResponseId, newMessageCount, title);

      // Send done event
      sseWriter.write('done', {
        conversationId: conversation.id,
        usage: { inputTokens, outputTokens },
        toolCalls: totalToolCalls,
      });
      sseWriter.end();

      // Log
      await logRequest({
        userId,
        conversationId: conversation.id,
        endpoint: 'chat',
        model: CHAT_MODEL,
        promptVersion: prompts.VERSIONS.chat,
        status: 'ok',
        latencyMs: Date.now() - startTime,
        inputTokens,
        outputTokens,
        toolCallsCount: totalToolCalls,
      });
    }
  } catch (err) {
    logger.error('streamChat error', { userId, error: err.message, stack: err.stack });
    sseWriter.write('error', {
      error: 'AI_ERROR',
      message: 'Something went wrong with the AI. Please try again.',
    });
    sseWriter.end();

    await logRequest({
      userId,
      conversationId: conversation?.id,
      endpoint: 'chat',
      model: CHAT_MODEL,
      promptVersion: prompts.VERSIONS.chat,
      status: 'error',
      latencyMs: Date.now() - startTime,
      errorMessage: err.message,
    });
  }
}

// ─── 2. Single-turn Gig Draft ───────────────────────────────────────────────

async function draftGig({ text, coarseLocation, context, userId }) {
  const startTime = Date.now();
  const openai = getOpenAIClient();
  if (!openai) {
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
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.GIG_DRAFT_SYSTEM,
      input: [{ role: 'user', content: userContent }],
      text: {
        format: {
          type: 'json_schema',
          name: 'gig_draft',
          schema: schemas.gigDraftJsonSchemaStrict,
          strict: true,
        },
      },
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const outputText = response.output_text || '';
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
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
    if (isAbortLikeError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── 3. Single-turn Listing Draft ───────────────────────────────────────────

async function draftListing({ text, coarseLocation, userId }) {
  const startTime = Date.now();
  const openai = getOpenAIClient();
  if (!openai) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  let userContent = text;
  if (coarseLocation) {
    userContent += `\n\n[Location: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
  }

  try {
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.LISTING_DRAFT_SYSTEM,
      input: [{ role: 'user', content: userContent }],
      text: {
        format: {
          type: 'json_schema',
          name: 'listing_draft',
          schema: schemas.listingDraftJsonSchemaStrict,
          strict: true,
        },
      },
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const outputText = response.output_text || '';
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
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
    if (isAbortLikeError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── 3b. Single-turn Listing Draft from Images (Snap & Sell) ────────────────

async function draftListingFromImages({ images, text, latitude, longitude, userId }) {
  const startTime = Date.now();
  const openai = getOpenAIClient();
  if (!openai) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  const s3Service = require('../s3Service');

  // Build content array with images + optional text
  const contentParts = images.map((img) => {
    let imageUrl;
    if (img.startsWith('http') || img.startsWith('data:')) {
      imageUrl = img;
    } else {
      imageUrl = s3Service.getPublicUrl(img);
    }
    return { type: 'input_image', image_url: imageUrl };
  });

  let userPrompt = 'Describe this item for a marketplace listing.';
  if (text) {
    userPrompt = `${text}\n\nDescribe this item for a marketplace listing.`;
  }
  contentParts.push({ type: 'input_text', text: userPrompt });

  try {
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.LISTING_DRAFT_SYSTEM,
      input: [{ role: 'user', content: contentParts }],
      text: {
        format: {
          type: 'json_schema',
          name: 'listing_draft',
          schema: schemas.listingDraftJsonSchemaStrict,
          strict: true,
        },
      },
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const outputText = response.output_text || '';
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
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
    if (isAbortLikeError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── 3. Single-turn Post Draft ──────────────────────────────────────────────

async function draftPost({ text, surface, coarseLocation, userId }) {
  const startTime = Date.now();
  const openai = getOpenAIClient();
  if (!openai) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  let userContent = text;
  if (surface) userContent += `\n\n[Posting to: ${surface} feed]`;
  if (coarseLocation) {
    userContent += `\n[Location: ${coarseLocation.city || ''}, ${coarseLocation.state || ''}]`;
  }

  try {
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.POST_DRAFT_SYSTEM,
      input: [{ role: 'user', content: userContent }],
      text: {
        format: {
          type: 'json_schema',
          name: 'post_draft',
          schema: schemas.postDraftJsonSchemaStrict,
          strict: true,
        },
      },
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const outputText = response.output_text || '';
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
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
    if (isAbortLikeError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── 4. Mail Summarization ──────────────────────────────────────────────────

async function summarizeMail({ mailItemId, userId }) {
  const startTime = Date.now();
  const openai = getOpenAIClient();
  if (!openai) {
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
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.MAIL_SUMMARY_SYSTEM,
      input: [{ role: 'user', content: mailContent }],
      text: {
        format: {
          type: 'json_schema',
          name: 'mail_summary',
          schema: schemas.mailSummaryJsonSchemaStrict,
          strict: true,
        },
      },
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const outputText = response.output_text || '';
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
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
  const openai = getOpenAIClient();
  if (!openai) {
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
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.PLACE_BRIEF_SYSTEM,
      input: [{ role: 'user', content: externalDataPrompt }],
      text: {
        format: {
          type: 'json_schema',
          name: 'place_brief',
          schema: schemas.placeBriefJsonSchemaStrict,
          strict: true,
        },
      },
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const outputText = response.output_text || '';
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
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
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
  const openai = getOpenAIClient();
  if (!openai) {
    return { suggestion: null, error: 'AI_UNAVAILABLE' };
  }

  let userContent = `Intent: ${intent}\nInk: ${ink}\nRecipient: ${recipientName}`;
  if (body) {
    userContent += `\n\nLetter body preview:\n${body.slice(0, 2000)}`;
  }

  try {
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.MAIL_OPENING_SYSTEM,
      input: [{ role: 'user', content: userContent }],
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const suggestion = (response.output_text || '').trim();

    await logRequest({
      userId, endpoint: 'draft/mail-opening', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.mailOpening, status: suggestion ? 'ok' : 'empty',
      latencyMs: Date.now() - startTime,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
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
