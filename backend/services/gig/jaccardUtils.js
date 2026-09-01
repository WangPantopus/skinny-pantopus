// ============================================================
// jaccardUtils — Word-token Jaccard similarity for title
// deduplication. No external NLP libraries.
// ============================================================

// Common English stop words to filter out before comparison
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'for', 'my', 'i', 'in', 'to', 'of',
  'need', 'is', 'it', 'me', 'at', 'on', 'with', 'this', 'that', 'be',
  'do', 'your', 'our', 'some', 'can', 'will', 'have', 'has', 'get',
  'please', 'help', 'looking', 'wanted', 'needed',
]);

/**
 * Normalize a title into an array of meaningful word tokens.
 *   1. Lowercase
 *   2. Strip punctuation and numbers
 *   3. Split on whitespace
 *   4. Remove stop words
 *   5. Remove empty strings
 */
function normalizeTitle(title) {
  if (!title || typeof title !== 'string') return [];

  return title
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')  // strip non-alpha
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

/**
 * Compute Jaccard similarity between two arrays of word tokens.
 *   Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 *
 * Returns a float in [0, 1]. Empty inputs → 0.
 */
function jaccardSimilarity(tokensA, tokensB) {
  if (!tokensA || !tokensB || tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 0;

  return intersection / union;
}

module.exports = { normalizeTitle, jaccardSimilarity, STOP_WORDS };
