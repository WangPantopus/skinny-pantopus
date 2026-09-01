/**
 * Support Train Draft Service — single-turn AI draft from organizer story.
 *
 * Mirrors the agentService.draftGig pattern but lives in its own file
 * to keep agentService.js untouched and the unit easily testable.
 */
const { getOpenAIClient } = require('../../config/openai');
const supabaseAdmin = require('../../config/supabaseAdmin');
const logger = require('../../utils/logger');
const prompts = require('./prompts');
const schemas = require('./schemas');

const DRAFT_MODEL = process.env.OPENAI_DRAFT_MODEL || 'gpt-4o-mini';
const DRAFT_TIMEOUT_MS = parseInt(process.env.OPENAI_DRAFT_TIMEOUT_MS, 10) || 30000;

// ─── Local helpers (copied from agentService to avoid touching that file) ──

function isAbortLikeError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  return err.name === 'AbortError' || msg.includes('aborted') || msg.includes('timeout');
}

async function logRequest({
  userId, endpoint, model, promptVersion,
  status, latencyMs, inputTokens, outputTokens,
  schemaValid, errorMessage,
}) {
  try {
    await supabaseAdmin.from('AIRequestLog').insert({
      user_id: userId || null,
      conversation_id: null,
      endpoint,
      model,
      prompt_version: promptVersion,
      status,
      latency_ms: latencyMs,
      input_tokens: inputTokens || null,
      output_tokens: outputTokens || null,
      tool_calls_count: 0,
      schema_valid: schemaValid !== false,
      cache_hit: false,
      error_message: errorMessage || null,
    });
  } catch (err) {
    logger.error('Failed to log AI request', { error: err.message });
  }
}

// ─── Main draft function ───────────────────────────────────────────────────

async function draftSupportTrain({ story, supportModesRequested, recipientReference, homeReference, userId }) {
  const startTime = Date.now();
  const openai = getOpenAIClient();
  if (!openai) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  let userContent = story;
  if (supportModesRequested && supportModesRequested.length > 0) {
    userContent += `\n\n[Support modes requested: ${supportModesRequested.join(', ')}]`;
  }
  if (recipientReference) {
    const recipientLabel = typeof recipientReference === 'string'
      ? recipientReference
      : recipientReference.label || recipientReference.user_id || JSON.stringify(recipientReference);
    userContent += `\n[Recipient: ${recipientLabel}]`;
  }
  if (homeReference) {
    const homeLabel = typeof homeReference === 'string'
      ? homeReference
      : homeReference.home_id || JSON.stringify(homeReference);
    userContent += `\n[Home: ${homeLabel}]`;
  }

  try {
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.SUPPORT_TRAIN_DRAFT_SYSTEM,
      input: [{ role: 'user', content: userContent }],
      text: {
        format: {
          type: 'json_schema',
          name: 'support_train_draft',
          schema: schemas.supportTrainDraftJsonSchemaStrict,
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
        userId, endpoint: 'draft/support_train', model: DRAFT_MODEL,
        promptVersion: prompts.VERSIONS.supportTrain, status: 'schema_error',
        latencyMs: Date.now() - startTime, schemaValid: false,
        errorMessage: 'JSON parse failed',
      });
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    const valid = schemas.validateSupportTrainDraft(draft);

    await logRequest({
      userId, endpoint: 'draft/support_train', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.supportTrain, status: valid ? 'ok' : 'schema_error',
      latencyMs: Date.now() - startTime, schemaValid: valid,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    if (!valid) {
      return { error: 'DRAFT_INVALID', message: 'Could not generate a valid draft. Please try again or create manually.', fallback: true };
    }

    return {
      draft,
      missing_required_fields: draft.missing_required_fields || [],
      summary_chips: draft.summary_chips || [],
    };
  } catch (err) {
    logger.error('draftSupportTrain error', { userId, error: err.message });
    await logRequest({
      userId, endpoint: 'draft/support_train', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.supportTrain, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (isAbortLikeError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out. Please try again.', fallback: true };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable. Please create manually.', fallback: true };
  }
}

// ─── Open Slots Nudge ──────────────────────────────────────────────────────

async function draftOpenSlotsNudge({ openSlotsContext, userId }) {
  const startTime = Date.now();
  const openai = getOpenAIClient();
  if (!openai) {
    return { error: 'AI_UNAVAILABLE', fallback: true };
  }

  const userContent = `${openSlotsContext.count} open ${openSlotsContext.support_modes?.join('/') || 'support'} slot${openSlotsContext.count > 1 ? 's' : ''} on ${(openSlotsContext.dates || []).join(', ')}.`;

  try {
    const response = await openai.responses.create({
      model: DRAFT_MODEL,
      instructions: prompts.OPEN_SLOTS_NUDGE_SYSTEM,
      input: [{ role: 'user', content: userContent }],
    }, { signal: AbortSignal.timeout(DRAFT_TIMEOUT_MS) });

    const message = (response.output_text || '').trim();

    await logRequest({
      userId, endpoint: 'draft/open_slots_nudge', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.openSlotsNudge, status: message ? 'ok' : 'empty',
      latencyMs: Date.now() - startTime,
      inputTokens: response.usage?.input_tokens,
      outputTokens: response.usage?.output_tokens,
    });

    if (!message) {
      return { error: 'DRAFT_INVALID', message: 'Could not generate a nudge message.' };
    }

    return { message };
  } catch (err) {
    logger.error('draftOpenSlotsNudge error', { userId, error: err.message });
    await logRequest({
      userId, endpoint: 'draft/open_slots_nudge', model: DRAFT_MODEL,
      promptVersion: prompts.VERSIONS.openSlotsNudge, status: 'error',
      latencyMs: Date.now() - startTime, errorMessage: err.message,
    });
    if (isAbortLikeError(err)) {
      return { error: 'AI_TIMEOUT', message: 'AI draft timed out.' };
    }
    return { error: 'AI_UNAVAILABLE', message: 'AI is temporarily unavailable.' };
  }
}

module.exports = { draftSupportTrain, draftOpenSlotsNudge };
