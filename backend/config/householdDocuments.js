/**
 * Facts from a household's own documents (WP25; decision P6, docs/research/provider-replacement/decisions.md). A
 * verified member uploads a PDF of the home's inspection report, appraisal or listing sheet; this server reads its
 * text, suggests facts, and keeps only the ones the household confirms. The file is never stored. Off by default.
 *
 *   HOUSEHOLD_DOCUMENTS  '1': Property details offers "Add from a document" to verified members who can edit the
 *                        home, the water heater, electrical and water pipe rows can be entered, and the years a
 *                        household gave for its roof, heating, water heater and panel show on Property details.
 *                        Anything else: nothing new, and the two document routes answer 404.
 */

const enabled = () => (process.env.HOUSEHOLD_DOCUMENTS || '').trim() === '1';

module.exports = { enabled };
