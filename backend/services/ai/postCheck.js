/**
 * The kindness and safety check before posting (AI assistant phase 2 contract §6.6). The post
 * composers run it through POST /api/posts/precheck with `stage: "post"` when the person taps
 * Post. It is advice only: the apps show what it found with "Edit" and "Post anyway", and the
 * create route's own rules don't change.
 *
 * Plain rules find a phone number or a street address in the words, and a Heads-up kind the
 * server refuses (the create route's own sentence). One short model call judges the tone, and for
 * a Heads-up whether it reports a crime or a suspicious person, which Heads-ups can't be about.
 * That call is inside the person's daily assistant budget (assistantBudget.js: the AI_ASSISTANT
 * switch and the daily turn caps, which count it), is logged to AIRequestLog as `post_check`, and
 * is skipped without an error when the switch or a cap says so, or when it hasn't answered within
 * 6 seconds; the keyword lists stand in for it then. The draft reaches the model as quoted data.
 */
const logger = require('../../utils/logger');
const { getAnthropicClient, DRAFT_MODEL } = require('../../config/anthropic');
const { complete, AIRefusalError, isTimeoutError } = require('./llm');
const { toClaudeSchema } = require('./schemas');
const { checkChatBudget } = require('./assistantBudget');
const { clip } = require('./assistantKit');
const prompts = require('./prompts');

const ENDPOINT = 'post_check';
// The person is waiting on the Post button.
const TIMEOUT_MS = 6000;
const MAX_TOKENS = 1024;
// Shorter drafts ("Thanks, everyone!") aren't worth a model call.
const MIN_MODEL_CHARS = 12;

const TYPE_NAMES = {
  ask_local: 'Question', recommendation: 'Recommendation', alert: 'Heads-up', lost_found: 'Lost and found',
  event: 'Event', deal: 'Deal', local_update: 'Local update', neighborhood_win: 'Good news', visitor_guide: 'Visitor guide',
};

const VERDICT_SCHEMA = toClaudeSchema({
  type: 'object',
  properties: {
    heated: { type: 'boolean' },
    heated_because: { type: 'string', enum: ['insults', 'threat', 'shaming', 'yelling', 'none'] },
    about_crime: { type: 'boolean' },
  },
  required: ['heated', 'heated_because', 'about_crime'],
  additionalProperties: false,
});

const TONE_MESSAGES = {
  insults: 'This may read as heated: it calls someone names. Neighbors answer a calm post more readily.',
  threat: 'This may read as a threat. Saying what happened and what would help gets a better answer.',
  shaming: 'This may read as calling out a neighbor. Describing what happened, without who, gets more help.',
  yelling: 'This may read as shouting (capitals or many exclamation marks). A calm post gets more helpful replies.',
  none: 'This may read as heated. A calm post gets more helpful replies.',
};
const CRIME_MESSAGE = "Heads-ups can't be about crime or suspicious people. In an emergency, call 911.";

// When the model doesn't run: the precheck's keyword lists.
const RANT_WORDS = ['ridiculous', 'unacceptable', 'terrible', 'furious', 'disgusting',
  'sick of', 'tired of', 'always do this', 'worst neighbor', 'called the cops'];
const CRIME_WORDS = /\b(suspicious|break-?ins?|broke into|burglar\w*|stole|stolen|theft|thie(f|ves)|robb(ed|ery)|casing|prowl\w*|trespass\w*|vandal\w*|porch pirates?)\b/i;

// ─── Plain rules ───────────────────────────────────────────────────────────

// Phone numbers as people write them in the US: (541) 555-0142, 541-555-0142, 541.555.0142,
// 541 555 0142, +1 541 555 0142, 5415550142, and a local 555-0142; never part of a longer number,
// a price or an order number ("#123-4567").
const PHONE = /(?<![\d$#])(?:(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\d{3}[\s.-]?)\d{3}[\s.-]?\d{4}|\d{3}[.-]\d{4})(?!\d)/;

const STREET_SUFFIXES = new Set(['street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'blvd', 'lane', 'ln',
  'drive', 'dr', 'court', 'ct', 'place', 'pl', 'way', 'terrace', 'ter', 'circle', 'cir', 'parkway', 'pkwy', 'highway',
  'hwy', 'loop', 'trail', 'trl']);
const DIRECTION = /^(?:[NSEW]|NE|NW|SE|SW|North|South|East|West)$/i;
const ORDINAL = /^\d+(?:st|nd|rd|th)$/i;
// A number followed by one of these counts something ("30 minutes on Hwy 35").
const COUNTED = new Set(['minutes', 'minute', 'mins', 'hours', 'hour', 'days', 'weeks', 'months', 'years', 'miles', 'mile',
  'blocks', 'block', 'feet', 'ft', 'yards', 'times', 'people', 'kids', 'dogs', 'cats', 'cars']);

/**
 * The first street address in a text ("123 Main St", "4512 NE Fremont Street", "88 5th Ave"):
 * a house number, one to three name words, a street word. The name words are capitalized, or
 * one plain word comes before a short street word ("123 main st"), so "2 dogs on the way" isn't one.
 */
function streetAddressIn(text) {
  const tokens = [...String(text || '').matchAll(/[\p{L}\p{N}][\p{L}\p{N}'.-]*/gu)]
    .map((match) => ({ word: match[0].replace(/\.+$/, ''), at: match.index, end: match.index + match[0].length }));
  for (let i = 0; i < tokens.length; i += 1) {
    if (!/^\d{1,6}[A-Za-z]?$/.test(tokens[i].word)) continue;
    for (let j = i + 2; j <= Math.min(i + 4, tokens.length - 1); j += 1) {
      const suffix = tokens[j].word.toLowerCase();
      if (!STREET_SUFFIXES.has(suffix)) continue;
      const names = tokens.slice(i + 1, j);
      if (COUNTED.has(names[0].word.toLowerCase())) break;
      const named = names.every(({ word }) => /^\p{Lu}/u.test(word) || ORDINAL.test(word) || DIRECTION.test(word));
      const plain = names.filter(({ word }) => !DIRECTION.test(word)).length;
      if (named || (plain <= 1 && suffix.length <= 4)) {
        return String(text).slice(tokens[i].at, tokens[j].end).replace(/\s+/g, ' ');
      }
      break;
    }
  }
  return null;
}

/** What the plain rules find: a phone number, and a street address except in an event (its venue). */
function plainFindings({ text, postType }) {
  const findings = [];
  const phone = PHONE.exec(text)?.[0];
  if (phone) {
    findings.push({ kind: 'phone', text: phone.trim(), message: `It includes a phone number (${phone.trim()}). Anyone who can see this post can read it.` });
  }
  const address = postType === 'event' ? null : streetAddressIn(text);
  if (address) {
    findings.push({ kind: 'address', text: address, message: `It includes a street address (${address}). Anyone who can see this post can read it.` });
  }
  return findings;
}

// ─── The model's judgment ──────────────────────────────────────────────────

/**
 * The model's verdict on the draft's tone (and, for a Heads-up, whether it reports a crime), or
 * null when the call was skipped or failed. Never throws.
 */
async function judge({ userId, title, content, postType }) {
  const blocked = await checkChatBudget(userId);
  if (blocked) {
    logger.info('Post check: tone skipped', { userId, reason: blocked.error });
    return null;
  }
  const client = getAnthropicClient();
  if (!client) return null;

  // Required here: agentService loads the chat's tools, which nothing above needs.
  const { logRequest } = require('./agentService');
  const draft = JSON.stringify({ title_text: clip(title, 255), body_text: clip(content, 4000) });
  const started = Date.now();
  try {
    const result = await complete({
      client,
      model: DRAFT_MODEL,
      system: prompts.POST_CHECK_SYSTEM,
      messages: [{ role: 'user', content: [{ type: 'text', text: `Kind of post: ${TYPE_NAMES[postType] || 'Post'}\nThe draft, written by the person posting (JSON): ${draft}` }] }],
      schema: VERDICT_SCHEMA,
      effort: 'low',
      maxTokens: MAX_TOKENS,
      timeoutMs: TIMEOUT_MS,
    });
    const verdict = JSON.parse(result.text);
    await logRequest({
      userId, endpoint: ENDPOINT, model: DRAFT_MODEL, promptVersion: prompts.VERSIONS.postCheck, status: 'ok',
      latencyMs: Date.now() - started, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
    });
    return verdict;
  } catch (err) {
    let status = 'error';
    if (err instanceof AIRefusalError) status = 'refusal';
    else if (isTimeoutError(err)) status = 'timeout';
    else if (err instanceof SyntaxError) status = 'invalid';
    logger.warn('Post check: tone failed', { userId, status, error: err.message });
    await logRequest({
      userId, endpoint: ENDPOINT, model: DRAFT_MODEL, promptVersion: prompts.VERSIONS.postCheck, status,
      latencyMs: Date.now() - started, errorMessage: err.message, schemaValid: status !== 'invalid',
    });
    return null;
  }
}

// ─── The check ─────────────────────────────────────────────────────────────

/**
 * What the check found in a draft, most important first: each `{ kind, message, text? }`, kind
 * one of heads_up_kind, tone, phone, address. Empty when nothing needs a second look.
 *
 * @param {object} p
 * @param {string} p.userId
 * @param {string} [p.title]
 * @param {string} p.content
 * @param {string} [p.postType]
 * @param {string|null} [p.kindRefusal]  The create route's sentence refusing the Heads-up kind, if it would.
 */
async function checkPost({ userId, title, content, postType, kindRefusal = null }) {
  const text = [title, content].filter((part) => typeof part === 'string' && part.trim()).join('\n');
  if (!text.trim()) return [];
  const verdict = text.trim().length >= MIN_MODEL_CHARS ? await judge({ userId, title, content, postType }) : null;

  const findings = [];
  const isHeadsUp = postType === 'alert';
  if (kindRefusal) {
    findings.push({ kind: 'heads_up_kind', message: kindRefusal });
  } else if (isHeadsUp && (verdict ? verdict.about_crime === true : CRIME_WORDS.test(text))) {
    findings.push({ kind: 'heads_up_kind', message: CRIME_MESSAGE });
  }
  const lower = text.toLowerCase();
  if (verdict ? verdict.heated === true : RANT_WORDS.filter((word) => lower.includes(word)).length >= 2) {
    findings.push({ kind: 'tone', message: TONE_MESSAGES[verdict?.heated_because] || TONE_MESSAGES.none });
  }
  findings.push(...plainFindings({ text, postType }));
  return findings;
}

module.exports = { checkPost, streetAddressIn, plainFindings, ENDPOINT };
