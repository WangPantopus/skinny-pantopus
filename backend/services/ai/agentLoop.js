/**
 * The chat assistant's turn, and the stored transcript it depends on.
 *
 * A turn streams Claude's reply, runs the tools it asks for, and streams again
 * until it answers in text. The Messages API is stateless, so every turn is
 * sent the conversation so far; AIConversation.messages keeps it, in the
 * compact form the helpers below produce and check.
 *
 * Nothing here touches the database or the SSE response: agentService hands
 * those in as callbacks, which lets a script drive a real turn.
 */
const { addUsage, emptyUsage } = require('./llm');

// A stored conversation keeps at most 60 messages (about 20 turns with their
// tool calls). Past that it is cut back to about 40, so the start of the history,
// which is what the prompt cache matches on, stays put for several turns instead
// of moving (and missing the cache) on every one. Older turns are dropped whole,
// so what is kept still starts on a person's message and never splits a tool
// call from its result.
const MAX_STORED_MESSAGES = 60;
const TRIMMED_STORED_MESSAGES = 40;
// Tool results are only context for follow-ups; the full text is not worth keeping.
const MAX_STORED_TOOL_RESULT_CHARS = 4000;
// What one turn is sent of the stored transcript, whatever it holds: older turns
// are left out until it fits, so a bloated row can't slow every reply. (The turn
// is saved from what it was sent, so they are dropped then.)
const MAX_REPLAY_CHARS = 200_000;

const isBlank = (text) => typeof text !== 'string' || text.trim() === '';

/**
 * Wait for `promise`, but give up the moment `signal` aborts. The turn's
 * deadline (and a client that left) must end the turn even if a tool is stuck.
 */
function raceAbort(promise, signal) {
  if (!signal) return promise;
  const aborted = () => Object.assign(new Error('The turn was aborted'), { name: 'AbortError' });
  if (signal.aborted) return Promise.reject(aborted());
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(aborted());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => { signal.removeEventListener('abort', onAbort); resolve(value); },
      (err) => { signal.removeEventListener('abort', onAbort); reject(err); },
    );
  });
}

// ── Turn ────────────────────────────────────────────────────────────────

/**
 * @param {object} p
 * @param {import('@anthropic-ai/sdk').Anthropic} p.client
 * @param {string}   p.model
 * @param {Array}    p.system            System blocks (see llm.systemBlocks).
 * @param {Array}    p.tools             Tool definitions (name, description, input_schema).
 * @param {Array}    p.messages          The conversation so far, ending with the person's new message.
 * @param {string}   p.effort
 * @param {number}   p.maxTokens         Per reply, thinking included.
 * @param {number}   p.maxRounds         Reply-then-tools rounds before giving up.
 * @param {AbortSignal} [p.signal]       Deadline / client disconnect.
 * @param {object}   [p.usage]           Token totals, filled in as rounds finish. Pass your own to
 *                                       still have what the finished rounds used when the turn throws.
 * @param {(use: object) => Promise<object>} p.runTool   Runs one tool_use block, resolves to its tool_result block.
 * @param {(delta: string) => void} p.onText             Called with each piece of reply text as it streams.
 * @param {(name: string) => void} [p.onToolStart]       Called when Claude starts a tool call, before its input is complete.
 * @param {(uses: object[]) => (string|null)} [p.finishAfterTools]  After a round's tools ran: the closing line that ends
 *                                       the turn there (a draft is the answer, shown as a card), or null to carry on.
 * @returns {Promise<{messages: Array, usage: object, toolCalls: number, outcome: string, stopReason: string|null, category?: string|null}>}
 *   outcome: 'complete' | 'refused' | 'truncated' | 'empty' | 'tool_limit'. Rejects when the signal aborts or the API fails.
 */
async function runAgentTurn({
  client, model, system, tools, messages, effort, maxTokens, maxRounds, signal, runTool, onText,
  onToolStart, finishAfterTools,
  usage = emptyUsage(),
}) {
  const working = [...messages];
  let toolCalls = 0;
  let spoke = false;
  let stopReason = null;
  const finish = (outcome, extra = {}) => ({ messages: working, usage, toolCalls, outcome, stopReason, ...extra });

  for (let round = 1; round <= maxRounds; round++) {
    // The last round has to answer in words: a turn that ends on yet another tool
    // call has nothing to show or remember. (Changing tool_choice keeps the cache.)
    const mustAnswer = maxRounds > 1 && round === maxRounds;
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system,
      // No eager_input_streaming on the tools: their inputs are small and only used once
      // complete, so streaming them early would buy nothing and give up the API's validation.
      tools,
      messages: working,
      // Caches the conversation up to its last block, so each round of the loop and
      // each later turn re-reads what came before instead of re-processing it.
      cache_control: { type: 'ephemeral' },
      output_config: { effort },
      ...(mustAnswer ? { tool_choice: { type: 'none' } } : {}),
    }, { signal });

    if (onToolStart) {
      // A tool call starts well before its input is complete (a draft takes a second
      // or two to write), so the person can be told what is happening meanwhile.
      stream.on('streamEvent', (event) => {
        if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
          onToolStart(event.content_block.name);
        }
      });
    }

    let roundSpoke = false;
    stream.on('text', (delta) => {
      // A reply never opens with blank lines (a block can start with a newline).
      const text = spoke ? delta : (delta || '').replace(/^\s+/, '');
      if (!text) return;
      // Text before a tool call and the answer after it arrive as separate
      // blocks; keep them apart on screen.
      if (!roundSpoke && spoke) onText('\n\n');
      roundSpoke = true;
      spoke = true;
      onText(text);
    });

    const message = await stream.finalMessage();
    addUsage(usage, message.usage);
    stopReason = message.stop_reason;

    // The reply goes back as sent, thinking blocks included: the model needs them to
    // continue its own tool use. The one exception is a text block of only whitespace,
    // which the API refuses to take back as input.
    const content = message.content.filter((block) => block.type !== 'text' || !isBlank(block.text));
    if (content.length) working.push({ role: 'assistant', content });

    if (message.stop_reason === 'refusal') {
      return finish('refused', { category: message.stop_details?.category || null });
    }

    const uses = content.filter((block) => block.type === 'tool_use');
    if (message.stop_reason === 'max_tokens' && uses.length) {
      // A tool call cut off mid-input: never run it.
      return finish('truncated');
    }
    if (message.stop_reason !== 'tool_use' || uses.length === 0) {
      // Nothing the person can read (a reply that was all thinking, or ran out of room
      // before it wrote anything) is a failure, not an answer.
      return finish(content.some((block) => block.type === 'text') ? 'complete' : 'empty');
    }

    toolCalls += uses.length;
    // All results go back in one message, which is what keeps Claude calling tools in parallel.
    const results = await raceAbort(Promise.all(uses.map((use) => runTool(use))), signal);
    working.push({ role: 'user', content: results });

    // A draft is the answer: the person already sees it as a card. End the turn with
    // its closing line rather than a second request that would only describe it
    // (on Claude Sonnet 5.5 a reply after a tool result arrives all at once, late).
    const closing = finishAfterTools ? finishAfterTools(uses) : null;
    if (typeof closing === 'string' && closing.trim()) {
      if (spoke) onText('\n\n');
      onText(closing.trim());
      working.push({ role: 'assistant', content: [{ type: 'text', text: closing.trim() }] });
      return finish('complete');
    }
  }

  return finish('tool_limit');
}

// ── Stored transcript ───────────────────────────────────────────────────

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const blocksOf = (message) => (Array.isArray(message.content) ? message.content : []);
const toolUseIds = (message) => blocksOf(message).filter((b) => b.type === 'tool_use').map((b) => b.id);
const toolResultIds = (message) => blocksOf(message).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id);

/** A message a person wrote (text or photos), as opposed to the user-role message that carries tool results. */
function isTurnStart(message) {
  if (message.role !== 'user') return false;
  if (typeof message.content === 'string') return message.content.length > 0;
  return blocksOf(message).some((block) => block.type !== 'tool_result');
}

/**
 * One stored block as it may be replayed, or null. Only what compactForStorage
 * writes is accepted (text, tool calls, tool results), so a damaged or hand-edited
 * row can't smuggle photos, thinking blocks or oddly shaped content into a request.
 */
function replayableBlock(block) {
  if (!isObject(block)) return null;
  if (block.type === 'text') return isBlank(block.text) ? null : { type: 'text', text: block.text };
  if (block.type === 'tool_use') {
    if (typeof block.id !== 'string' || typeof block.name !== 'string') return null;
    return { type: 'tool_use', id: block.id, name: block.name, input: isObject(block.input) ? block.input : {} };
  }
  if (block.type === 'tool_result') {
    if (typeof block.tool_use_id !== 'string') return null;
    return {
      type: 'tool_result',
      tool_use_id: block.tool_use_id,
      content: typeof block.content === 'string' && block.content ? block.content : '{}',
      ...(block.is_error ? { is_error: true } : {}),
    };
  }
  return null;
}

function replayableMessage(message) {
  if (!isObject(message)) return null;
  if (message.role === 'system') {
    // Pantopus's context for a turn (agentService), kept as plain text.
    return typeof message.content === 'string' && !isBlank(message.content) ? { role: 'system', content: message.content } : null;
  }
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  // Rebuilt rather than passed through, so a stray key in a stored row can't reach the API.
  if (typeof message.content === 'string') return isBlank(message.content) ? null : { role: message.role, content: message.content };
  if (!Array.isArray(message.content)) return null;
  const content = message.content.map(replayableBlock).filter(Boolean);
  return content.length ? { role: message.role, content } : null;
}

/** The last stretch of `messages` that fits the replay budget, starting on a person's message. */
function trimToBudget(messages, budget = MAX_REPLAY_CHARS) {
  let total = 0;
  let start = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    total += JSON.stringify(messages[i]).length;
    if (total > budget) break;
    start = i;
  }
  while (start < messages.length && !isTurnStart(messages[start])) start++;
  return messages.slice(start);
}

/**
 * The stored transcript, checked before it is sent: Claude rejects a tool call
 * without its result (and the reverse), so a transcript damaged by a partial
 * write is cut where it stops making sense instead of failing every later turn.
 */
function sanitizeHistory(stored) {
  if (!Array.isArray(stored)) return [];
  const messages = stored.map(replayableMessage).filter(Boolean);

  const first = messages.findIndex(isTurnStart);
  if (first === -1) return [];

  const kept = [];
  for (let i = first; i < messages.length; i++) {
    const message = messages[i];

    if (message.role === 'system') {
      // The API takes a system message only right after a user message; Pantopus adds
      // its context right after the person's message, and anything else is dropped.
      const previous = kept[kept.length - 1];
      if (previous && isTurnStart(previous)) kept.push(message);
      continue;
    }

    const calls = message.role === 'assistant' ? toolUseIds(message) : [];
    if (calls.length) {
      const next = messages[i + 1];
      const answered = new Set(next && next.role === 'user' ? toolResultIds(next) : []);
      if (!calls.every((id) => answered.has(id))) break;
    }

    const results = message.role === 'user' ? toolResultIds(message) : [];
    if (results.length) {
      const previous = kept[kept.length - 1];
      const open = new Set(previous && previous.role === 'assistant' ? toolUseIds(previous) : []);
      if (!results.every((id) => open.has(id))) break;
    }

    kept.push(message);
  }

  // A stored transcript ends on an answer, never mid-tool-call.
  while (kept.length) {
    const last = kept[kept.length - 1];
    if (last.role === 'assistant' && !toolUseIds(last).length) break;
    kept.pop();
  }
  return trimToBudget(kept);
}

const clip = (text) => (typeof text === 'string' && text.length > MAX_STORED_TOOL_RESULT_CHARS
  ? `${text.slice(0, MAX_STORED_TOOL_RESULT_CHARS)}…[truncated]`
  : text);

// jsonb refuses a NUL character and a lone surrogate half (clipping can split an emoji),
// and one such string would otherwise cost the conversation its memory.
const scrub = (text) => {
  const clean = text.replace(/\u0000/g, '');
  return typeof clean.toWellFormed === 'function' ? clean.toWellFormed() : clean;
};
const scrubDeep = (value) => JSON.parse(JSON.stringify(value, (_key, v) => (typeof v === 'string' ? scrub(v) : v)));

/**
 * What to keep of a finished turn's messages:
 *   - text, tool calls and tool results, as sent and received;
 *   - not thinking blocks (the transcript is edited as it grows, which would
 *     invalidate them, and the model doesn't need its old reasoning);
 *   - not photos, which are fetched afresh on every request and cost tokens each
 *     time; a placeholder says one was there, and the reply that described it stays;
 *   - not text that is only whitespace, which the API refuses as input.
 */
function compactForStorage(messages) {
  const compact = [];
  for (const message of messages) {
    if (message.role === 'system') {
      if (typeof message.content === 'string' && !isBlank(message.content)) compact.push({ role: 'system', content: scrub(message.content) });
      continue;
    }
    const blocks = typeof message.content === 'string'
      ? [{ type: 'text', text: message.content }]
      : blocksOf(message);

    const kept = [];
    let photos = 0;
    for (const block of blocks) {
      if (block.type === 'text') {
        if (!isBlank(block.text)) kept.push({ type: 'text', text: scrub(block.text) });
      } else if (block.type === 'tool_use') {
        kept.push({ type: 'tool_use', id: block.id, name: block.name, input: scrubDeep(block.input ?? {}) });
      } else if (block.type === 'tool_result') {
        kept.push({
          type: 'tool_result',
          tool_use_id: block.tool_use_id,
          content: scrub(clip(typeof block.content === 'string' ? block.content : '') || '{}'),
          ...(block.is_error ? { is_error: true } : {}),
        });
      } else if (block.type === 'image') {
        photos += 1;
      }
    }
    if (photos) {
      // Say the photo was seen. A bare "[Photo attached]" led Claude to doubt, and retract, its own earlier description.
      const note = photos === 1
        ? '[Photo attached. You saw it when you replied; it is not included again. Go by your earlier reply, or ask them to send it again if you need a closer look.]'
        : `[${photos} photos attached. You saw them when you replied; they are not included again. Go by your earlier reply, or ask them to send them again if you need a closer look.]`;
      kept.unshift({ type: 'text', text: note });
    }
    if (kept.length) compact.push({ role: message.role, content: kept });
  }

  if (compact.length <= MAX_STORED_MESSAGES) return compact;
  let start = compact.length - TRIMMED_STORED_MESSAGES;
  while (start < compact.length && !isTurnStart(compact[start])) start++;
  return compact.slice(start);
}

module.exports = {
  runAgentTurn,
  sanitizeHistory,
  compactForStorage,
  MAX_STORED_MESSAGES,
  MAX_REPLAY_CHARS,
};
