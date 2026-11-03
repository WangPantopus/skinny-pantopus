// A person's initials sit on one color of their own, the same on iOS, Android and the web (profile build, README 7
// step 1): the account id's character codes, summed, pick one of five fills that carry white text at AA in both
// themes.
const PERSON_COLORS = ['#0369A1', '#047857', '#6D28D9', '#BE123C', '#475569'] as const;

export function personColor(seed: string | null | undefined): string {
  const value = String(seed ?? '').toLowerCase();
  let sum = 0;
  for (let i = 0; i < value.length; i += 1) sum += value.charCodeAt(i);
  return PERSON_COLORS[sum % PERSON_COLORS.length];
}

/** "Rowan Park" → "RP"; one word gives one letter. */
export function personInitials(name: string | null | undefined): string {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}
