/**
 * "Get to know <name>" prompts on a profile (PRF CONTRACT.md SRV-2), stored in User.profile_prompts: at most three
 * { key, answer } in the person's order. The keys are a fixed catalog whose text the apps own; none asks where someone
 * will be or when.
 */

const PROFILE_PROMPT_KEYS = [
  'ask_me_about',
  'i_can_lend',
  'best_spot',
  'new_here_recommend',
  'looking_for',
  'favorite_local_food',
  'something_learning',
  'lived_here_since',
  'best_way_to_say_hi',
  'neighborhood_tradition',
];
const MAX_PROMPTS = 3;
const MAX_ANSWER_LENGTH = 120;

function invalid(error) {
  return { error, code: 'PROFILE_PROMPTS_INVALID' };
}

/**
 * The list PATCH /api/users/profile stores for `profile_prompts`, or { error, code } when it can't be stored.
 * Answers are plain text: runs of spaces and line breaks become one space, then 1 to 120 characters.
 */
function normalizeProfilePrompts(input) {
  if (!Array.isArray(input)) return invalid('Prompts must be a list.');
  if (input.length > MAX_PROMPTS) return invalid(`You can answer up to ${MAX_PROMPTS} prompts.`);
  const prompts = [];
  for (const item of input) {
    const key = item && typeof item === 'object' ? item.key : undefined;
    if (!PROFILE_PROMPT_KEYS.includes(key)) return invalid('That prompt isn\'t one of the prompts Pantopus offers.');
    if (prompts.some((prompt) => prompt.key === key)) return invalid('Each prompt can be answered once.');
    const answer = typeof item.answer === 'string' ? item.answer.replace(/\s+/g, ' ').trim() : '';
    if (!answer) return invalid('Write an answer for each prompt, or remove it.');
    if (answer.length > MAX_ANSWER_LENGTH) return invalid(`Keep each answer to ${MAX_ANSWER_LENGTH} characters.`);
    prompts.push({ key, answer });
  }
  return { prompts };
}

/** The stored prompts as the profile reads send them: only well-formed { key, answer } items, in order. */
function serializeProfilePrompts(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.key === 'string' && typeof item.answer === 'string' && item.answer)
    .slice(0, MAX_PROMPTS)
    .map(({ key, answer }) => ({ key, answer }));
}

module.exports = { PROFILE_PROMPT_KEYS, normalizeProfilePrompts, serializeProfilePrompts };
