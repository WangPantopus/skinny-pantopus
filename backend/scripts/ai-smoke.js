#!/usr/bin/env node

/**
 * Live smoke test for the Claude integration: the real Anthropic API, no database.
 *
 * Checks what no stand-in can prove:
 *   - the API accepts every response schema and every chat tool definition;
 *   - a chat turn streams, runs a tool and answers, and the stored transcript it
 *     leaves replays cleanly on the next turn (and the prompt cache reads back);
 *   - photos (a base64 image block) are read;
 *   - how long each kind of call takes at the configured effort.
 *
 * Usage (about 15 small requests, a few cents):
 *   ANTHROPIC_API_KEY=sk-ant-... node backend/scripts/ai-smoke.js
 *   ANTHROPIC_API_KEY=sk-ant-... node backend/scripts/ai-smoke.js --drafts-only
 *   ANTHROPIC_API_KEY=sk-ant-... node backend/scripts/ai-smoke.js --chat-only
 *
 * Models and effort follow the same ANTHROPIC_* variables as the backend
 * (backend/.env.example). Exits non-zero if any check fails.
 */

// The services load the Supabase client when imported; nothing here queries it.
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:1';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'ai-smoke';

const { getAnthropicClient, resolveEffort, CHAT_MODEL, DRAFT_MODEL } = require('../config/anthropic');
const llm = require('../services/ai/llm');
const loop = require('../services/ai/agentLoop');
const prompts = require('../services/ai/prompts');
const schemas = require('../services/ai/schemas');
const { toolDefinitions, executeTool } = require('../services/ai/tools');

const args = new Set(process.argv.slice(2));
const draftsOnly = args.has('--drafts-only');
const chatOnly = args.has('--chat-only');

const DRAFT_EFFORT = resolveEffort(process.env.ANTHROPIC_DRAFT_EFFORT, 'low');
const SUPPORT_TRAIN_EFFORT = resolveEffort(process.env.ANTHROPIC_SUPPORT_TRAIN_EFFORT, 'medium');
const CHAT_EFFORT = resolveEffort(process.env.ANTHROPIC_CHAT_EFFORT, 'low');

// Claude Sonnet 5.5 list prices, USD per million tokens.
const PRICE = { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 };

const results = [];
const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function record(name, ok, ms, detail = '') {
  results.push({ name, ok, ms });
  const label = ok ? 'ok  ' : 'FAIL';
  console.log(`${label}  ${String(ms).padStart(6)} ms  ${name}${detail ? `  — ${detail}` : ''}`);
}

function addUsage(usage) {
  totals.input += usage.inputTokens - (usage.cacheReadTokens || 0) - (usage.cacheWriteTokens || 0);
  totals.output += usage.outputTokens;
  totals.cacheRead += usage.cacheReadTokens || 0;
  totals.cacheWrite += usage.cacheWriteTokens || 0;
}

async function attempt(name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    record(name, true, Date.now() - start, detail || '');
  } catch (err) {
    const status = err.status ? `HTTP ${err.status} ` : '';
    record(name, false, Date.now() - start, `${status}${String(err.message || err).slice(0, 300)}`);
  }
}

async function jsonDraft(client, { name, system, user, schema, validate, effort = DRAFT_EFFORT }) {
  await attempt(`draft: ${name}`, async () => {
    const reply = await llm.complete({
      client, model: DRAFT_MODEL, system, effort, schema,
      messages: [{ role: 'user', content: user }], maxTokens: 4096, timeoutMs: 60000,
    });
    addUsage({ inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });
    const draft = JSON.parse(reply.text);
    if (!validate(draft)) throw new Error(`reply failed the server-side validator: ${JSON.stringify(validate.errors).slice(0, 200)}`);
    return `${reply.outputTokens} output tokens`;
  });
}

async function drafts(client) {
  console.log(`\nDrafts and summaries (${DRAFT_MODEL}, effort ${DRAFT_EFFORT}; support train ${SUPPORT_TRAIN_EFFORT})`);
  await jsonDraft(client, {
    name: 'task (gig)', system: prompts.GIG_DRAFT_SYSTEM, schema: schemas.claudeSchemas.gigDraft, validate: schemas.validateGigDraft,
    user: 'I need help moving a couch from my apartment to a house across town this Saturday morning. Budget is around $80.',
  });
  await jsonDraft(client, {
    name: 'marketplace listing', system: prompts.LISTING_DRAFT_SYSTEM, schema: schemas.claudeSchemas.listingDraft, validate: schemas.validateListingDraft,
    user: 'Selling a three-seat blue couch in good condition for $80. Porch pickup in Camas.',
  });
  await jsonDraft(client, {
    name: 'community post', system: prompts.POST_DRAFT_SYSTEM, schema: schemas.claudeSchemas.postDraft, validate: schemas.validatePostDraft,
    user: 'Lost a grey cat named Pepper near Elm Street in Vancouver, WA. Please message me if you see him.\n\n[Posting to: place feed]',
  });
  await jsonDraft(client, {
    name: 'mail summary', system: prompts.MAIL_SUMMARY_SYSTEM, schema: schemas.claudeSchemas.mailSummary, validate: schemas.validateMailSummary,
    user: 'Subject: Water bill\nFrom: City Water\nCategory: bill\nType: bill\nUrgency: due_soon\nDue Date: 2026-10-16\nContent: Your bill of $42.10 for September is due Friday, October 16.\nExisting Key Facts: []',
  });
  await jsonDraft(client, {
    name: 'place brief', system: prompts.PLACE_BRIEF_SYSTEM, schema: schemas.claudeSchemas.placeBrief, validate: schemas.validatePlaceBrief,
    user: 'Place: Home (Vancouver, WA)\n\nWeather Alerts (NOAA):\n- Frost Advisory (Minor): Frost possible tonight. Cover sensitive plants.',
  });
  await jsonDraft(client, {
    name: 'support train', system: prompts.SUPPORT_TRAIN_DRAFT_SYSTEM, schema: schemas.claudeSchemas.supportTrainDraft, validate: schemas.validateSupportTrainDraft,
    effort: SUPPORT_TRAIN_EFFORT,
    user: 'My neighbor Maria just had surgery. She and her husband have a toddler. She is allergic to peanuts and they eat vegetarian. We would like to bring dinners three nights a week for a month.',
  });

  await attempt('text: one-line mail opening', async () => {
    const reply = await llm.complete({
      client, model: DRAFT_MODEL, system: prompts.MAIL_OPENING_SYSTEM, effort: DRAFT_EFFORT, maxTokens: 1024, timeoutMs: 60000,
      messages: [{ role: 'user', content: 'Intent: personal_note\nInk: ivory\nRecipient: Sam' }],
    });
    addUsage({ inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });
    if (!reply.text.trim()) throw new Error('empty reply');
    return `"${reply.text.trim().slice(0, 70)}"`;
  });

  await attempt('vision: one base64 photo -> listing draft', async () => {
    // A 1x1 PNG: enough to prove the image block is accepted and read.
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';
    const reply = await llm.complete({
      client, model: DRAFT_MODEL, system: prompts.LISTING_DRAFT_SYSTEM, effort: DRAFT_EFFORT, schema: schemas.claudeSchemas.listingDraft,
      maxTokens: 4096, timeoutMs: 60000,
      messages: [{ role: 'user', content: [llm.imageBlock(png), { type: 'text', text: 'Describe this item for a marketplace listing.' }] }],
    });
    addUsage({ inputTokens: reply.inputTokens, outputTokens: reply.outputTokens });
    JSON.parse(reply.text);
    return `${reply.inputTokens} input tokens`;
  });
}

// Canned answers for the tools a chat turn may call; create_post_draft runs for real (it needs no database).
async function runChatTool(use) {
  const canned = {
    get_user_context: { homes: [{ label: 'Home', city: 'Vancouver', state: 'WA' }], saved_places: [], recent_activity: { gigs_posted: 0, listings_posted: 0, posts_made: 0 } },
    get_place_alerts: { place: { label: 'Home', city: 'Vancouver', state: 'WA' }, alerts: [{ event: 'Frost Advisory', severity: 'Minor', headline: 'Frost possible tonight', instruction: 'Cover sensitive plants.' }], source: 'smoke', fetched_at: new Date().toISOString() },
  };
  const result = use.name in canned ? canned[use.name] : await executeTool(use.name, use.input || {}, 'smoke-user');
  return { type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(result), ...(result.error ? { is_error: true } : {}) };
}

async function chat(client) {
  console.log(`\nChat agent (${CHAT_MODEL}, effort ${CHAT_EFFORT}, ${toolDefinitions.length} tools)`);
  const system = llm.systemBlocks(prompts.CHAT_AGENT_SYSTEM);
  let stored = [];

  async function turn(label, message, { expectTool } = {}) {
    await attempt(`chat: ${label}`, async () => {
      const start = Date.now();
      let firstTextMs = null;
      const usage = llm.emptyUsage();
      const history = loop.sanitizeHistory(stored);
      const result = await loop.runAgentTurn({
        client, model: CHAT_MODEL, system, tools: toolDefinitions, effort: CHAT_EFFORT, maxTokens: 4096, maxRounds: 5,
        messages: [...history, { role: 'user', content: message }],
        signal: AbortSignal.timeout(60000), usage, runTool: runChatTool,
        onText: () => { if (firstTextMs === null) firstTextMs = Date.now() - start; },
      });
      addUsage(usage);
      if (result.outcome !== 'complete') throw new Error(`turn ended as "${result.outcome}"`);
      // Only what this turn produced, not the tool calls replayed from earlier turns.
      const toolNames = result.messages.slice(history.length + 1).flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === 'tool_use').map((b) => b.name);
      if (expectTool && !toolNames.includes(expectTool)) throw new Error(`expected a ${expectTool} call, got [${toolNames.join(', ') || 'none'}]`);
      stored = loop.compactForStorage(result.messages);
      if (loop.sanitizeHistory(stored).length !== stored.length) throw new Error('the stored transcript does not survive sanitizing');
      return `first text ${firstTextMs} ms, tools [${toolNames.join(', ') || 'none'}], cache read ${usage.cacheReadTokens} tokens`;
    });
  }

  await turn('turn 1 (tool call, streamed answer)', 'What weather alerts are active near my home?', { expectTool: 'get_place_alerts' });
  // Turn 2 is sent the stored transcript from turn 1: this is the stateless replay the old design never needed.
  await turn('turn 2 (replays the stored transcript)', 'Thanks. Write a short post telling neighbors to cover their plants tonight.', { expectTool: 'create_post_draft' });
  await turn('turn 3 (plain follow-up, no tool)', 'Make it friendlier.');
}

(async () => {
  const client = getAnthropicClient();
  if (!client) {
    console.error('ANTHROPIC_API_KEY is not set.');
    process.exit(2);
  }
  console.log(`Claude smoke test against ${process.env.ANTHROPIC_BASE_URL || 'api.anthropic.com'}`);

  if (!chatOnly) await drafts(client);
  if (!draftsOnly) await chat(client);

  const failed = results.filter((r) => !r.ok);
  const times = results.filter((r) => r.ok).map((r) => r.ms).sort((a, b) => a - b);
  const cost = (totals.input * PRICE.input + totals.output * PRICE.output + totals.cacheWrite * PRICE.cacheWrite + totals.cacheRead * PRICE.cacheRead) / 1e6;
  console.log(`\n${results.length - failed.length}/${results.length} passed`
    + (times.length ? `; median ${times[Math.floor(times.length / 2)]} ms, slowest ${times.at(-1)} ms` : '')
    + `; tokens in ${totals.input} + cached ${totals.cacheRead} read / ${totals.cacheWrite} written, out ${totals.output}; about $${cost.toFixed(4)}`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('smoke test crashed:', err);
  process.exit(2);
});
