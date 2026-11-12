/**
 * "Help me write it" on a Christmas card's write step (launch key `card_note_help`, founder decision 2026-11-11):
 * three short notes for the back of the card, from the picture the sender picked, who it's to and, if they like, one
 * line about what to mention. The sender picks one and edits it; nothing here sends or stores a card.
 *
 * This file is the parts without a model call: what the model is told about the card, the shape of its answer and
 * the checks on what comes back. agentService.suggestCardNote makes the call.
 */
const holidayCards = require('../holidayCards');
const { toClaudeSchema } = require('./schemas');

// The three ways a note can say it, in the order the apps show them.
const TONES = ['heartfelt', 'light', 'brief'];
// What the sender may add: one line to mention, and the notes they passed over ("Try again").
const HINT_LIMIT = 200;
const NAME_LIMIT = 60;
const PASSED_OVER_MAX = 6;
// Asked of the model, under the card's own limit: a model counts letters loosely.
const TARGET_LETTERS = 240;

const cardNoteJsonSchema = {
  type: 'object',
  properties: {
    notes: {
      type: 'array',
      maxItems: TONES.length,
      items: {
        type: 'object',
        properties: {
          tone: { type: 'string', enum: TONES },
          text: { type: 'string' },
        },
        required: ['tone', 'text'],
      },
    },
  },
  required: ['notes'],
};
const cardNoteClaudeSchema = toClaudeSchema(cardNoteJsonSchema);

const letters = (text) => [...text].length;
const oneLine = (text) => String(text || '').replace(/\s+/g, ' ').trim();

/** The first names the card is to, as the app shows them: trimmed, no repeats, none empty. */
function namesOf(to) {
  const seen = new Set();
  return (Array.isArray(to) ? to : []).map(oneLine).filter((name) => {
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Who the note greets: one or two people by name; a longer list gets the same words, so no one's name. */
function toLine(names, count) {
  const people = Math.max(names.length, Number(count) || 0);
  if (people > 2) return `To: ${people} people, each getting this same note (name no one)`;
  if (names.length === 0) return people === 2 ? 'To: two people, not named (name no one)' : 'To: not named (name no one)';
  if (names.length === 1 && people === 2) return 'To: two people, each getting this same note (name no one)';
  return `To: ${names.join(' and ')}`;
}

/**
 * What the model reads about this card. The sender's own words sit inside tags, as information about the note.
 * `design` is a picture from holidayCards.designById.
 */
function userContent({ design, to, count, hint, note, passedOver }) {
  const collection = holidayCards.COLLECTIONS.find((c) => c.id === design.collection);
  const lines = [
    `Card picture: caption "${design.caption}"${collection ? `, from the collection "${collection.name}" (${collection.line})` : ''}`,
    toLine(namesOf(to), count),
  ];
  const mention = oneLine(hint);
  if (mention) lines.push(`The sender wants to mention:\n<mention>\n${mention}\n</mention>`);
  const written = String(note || '').trim();
  if (written) lines.push(`What the sender has written so far:\n<written>\n${written}\n</written>`);
  const earlier = (passedOver || []).map((text) => String(text || '').trim()).filter(Boolean).slice(0, PASSED_OVER_MAX);
  if (earlier.length) {
    lines.push(`Notes the sender has already passed over (write different ones):\n${earlier.map((text) => `<passed_over>\n${text}\n</passed_over>`).join('\n')}`);
  }
  return lines.join('\n\n');
}

/** One note as it goes on the card: plain text, at most a blank line between lines, no quotes around it. */
function tidy(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .replace(/^["“]([\s\S]*)["”]$/, '$1')
    .trim();
}

const LINK = /(https?:\/\/|www\.)\S/i;

/**
 * The notes the apps can show: each in one of the three tones, within the card's letter limit, without a link, no
 * two alike, in the apps' order. A note over the limit is left out, not cut mid-sentence.
 */
function usableNotes(answer, limit = holidayCards.MESSAGE_LIMIT) {
  const seen = new Set();
  const notes = [];
  for (const item of Array.isArray(answer?.notes) ? answer.notes : []) {
    const text = tidy(item?.text);
    if (!TONES.includes(item?.tone) || !text || letters(text) > limit || LINK.test(text)) continue;
    if (seen.has(text) || notes.some((kept) => kept.tone === item.tone)) continue;
    seen.add(text);
    notes.push({ tone: item.tone, text });
  }
  return notes.sort((a, b) => TONES.indexOf(a.tone) - TONES.indexOf(b.tone));
}

module.exports = {
  TONES, HINT_LIMIT, NAME_LIMIT, PASSED_OVER_MAX, TARGET_LETTERS,
  cardNoteJsonSchema, cardNoteClaudeSchema, namesOf, toLine, userContent, tidy, usableNotes,
};
