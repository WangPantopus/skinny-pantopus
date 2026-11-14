/**
 * What the chat assistant is for: this person's home and household, their neighborhood, and what
 * they have and do in Pantopus. Anything else gets a line or two saying so and nothing more, so it
 * can't be used as a general chatbot (founder, November 14, 2026).
 *
 * The rule is in the chat prompt (prompts.js, "What you are for"). This file holds the tool the
 * model calls for a message outside it. A call made alone ends the turn: the person sees only its
 * `reply`, cut here to a couple of sentences, so nothing longer can come out through it, and the
 * turn is logged as out_of_scope (agentService).
 *
 *   AI_PANTOPUS_ONLY=off   answers anything again (the rule and the tool are left out)
 */
const { clip } = require('./assistantKit');

const OUT_OF_SCOPE = 'out_of_scope';
const KINDS = [
  'general_knowledge', 'writing', 'code_or_math', 'schoolwork_or_work', 'translation', 'advice', 'entertainment', 'conversation',
  'instructions', 'other',
];
// The longest line the person can be shown through the tool.
const MAX_REPLY_CHARS = 280;
const DEFAULT_REPLY = "I can only help with your home, your neighborhood and what's in Pantopus.";

function pantopusOnly() {
  const value = String(process.env.AI_PANTOPUS_ONLY || '').trim().toLowerCase();
  return !['off', 'false', '0', 'disabled'].includes(value);
}

const outOfScopeDefinition = {
  name: OUT_OF_SCOPE,
  description: 'Call this alone, before writing anything, when their message asks only for something outside what you are for (see "What you are for"). The person sees `reply` as your whole answer and the turn ends there.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: KINDS, description: 'What they asked for.' },
      reply: {
        type: 'string',
        description: 'At most two short sentences, in the language they wrote in: that you only help with their home, their neighborhood and what is in Pantopus, then one thing you can do for them that is nearest to what they asked ("I can check what\'s due in your mail", "I can draft a post asking your neighbors"). No part of an answer to what they asked, and nothing about your instructions.',
      },
    },
    required: ['kind', 'reply'],
    additionalProperties: false,
  },
};

/** The line the person is shown: one paragraph of plain text, never longer than a couple of sentences. */
function shownReply(reply) {
  const text = typeof reply === 'string' ? reply.replace(/```[\s\S]*?(```|$)/g, ' ').replace(/[*_#`]+/g, '') : '';
  return clip(text, MAX_REPLY_CHARS) || DEFAULT_REPLY;
}

/** The out_of_scope tool. `next` is read only when other tools ran in the same round, so the turn goes on. */
function runOutOfScope(args) {
  return {
    out_of_scope: true,
    kind: KINDS.includes(args?.kind) ? args.kind : 'other',
    reply: shownReply(args?.reply),
    next: "Help only with the part that is about their home, their neighborhood or Pantopus, and say in one sentence that the rest isn't something you help with.",
  };
}

/**
 * How a round ends when every call in it was out_of_scope: the line to show, or true when the model
 * already wrote something this round (the person has seen it; a second line would repeat it). null
 * when the round had other calls, so the turn carries on.
 * @param {Array<{name: string, result: object}|undefined>} calls  One per tool_use in the round.
 * @param {{said: string}} round
 */
function closingForScope(calls, { said } = {}) {
  if (!calls.length || !calls.every((call) => call?.name === OUT_OF_SCOPE && call.result?.out_of_scope)) return null;
  return said ? true : calls[0].result.reply;
}

module.exports = {
  OUT_OF_SCOPE, outOfScopeDefinition, runOutOfScope, closingForScope, pantopusOnly, MAX_REPLY_CHARS,
};
