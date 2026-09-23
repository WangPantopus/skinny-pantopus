/**
 * Escape special characters for PostgREST ILIKE patterns.
 * Prevents filter injection via commas, dots, parens in user input.
 *
 * Apply it to the user's text only, before adding the surrounding `%`
 * wildcards and before the text enters an `.or(...)` / `.ilike` filter.
 */
function escapeIlike(str) {
  // Escape PostgREST special chars: backslash, percent, underscore
  // Also escape commas and dots which are PostgREST filter syntax
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/,/g, '\\,')
    .replace(/\./g, '\\.');
}

module.exports = { escapeIlike };
