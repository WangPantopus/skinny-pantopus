/**
 * Request layer over the Anthropic Messages API, shared by every AI feature.
 *
 * Keeps the Claude Sonnet 5.5 rules in one place so no call site can break them:
 *   - No temperature / top_p / top_k: a non-default value is a 400. Behaviour is
 *     steered with the prompt and with `output_config.effort`.
 *   - Thinking is adaptive and on by default. `effort: 'low'` keeps it short
 *     (the model skips it on most simple requests), which is what holds time to
 *     first token down; the default, `high`, is much slower. Thinking tokens
 *     count against `max_tokens`, so callers leave room for them.
 *   - JSON replies use `output_config.format` (structured outputs), so the text
 *     is always parseable. Prefill is gone, so it can't be forced another way.
 *   - The system prompt is a cache breakpoint. Prompts under the model's
 *     512-token minimum silently skip caching; longer ones are read back at a
 *     tenth of the price and with a shorter time to first token.
 *   - A refusal (stop_reason "refusal") is a failure like any other: `complete`
 *     throws AIRefusalError and each caller falls back to manual creation. The
 *     server-side refusal fallback is not used. It is a beta header that fails
 *     every call where it isn't enabled, and it only retries the cyber and
 *     frontier_llm categories, which tasks, posts, mail and weather never reach.
 */
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MAX_TOKENS = 4096;

/** Claude declined the request (HTTP 200, stop_reason "refusal"). Callers treat it like any other AI failure. */
class AIRefusalError extends Error {
  constructor(category) {
    super(`Claude declined the request${category ? ` (${category})` : ''}`);
    this.name = 'AIRefusalError';
    this.category = category || null;
  }
}

/** The text blocks of a message, joined. A reply can also hold thinking blocks, so never read content[0]. */
function textOf(message) {
  return (message?.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

const emptyUsage = () => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });

/** Add one response's usage to a running total. Input counts every prompt token, cached or not. */
function addUsage(total, usage) {
  if (!usage) return total;
  const read = usage.cache_read_input_tokens || 0;
  const write = usage.cache_creation_input_tokens || 0;
  total.inputTokens += (usage.input_tokens || 0) + read + write;
  total.outputTokens += usage.output_tokens || 0;
  total.cacheReadTokens += read;
  total.cacheWriteTokens += write;
  return total;
}

/** True when the call ran out of time: our own deadline, the SDK's timeout, or an aborted signal. */
function isTimeoutError(err) {
  if (!err) return false;
  if (err instanceof Anthropic.APIConnectionTimeoutError || err instanceof Anthropic.APIUserAbortError) return true;
  const msg = String(err.message || '').toLowerCase();
  return err.name === 'AbortError' || err.name === 'TimeoutError'
    || msg.includes('aborted') || msg.includes('timed out') || msg.includes('timeout');
}

/**
 * True when Claude rejected a photo (a URL it couldn't fetch, a corrupt or oversized
 * file, a type it doesn't read). Retrying won't help, so callers say so instead of
 * calling the AI "unavailable".
 */
function isImageError(err) {
  if (!(err instanceof Anthropic.BadRequestError)) return false;
  return /image|download the file/i.test(String(err.error?.error?.message || err.message || ''));
}

/** A system prompt as a cacheable block. */
function systemBlocks(text, { cache = true } = {}) {
  return [{ type: 'text', text, ...(cache ? { cache_control: { type: 'ephemeral' } } : {}) }];
}

// Models that take `role: "system"` messages inside `messages` (no beta needed);
// Claude Sonnet 5 and older models answer 400 to them.
const SYSTEM_MESSAGE_MODELS = /^claude-(sonnet-5-5|haiku-5-5|opus-5-5|opus-5|opus-4-8|fable-5|fable-5-1|mythos-5|mythos-5-1)$/;

/** True when `model` accepts mid-conversation system messages. */
function supportsSystemMessages(model) {
  return SYSTEM_MESSAGE_MODELS.test(String(model || ''));
}

// The model can't know the date. Anything that writes dates ("this Saturday",
// "overdue", an event's start) is told it, in the person's time zone.
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

function formatInZone(timeZone, now, options) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone, ...options }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-US', { timeZone: DEFAULT_TIMEZONE, ...options }).format(now);
  }
}

/** "Monday, October 12, 2026 at 6:10 PM PDT" */
function describeNow(timeZone = DEFAULT_TIMEZONE, now = new Date()) {
  return formatInZone(timeZone || DEFAULT_TIMEZONE, now, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

/** "[Today: Monday, October 12, 2026 (America/Los_Angeles)]", the line a single-turn draft's input ends with. */
function todayLine(timeZone = DEFAULT_TIMEZONE, now = new Date()) {
  const zone = timeZone || DEFAULT_TIMEZONE;
  const day = formatInZone(zone, now, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  return `[Today: ${day} (${zone})]`;
}

/**
 * One non-streaming call.
 *
 * @param {object} p
 * @param {import('@anthropic-ai/sdk').Anthropic} p.client
 * @param {string} p.model
 * @param {string} p.system            System prompt text.
 * @param {Array}  p.messages          Anthropic MessageParam[].
 * @param {string} p.effort            'low' | 'medium' | 'high' | 'xhigh' | 'max'.
 * @param {object} [p.schema]          JSON Schema (already reduced with toClaudeSchema) for a JSON reply.
 * @param {number} [p.maxTokens]       Covers thinking and the reply.
 * @param {number} [p.timeoutMs]       Overall deadline for the call, retries included.
 * @param {AbortSignal} [p.signal]     Extra cancellation.
 * @param {boolean} [p.cacheSystem]    Mark the system prompt as a cache breakpoint (default true).
 * @returns {Promise<{message: object, text: string, stopReason: string, inputTokens: number, outputTokens: number}>}
 * @throws {AIRefusalError} when Claude declines; the SDK's APIError classes otherwise.
 */
async function complete({
  client, model, system, messages, effort, schema,
  maxTokens = DEFAULT_MAX_TOKENS, timeoutMs, signal, cacheSystem = true,
}) {
  const signals = [];
  if (timeoutMs) signals.push(AbortSignal.timeout(timeoutMs));
  if (signal) signals.push(signal);

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemBlocks(system, { cache: cacheSystem }),
    messages,
    output_config: {
      effort,
      ...(schema ? { format: { type: 'json_schema', schema } } : {}),
    },
  }, signals.length ? { signal: AbortSignal.any(signals) } : undefined);

  if (message.stop_reason === 'refusal') {
    throw new AIRefusalError(message.stop_details?.category);
  }

  const usage = addUsage(emptyUsage(), message.usage);
  return {
    message,
    text: textOf(message),
    stopReason: message.stop_reason,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };
}

/**
 * The JSON object in a reply that wasn't produced with structured outputs
 * (tolerates a ```json fence or a sentence around it). null when there is none.
 */
function parseJsonObject(text) {
  if (typeof text !== 'string') return null;
  let body = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(body);
  if (fenced) body = fenced[1];
  try {
    return JSON.parse(body);
  } catch {
    // Fall through to the outermost braces.
  }
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Claude reads JPEG, PNG, GIF and WebP. A photo in another format (HEIC from an iPhone, say)
// would fail the whole request when Anthropic fetched it, so it is left out up front.
const IMAGE_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const UNSUPPORTED_IMAGE_EXTENSIONS = new Set(['heic', 'heif', 'tif', 'tiff', 'bmp', 'svg', 'avif', 'jxl', 'ico', 'raw', 'dng']);
// The API refuses an image over 10 MB; base64 text this long is already past it.
const MAX_IMAGE_BASE64_CHARS = 10 * 1024 * 1024;

/**
 * An image content block from an http(s) URL (fetched by Anthropic) or a base64
 * data URI. null for anything Claude can't read, so one bad photo is dropped
 * instead of failing the request.
 */
function imageBlock(source) {
  if (typeof source !== 'string' || !source) return null;
  if (source.startsWith('data:')) {
    const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(source);
    if (!match) return null;
    const mediaType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
    if (!IMAGE_MEDIA_TYPES.has(mediaType) || match[2].length > MAX_IMAGE_BASE64_CHARS) return null;
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data: match[2] } };
  }
  let url;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const extension = /\.([a-z0-9]+)$/i.exec(url.pathname)?.[1]?.toLowerCase();
  if (extension && UNSUPPORTED_IMAGE_EXTENSIONS.has(extension)) return null;
  return { type: 'image', source: { type: 'url', url: source } };
}

module.exports = {
  AIRefusalError,
  complete,
  textOf,
  emptyUsage,
  addUsage,
  isTimeoutError,
  isImageError,
  systemBlocks,
  supportsSystemMessages,
  describeNow,
  todayLine,
  parseJsonObject,
  imageBlock,
  DEFAULT_MAX_TOKENS,
  DEFAULT_TIMEZONE,
};
