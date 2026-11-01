// The profile prompt catalog: the server stores each prompt's key and answer, the apps own the words. Prompts never
// ask where someone will be or when. iOS and Android carry the same ten keys and text.

export const PROFILE_PROMPTS = [
  { key: 'ask_me_about', text: 'Ask me about…' },
  { key: 'i_can_lend', text: 'I can lend…' },
  { key: 'best_spot', text: 'Best spot around here…' },
  { key: 'new_here_recommend', text: 'New here? I’d recommend…' },
  { key: 'looking_for', text: 'Looking for…' },
  { key: 'favorite_local_food', text: 'My favorite local food…' },
  { key: 'something_learning', text: 'Something I’m learning…' },
  { key: 'lived_here_since', text: 'I’ve lived here since…' },
  { key: 'best_way_to_say_hi', text: 'Best way to say hi…' },
  { key: 'neighborhood_tradition', text: 'A neighborhood tradition I love…' },
] as const;

/** At most this many prompts on a profile. */
export const MAX_PROFILE_PROMPTS = 3;
/** An answer's length limit (the server trims and checks it too). */
export const PROMPT_ANSWER_MAX = 120;

const TEXT = new Map<string, string>(PROFILE_PROMPTS.map((prompt) => [prompt.key, prompt.text]));

/** The prompt's words, or null for a key from a newer catalog (those are skipped, never shown as a raw key). */
export function promptText(key: string): string | null {
  return TEXT.get(key) ?? null;
}
